import { useCallback, useRef, useState } from "react";

// Dictation for the remark fields.
//
// The agent has just spent four minutes on the phone in Telugu and now has to type English into two
// boxes. That is the moment the remark turns into "will come". Speaking it is the difference between
// a real remark and a useless one, so the mic sits on the field itself.
//
// `lang` is switchable because the call happened in Telugu and the remark is read in English —
// whichever the agent is faster in is the right one for the record.

export const DICTATION_LANGUAGES = [
  { value: "en-IN", label: "English" },
  { value: "te-IN", label: "తెలుగు" },
  { value: "hi-IN", label: "हिंदी" },
];

export function useDictation({ lang = "en-IN", onText } = {}) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const supported =
    typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("This browser cannot listen. Type it instead.");
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      if (text) onText?.(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone blocked. Type it instead."
          : "The microphone stopped. Try again."
      );
      setListening(false);
    };
    recognitionRef.current = recognition;
    setError(null);
    recognition.start();
    setListening(true);
  }, [lang, onText, supported]);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, error, toggle };
}
