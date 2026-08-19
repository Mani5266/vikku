import React, { useMemo, useRef, useState } from "react";
import { Mic, MicOff, Search } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOURNEYS } from "@/store/journeys";
import { SUGGESTED_QUESTIONS, ask, parseQuestion } from "@/lib/queryEngine";

// L5. Ask — one bar, typed or spoken, and a plain table back.
//
// The requirement was specific about the output: no colour, no layout tricks, a table
// that looks like the spreadsheet it downloads as. It was equally specific about trust,
// so the bar shows how it read the question — dimension, filters, date window — above
// every answer. A wrong table is then visibly a misread question, which is a thing the
// user can correct, rather than a model being wrong somewhere out of sight.
//
// The parser is a keyword grammar (src/lib/queryEngine.js), not a model call. Swapping
// in the AI layer from docs/AI-LAYER.md replaces `parseQuestion` and nothing else — the
// tables and the numbers stay where they are.

const DEFAULT_QUESTION = "Source-wise funnel for the last 90 days";

function useSpeech(onResult) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);

  const supported =
    typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggle = () => {
    if (!supported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
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
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return { supported, listening, toggle };
}

export default function AskExplorer() {
  const [draft, setDraft] = useState(DEFAULT_QUESTION);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);

  const run = (text) => {
    setDraft(text);
    setQuestion(text);
  };

  const speech = useSpeech(run);
  const report = useMemo(() => ask(question, JOURNEYS), [question]);
  const spec = useMemo(() => parseQuestion(question, JOURNEYS), [question]);

  return (
    <>
      <PageHeader
        screen="L7"
        title="Ask"
        subtitle="Type or speak a question about the last 90 days. The answer comes back as a table, and the table downloads as a spreadsheet."
        thesis="§25, §31, §32"
      />

      <div className="space-y-6 p-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuestion(draft.trim() || DEFAULT_QUESTION);
          }}
          className="flex flex-wrap gap-2"
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="e.g. why are Meta Ads leads not converting?"
            className="min-w-[18rem] flex-1"
            aria-label="Question"
          />
          <Button type="submit">
            <Search className="h-4 w-4" />
            Ask
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={speech.toggle}
            disabled={!speech.supported}
            title={speech.supported ? "Speak the question" : "This browser has no speech recognition"}
          >
            {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {speech.listening ? "Listening…" : "Speak"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => run(suggestion)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="card-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How this was read</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{`report: ${spec.intent}`}</Badge>
            {spec.dimension && <Badge variant="outline">{`grouped by: ${spec.dimension.replace("_name", "")}`}</Badge>}
            <Badge variant="outline">
              {`window: ${spec.windowDays ? `last ${spec.windowDays} days` : "all 90 days"}`}
            </Badge>
            {spec.filters.map((filter) => (
              <Badge key={filter.label} variant="secondary">
                {filter.label}
              </Badge>
            ))}
            {spec.filters.length === 0 && <Badge variant="secondary">no filters</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            If a filter is missing or wrong, the question was misread — rephrase it rather than doubting the number.
            Parsing is a keyword grammar, so the reading is repeatable.
          </p>
        </div>

        <DataTable
          title={report.title}
          caption={`${report.summary} Scope: ${report.scope.join(" · ")}.`}
          columns={report.columns}
          rows={report.rows}
          empty={report.empty}
        />

        <p className="text-xs text-muted-foreground">
          {JOURNEYS.length} journeys on record. The same metric library backs the{" "}
          <span className="font-medium">Manager</span> and <span className="font-medium">Founder</span> screens, so a
          figure there and a row here are the same fact.
        </p>
      </div>
    </>
  );
}
