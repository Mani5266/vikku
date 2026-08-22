// The listening pipeline's pure parts.
//
//   npm run test:transcript
//
// The socket, the microphone and the model cannot be exercised without a browser and a key. What
// can be tested is everything that decides what ends up in the record: which tokens count as
// speech, which are Soniox's control markers, what is settled against what is still a guess, and
// the audio conversion that a wrong line in turns into a click the recogniser hears as a consonant.
//
// The rule these assert together: an interim guess must never reach the transcript that gets
// drafted from. Live captions may flicker; the record may not.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const t = await load("src/lib/liveTranscript.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

// ---- tokens ------------------------------------------------------------------------------------

check("Soniox control markers are not speech", () => {
  // A transcript containing "<end>" is a transcript somebody has to explain.
  assert.equal(t.isContentToken({ text: "<end>" }), false);
  assert.equal(t.isContentToken({ text: "<fin>" }), false);
  assert.equal(t.isContentToken({ text: "" }), false);
  assert.equal(t.isContentToken({}), false);
  assert.equal(t.isContentToken({ text: "hello" }), true);
});

check("settled and guessed text are kept apart", () => {
  const { settled, interim } = t.foldTokens([
    { text: "my knee ", is_final: true },
    { text: "has been ", is_final: true },
    { text: "hurting", is_final: false },
  ]);
  assert.equal(settled, "my knee has been ");
  assert.equal(interim, "hurting");
});

check("a control marker between real tokens does not break the run", () => {
  const { settled } = t.foldTokens([
    { text: "package ", is_final: true },
    { text: "<fin>", is_final: true },
    { text: "price", is_final: true },
  ]);
  assert.equal(settled, "package price");
});

check("an empty batch folds to nothing rather than throwing", () => {
  assert.deepEqual(t.foldTokens([]), { settled: "", interim: "" });
  assert.deepEqual(t.foldTokens(), { settled: "", interim: "" });
});

check("transcript text collapses the whitespace speech recognition leaves behind", () => {
  assert.equal(t.transcriptText("  my  knee   ", " hurts "), "my knee hurts");
  assert.equal(t.transcriptText(""), "");
});

// ---- audio -------------------------------------------------------------------------------------

check("float samples convert to 16-bit at full scale", () => {
  const pcm = t.floatToPcm16(new Float32Array([0, 1, -1, 0.5]));
  assert.equal(pcm[0], 0);
  assert.equal(pcm[1], 32767);
  assert.equal(pcm[2], -32768);
  assert.ok(Math.abs(pcm[3] - 16383) <= 1);
});

check("a sample over full scale is clamped, not wrapped", () => {
  // Without the clamp, 1.5 wraps to a large negative: heard as a click, and read by the recogniser
  // as a consonant nobody said.
  const pcm = t.floatToPcm16(new Float32Array([1.5, -1.5]));
  assert.equal(pcm[0], 32767);
  assert.equal(pcm[1], -32768);
  assert.ok(pcm[0] > 0 && pcm[1] < 0);
});

check("48 kHz microphone audio comes down to the rate declared in the handshake", () => {
  // The rate sent must match the rate declared, or every word arrives at the wrong speed.
  const input = new Float32Array(4800);
  const reduced = t.downsample(input, 48000, 16000);
  assert.equal(reduced.length, 1600);
});

check("audio already at or below the target is left alone", () => {
  const input = new Float32Array(1600);
  assert.equal(t.downsample(input, 16000, 16000).length, 1600);
  assert.equal(t.downsample(input, 8000, 16000).length, 1600);
});

// ---- the states the screen reads ---------------------------------------------------------------

check("every state the screen can show is named", () => {
  assert.deepEqual(Object.values(t.TRANSCRIPT_STATES).sort(), [
    "failed",
    "idle",
    "listening",
    "starting",
    "stopped",
  ]);
});

check("a session starts idle and holds no text", () => {
  const session = new t.LiveTranscript();
  assert.equal(session.state, t.TRANSCRIPT_STATES.IDLE);
  assert.equal(session.text, "");
  assert.equal(session.finalText, "");
});

check("only settled text is offered for drafting", () => {
  // The whole rule in one assertion. Live captions may flicker; the record may not.
  const session = new t.LiveTranscript();
  session.settled = "wants the surgery ";
  session.interim = "but maybe not";
  assert.equal(session.text, "wants the surgery but maybe not");
  assert.equal(session.finalText, "wants the surgery");
});

console.log(`${checks} transcript checks passed`);
