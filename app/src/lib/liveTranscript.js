// Listening to a call while it happens, and turning it into the remark afterwards.
//
// §3.2 says no call without a remark, and the remark is seven parts. The rule is right and the
// cost of it lands entirely on the agent: seven honest parts on the first twenty calls of a shift,
// and something shorter every hour after that. Not laziness — what typing costs when you have been
// talking since nine.
//
// So the machine listens and drafts, and the agent confirms. The save is still gated by
// `isRemarkComplete()`, exactly as when every word was typed.
//
// Three decisions worth stating, because each is the reason a simpler version would be worse.
//
// **Audio goes straight to Soniox, never through our server.** `/api/soniox-token` mints a
// short-lived key and the browser opens its own websocket. Proxying would double the hops on a live
// call, put a socket-holding process on the critical path, and serverless functions cannot hold one
// anyway.
//
// **Only final tokens are kept.** Soniox streams partial guesses that change as more audio
// arrives; showing them is what makes live captions feel alive, but storing them would put words
// in the transcript that were never said. The interim text is exposed separately for the screen and
// is never part of what gets sent for drafting.
//
// **A failure here never blocks a call.** No microphone, no key, no network — the screen falls back
// to what it always was, a form the agent types. The transcript is an assist, and an assist that
// can prevent work is worse than no assist.

const SONIOX_WEBSOCKET = "wss://stt-rt.soniox.com/transcribe-websocket";
const MODEL = "stt-rt-v5";

// Soniox streams these as sentinels rather than as speech. They are control, not content, and a
// transcript containing "<end>" is a transcript somebody has to explain.
const END_TOKEN = "<end>";
const FINALIZED_TOKEN = "<fin>";

// 16 kHz mono is what the recogniser wants and is plenty for speech. Sending the microphone's
// native 48 kHz would trip the sample rate declared in the handshake and trebles the bytes for no
// gain in accuracy.
const TARGET_SAMPLE_RATE = 16000;

export const TRANSCRIPT_STATES = {
  IDLE: "idle",
  STARTING: "starting",
  LISTENING: "listening",
  STOPPED: "stopped",
  FAILED: "failed",
};

/** Float samples in, 16-bit PCM out — the format declared in the handshake. */
export function floatToPcm16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling. A sample above 1.0 wraps to a large negative on conversion, which is
    // heard as a click and read by the recogniser as a consonant that was never spoken.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

/**
 * Drop the sample rate by taking every nth sample.
 *
 * Crude next to a filtered resample, and correct enough here: speech energy sits well below the
 * 8 kHz Nyquist limit of the target rate, and the recogniser is trained on telephone-grade audio.
 */
