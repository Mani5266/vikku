import React, { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mic, MicOff, Send } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import VikkuSheet from "@/components/shared/VikkuSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOURNEYS } from "@/store/journeys";
import { VIKKU_SUGGESTIONS, buildVikkuReport } from "@/lib/vikku";
import { cn } from "@/lib/utils";

// Vikku AI — a mic, and then the sheet.
//
// The screen opens on nothing but the microphone: the manager speaks (or types, for the
// browsers that have no speech recognition), and the answer arrives as the Excel format
// they already read — date-range banner, disease blocks, source rows, subtotal per disease
// with the sheet's own colour cells. No dashboard, no charts, no default report sitting
// there before anyone asked for one.
//
// `?q=` renders an answer straight away, which is how a report gets shared as a link and
// how the render test can assert on the sheet without a microphone.
//
// Parsing is a keyword grammar in src/lib/vikku.js, not a model call. Wiring an LLM in
// later replaces `parseAsk` and nothing else; the grid and its formulas stay put.

function useSpeech(onResult) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const supported =
    typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggle = () => {
    if (!supported) {
      setError("This browser has no speech recognition — type the question instead.");
      return;
    }
    if (listening) {
      stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission was refused — type the question instead."
          : "The microphone stopped. Try again, or type the question."
      );
      setListening(false);
    };
    recognitionRef.current = recognition;
    setError(null);
    recognition.start();
    setListening(true);
  };

  return { supported, listening, error, toggle };
}

/** The big mic. The only thing on the screen until a question has been asked. */
function MicButton({ listening, onClick, size = "lg" }) {
  const large = size === "lg";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={listening ? "Stop listening" : "Ask by voice"}
      className={cn(
        "relative flex items-center justify-center rounded-full border transition-all duration-200",
        large ? "h-28 w-28 shadow-[var(--shadow-raised)]" : "h-9 w-9",
        listening
          ? "border-destructive/60 bg-destructive text-destructive-foreground ring-8 ring-destructive/15"
          : "border-input bg-card hover:border-primary/40 hover:bg-accent hover:ring-8 hover:ring-primary/10"
      )}
    >
      {listening ? (
        <MicOff className={large ? "h-10 w-10" : "h-4 w-4"} />
      ) : (
        <Mic className={large ? "h-10 w-10" : "h-4 w-4"} />
      )}
    </button>
  );
}

export default function VikkuAi() {
  const [params, setParams] = useSearchParams();
  const initialQuestion = params.get("q");
  const [thread, setThread] = useState(() =>
    initialQuestion
      ? [{ id: 0, question: initialQuestion, report: buildVikkuReport(initialQuestion, JOURNEYS) }]
      : []
  );
  const [draft, setDraft] = useState("");

  const ask = (question) => {
    const text = (question || "").trim();
    if (!text) return;
    setThread((current) => [
      ...current,
      { id: current.length, question: text, report: buildVikkuReport(text, JOURNEYS) },
    ]);
    setDraft("");
    setParams({ q: text }, { replace: true });
  };

  const speech = useSpeech(ask);
  const started = thread.length > 0;

  const askBar = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        ask(draft);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <MicButton listening={speech.listening} onClick={speech.toggle} size="sm" />
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="or type it — e.g. piles last 15 days, agent wise"
        className="min-w-[16rem] flex-1"
        aria-label="Ask Vikku AI"
      />
      <Button type="submit">
        <Send className="h-4 w-4" />
        Ask
      </Button>
    </form>
  );

  const suggestions = (
    <div className="flex flex-wrap justify-center gap-1.5">
      {VIKKU_SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => ask(suggestion)}
          className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        screen="M10"
        title="Vikku AI"
        subtitle="Ask out loud. The answer comes back in the sheet you already read."
        thesis="§25, §31, §32"
      />

      {!started ? (
        // Opening state: the mic, and nothing else.
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-6 text-center">
          <MicButton listening={speech.listening} onClick={speech.toggle} />
          <div>
            <p className="text-base font-medium">
              {speech.listening ? "Listening — ask your question" : "Tap the mic and ask"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Say a period and a filter, like "piles last 15 days".</p>
          </div>

          {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}
          {!speech.supported && !speech.error && (
            <p className="text-xs text-muted-foreground">
              This browser has no speech recognition. Typing works the same way.
            </p>
          )}

          <div className="w-full max-w-2xl space-y-4">
            {askBar}
            {suggestions}
          </div>
        </div>
      ) : (
        <div className="space-y-6 p-6">
          {thread.map((entry) => (
            <div key={entry.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">asked</Badge>
                <p className="text-sm font-medium">{entry.question}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{`window: ${entry.report.banner}`}</Badge>
                <Badge variant="secondary">{`rows: ${entry.report.dimensionLabel.toLowerCase()} wise`}</Badge>
                <Badge variant="secondary">{`blocks: ${entry.report.blocks.length}`}</Badge>
                {entry.report.filterLabels.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
              <div className="card-surface p-2">
                <VikkuSheet report={entry.report} />
              </div>
            </div>
          ))}

          {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}

          <div className="space-y-3 border-t pt-4">
            {askBar}
            {suggestions}
          </div>

          <p className="text-xs text-muted-foreground">
            Formulas follow the sheet exactly: Conversion % after Connected is connected ÷ total, Op
            Conversion % is Op ÷ connected, Ip Conversion% is Ip ÷ Op, and Pending Follow-up is total − Op.
            Dates accept plain windows ("last week", "last 30 days") or an explicit range
            ("01-08-2026 to 07-08-2026").
          </p>
        </div>
      )}
    </>
  );
}