export function downsample(samples, fromRate, toRate = TARGET_SAMPLE_RATE) {
  if (fromRate <= toRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = samples[Math.floor(i * ratio)];
  return out;
}

/** Is this token speech, or one of Soniox's control markers? */
export function isContentToken(token) {
  const text = token?.text;
  return Boolean(text) && text !== END_TOKEN && text !== FINALIZED_TOKEN;
}

/**
 * Fold a batch of tokens into what is settled and what is still being guessed at.
 *
 * Pure, so the token handling is testable without a microphone, a socket or a key — which is the
 * only way this part ever gets tested at all.
 */
export function foldTokens(tokens = []) {
  let settled = "";
  let interim = "";
  for (const token of tokens) {
    if (!isContentToken(token)) continue;
    if (token.is_final) settled += token.text;
    else interim += token.text;
  }
  return { settled, interim };
}

/** Speaker turns are unknown from one microphone, so the transcript is time-ordered plain text. */
export function transcriptText(settled, interim = "") {
  return `${settled}${interim}`.replace(/\s+/g, " ").trim();
}

/**
 * One listening session, from microphone permission to a finished transcript.
 *
 * Deliberately a plain class rather than a hook: the lifetime of a call does not match the
 * lifetime of a React render, and a socket owned by an effect gets torn down by a re-render at the
 * worst possible moment.
 */
export class LiveTranscript {
  constructor({ onUpdate, onState, onError } = {}) {
    this.onUpdate = onUpdate ?? (() => {});
    this.onState = onState ?? (() => {});
    this.onError = onError ?? (() => {});
    this.settled = "";
    this.interim = "";
    this.state = TRANSCRIPT_STATES.IDLE;
    this._socket = null;
    this._stream = null;
    this._context = null;
    this._node = null;
    this._keepalive = null;
  }

  _setState(state) {
    this.state = state;
    this.onState(state);
  }

  get text() {
    return transcriptText(this.settled, this.interim);
  }

  /** The settled text alone — what is safe to draft a remark from. */
  get finalText() {
    return transcriptText(this.settled);
  }

  async start() {
    if (this.state === TRANSCRIPT_STATES.LISTENING) return;
    this._setState(TRANSCRIPT_STATES.STARTING);

    try {
      const response = await fetch("/api/soniox-token", {
        method: "POST",
        // The session cookie is HttpOnly and scoped to /api. This is what sends it.
        credentials: "same-origin",
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // Not a broken microphone. Telling somebody to check their microphone when what they need
        // is to sign in again is how an afternoon gets wasted.
        throw new Error("Sign in again before listening — this deployment asks for it.");
      }
      if (!response.ok || !body.apiKey) {
        throw new Error(body.error || "The server could not get a transcription key.");
      }

      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // A telecalling floor is not a quiet room, and the phone is on speaker next to the mic.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this._context = new AudioContext();
      const source = this._context.createMediaStreamSource(this._stream);
      const processor = this._context.createScriptProcessor(4096, 1, 1);
      this._node = processor;

      await this._openSocket(body.apiKey, body.languageHints);

      processor.onaudioprocess = (event) => {
        if (this._socket?.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const reduced = downsample(input, this._context.sampleRate);
        this._socket.send(floatToPcm16(reduced).buffer);
      };

      source.connect(processor);
      // Connected to the destination with no gain: some browsers stop pumping a ScriptProcessor
      // that is not attached to the graph's output, and the agent must not hear themselves.
      const mute = this._context.createGain();
      mute.gain.value = 0;
      processor.connect(mute);
      mute.connect(this._context.destination);

      this._setState(TRANSCRIPT_STATES.LISTENING);
    } catch (error) {
      this._fail(error);
    }
  }

  _openSocket(apiKey, languageHints) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(SONIOX_WEBSOCKET);
      socket.binaryType = "arraybuffer";
      this._socket = socket;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            api_key: apiKey,
            model: MODEL,
            audio_format: "pcm_s16le",
            sample_rate: TARGET_SAMPLE_RATE,
            num_channels: 1,
            // Hints, not a lock. A locked recogniser mangles the half of the sentence that is not
            // in its language, and one sentence here regularly holds two.
            language_hints: languageHints?.length ? languageHints : ["en", "hi", "kn", "te"],
            enable_language_identification: true,
          })
        );
        // Soniox drops an idle socket. A patient thinking for thirty seconds is not idle to the
        // agent and must not be to us.
        this._keepalive = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('{"type": "keepalive"}');
        }, 10000);
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.error_code || payload.error) {
            this._fail(new Error(payload.error_message || payload.error));
            return;
          }
          const { settled, interim } = foldTokens(payload.tokens);
          this.settled += settled;
          this.interim = interim;
          this.onUpdate({ text: this.text, finalText: this.finalText });
        } catch {
          // A frame we cannot read is not worth ending a call over.
        }
      };

      socket.onerror = () => reject(new Error("The transcription connection failed."));
      socket.onclose = () => {
        clearInterval(this._keepalive);
        if (this.state === TRANSCRIPT_STATES.LISTENING) this._setState(TRANSCRIPT_STATES.STOPPED);
      };
    });
  }

  /** Stop listening, and return the transcript worth drafting from. */
  async stop() {
    clearInterval(this._keepalive);
    try {
      if (this._socket?.readyState === WebSocket.OPEN) {
        // Ask for anything still buffered before closing, or the last sentence of the call is lost
        // — which is the sentence that most often contains what was agreed.
        this._socket.send('{"type": "finalize"}');
        await new Promise((resolve) => setTimeout(resolve, 400));
        this._socket.close();
      }
    } catch {
      // Closing a socket that is already gone is not a failure.
    }
    this._node?.disconnect();
    this._stream?.getTracks().forEach((track) => track.stop());
    await this._context?.close().catch(() => {});
    this._socket = null;
    this._node = null;
    this._stream = null;
    this._context = null;
    // Interim text is dropped on purpose: it is a guess that never settled.
    this.interim = "";
    if (this.state !== TRANSCRIPT_STATES.FAILED) this._setState(TRANSCRIPT_STATES.STOPPED);
    return this.finalText;
  }

  _fail(error) {
    this._setState(TRANSCRIPT_STATES.FAILED);
    this.onError(error?.message || "Listening failed.");
    this.stop().catch(() => {});
  }
}

/**
 * Send a finished transcript for drafting.
 *
 * Returns null rather than throwing on every failure path. The caller is a call screen, and the
 * only correct behaviour when drafting fails is to leave the agent with the form they already had.
 */
export async function draftRemark(transcript, lead) {
  try {
    const response = await fetch("/api/extract-remark", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        lead: lead ? { patient_name: lead.patient_name, disease: lead.disease } : null,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { draft: null, error: body.error || "Drafting failed." };
    return { draft: body.draft ?? null, error: null, reason: body.reason ?? null };
  } catch (error) {
    return { draft: null, error: error?.message || "Drafting failed." };
  }
}
