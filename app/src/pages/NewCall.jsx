import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Mic, MicOff, PhoneCall, PhoneOff, Save, Sparkles } from "lucide-react";
import StructuredRemark, { isRemarkComplete, missingRemarkParts } from "@/components/shared/StructuredRemark";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead, scopeRows } from "@/lib/rbac";
import NoAccess from "@/components/shared/NoAccess";
import PageHeader from "@/components/shared/PageHeader";
import LeadJourney from "@/components/shared/LeadJourney";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { lastWord, nextStepFor, telHref } from "@/lib/agentCopy";
import {
  AGENT_PHRASES,
  NEXT_ACTIONS,
  NOT_CONNECTED_QUICK,
  PATIENT_PHRASES,
  QUICK_OBJECTIONS,
  TEMPERATURE_CHOICES,
  appendPhrase,
  followUpPresets,
} from "@/lib/quickPhrases";
import { DICTATION_LANGUAGES, useDictation } from "@/lib/useDictation";
import { cn } from "@/lib/utils";

// A3. Log a call — built for the ninetieth call of the day.
//
// The record it writes is unchanged: the seven parts of §3.2, validated by the same
// `isRemarkComplete()` that ships to Base44. What changed is the number of keystrokes needed to
// produce an honest one.
//
//   · a dial that did not connect is one tap, and it saves and moves on
//   · what the patient said and what you explained are tappable phrases, or dictation, or typing
//   · the follow-up time is a preset, not a datetime field
//   · temperature is set here, on the same screen as the call, with the calls it commits you to
//     printed next to it — it used to live on another screen entirely
//   · saving offers the next lead, so the queue does not have to be re-found after every call
//
// The full seven-part form is still on the screen, below the fast path, writing into the same
// object. The chips remove typing; they never remove the requirement.

// A chip. One tap, no dropdown to open.
function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center rounded-full px-4 text-sm transition-colors",
        active ? "bg-primary-tint font-semibold text-primary" : "bg-card text-muted-foreground shadow-card active:bg-secondary",
        className
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="card-surface space-y-2 p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const AI_DRAFT = {
  patientSaid:
    "Says the pain has worsened over the last two weeks and she is ready for surgery, but wants to confirm insurance cover first.",
  agentExplained:
    "Explained the day-care procedure, the two-week recovery window, and that we would run an insurance eligibility check today.",
  objectionCategory: "Financial",
  objectionRaised: "Insurance unavailable",
  materialShared: "Financial Support — insurance and EMI",
  nextAction: "Financial Counseling",
};

export default function NewCall() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useStore();
  const lead = store.leadById(leadId);
  const { user } = useSession();
  const owned = canOpenLead(user, lead);

  const [connected, setConnected] = useState(true);
  const [remark, setRemark] = useState({});
  const [temperature, setTemperature] = useState("");
  const [feedback, setFeedback] = useState("");
  const [suggested, setSuggested] = useState(null);
  const [showFullForm, setShowFullForm] = useState(false);
  const [dictationLang, setDictationLang] = useState("en-IN");
  const [phraseGroup, setPhraseGroup] = useState(PATIENT_PHRASES[0].group);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  // A timer, because "call duration (seconds)" was a field the agent had to guess and type.
  useEffect(() => {
    const id = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const patientDictation = useDictation({
    lang: dictationLang,
    onText: (text) => setRemark((r) => ({ ...r, patientSaid: appendPhrase(r.patientSaid, text) })),
  });
  const agentDictation = useDictation({
    lang: dictationLang,
    onText: (text) => setRemark((r) => ({ ...r, agentExplained: appendPhrase(r.agentExplained, text) })),
  });

  const presets = useMemo(() => followUpPresets(), []);

  // The next lead to work, so "save and next" does not send the agent back to hunt through a list.
  const nextLead = useMemo(() => {
    if (!lead) return null;
    const mine = scopeRows(store.leads, user).filter((l) => l.id !== lead.id);
    return (
      mine
        .map((l) => ({ lead: l, step: nextStepFor(l, store.interactionsFor(l.id)) }))
        .sort((a, b) => b.step.weight - a.step.weight)[0]?.lead || null
    );
  }, [lead, store, user]);

  if (!lead) return <div className="p-4 text-sm text-muted-foreground">Lead not found.</div>;
  if (!owned) return <NoAccess screen="A2" />;

  const said = lastWord(store.interactionsFor(lead.id));
  const attemptNumber = store.interactionsFor(lead.id).length + 1;
  const complete = isRemarkComplete(remark, { connected });
  const missing = missingRemarkParts(remark);

  const applyTemperature = () => {
    if (!temperature || temperature === lead.plan?.temperature) return;
    // Setting the temperature is what schedules the follow-up calls, so it is written to the plan
    // immediately — the agent does not have to go to another screen to make it count.
    store.updateLead(lead.id, { plan: { temperature, day: 1, activated_at: new Date().toISOString() } });
  };

  const goNext = (andNext) => {
    if (andNext && nextLead) navigate(`/leads/${nextLead.id}/call`);
    else navigate(`/leads/${lead.id}`);
  };

  /** One tap: the dial did not connect. Nothing else to fill in. */
  const saveNotConnected = (reason) => {
    store.saveInteraction({
      lead_id: lead.id,
      lead_type: lead.lead_type,
      agent_name: lead.agent_name,
      contact_outcome: "Not Connected",
      not_connected_reason: reason,
      attempt_number: attemptNumber,
      double_dial_complete: attemptNumber >= 2,
      call_duration_seconds: seconds || undefined,
      feedback: `Attempt ${attemptNumber} — ${reason}.`,
    });
    if (lead.plan?.temperature !== "Not Connected" && reason !== "Wrong number" && reason !== "Invalid number") {
      store.updateLead(lead.id, { plan: { temperature: "Not Connected", day: 1 } });
    }
    toast({ title: `Saved — ${reason}`, description: nextLead ? `Next: ${nextLead.patient_name}` : "Queue is clear." });
    goNext(true);
  };

  const saveConnected = (andNext) => {
    if (!complete) {
      toast({ title: `Still needed: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    if (!temperature) {
      toast({ title: "Pick how interested they are", variant: "destructive" });
      return;
    }

    store.saveInteraction({
      lead_id: lead.id,
      lead_type: lead.lead_type,
      agent_name: lead.agent_name,
      contact_outcome: "Connected",
      patient_response: temperature === "Not Connected" ? "No clear response" : undefined,
      call_duration_seconds: seconds || undefined,
      feedback: feedback || remark.patientSaid,
      patient_said: remark.patientSaid,
      agent_explained: remark.agentExplained,
      objection_category: remark.objectionCategory || "None",
      objection_raised: remark.objectionRaised,
      material_shared: remark.materialShared,
      next_action: remark.nextAction,
      next_action_at: remark.nextActionAt,
      evidence_ref: suggested ? "transcript@00:04:12" : undefined,
    });
    applyTemperature();

    toast({
      title: "Call saved",
      description: nextLead && andNext ? `Next: ${nextLead.patient_name}` : "Follow-up calls are on your list.",
    });
    goNext(andNext);
  };

  const chosenPreset = presets.find((p) => p.value === remark.nextActionAt);
  const group = PATIENT_PHRASES.find((g) => g.group === phraseGroup) || PATIENT_PHRASES[0];

  return (
    <>
      <PageHeader
        screen="A3"
        title={`Call — ${lead.patient_name}`}
        subtitle="Tap what happened. Type only what the taps do not cover."
        back={{ to: `/leads/${lead.id}`, label: "Back to lead" }}
        actions={
          <span className="num text-sm text-muted-foreground">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")} on this call
          </span>
        }
      />

      <LeadJourney lead={lead} current="plan" />

      <div className="space-y-4 p-4">
        {/* Who am I talking to, and what did they say last time. */}
        <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-base font-semibold">
              {lead.patient_name} · {lead.disease}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Last time: {said.said}</p>
            {said.objection && <p className="mt-1 text-sm text-muted-foreground">Worry: {said.objection}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {`Attempt ${attemptNumber} · ${lead.plan?.temperature || "not qualified yet"} · day ${lead.plan?.day ?? 1}`}
            </p>
          </div>
          <a
            href={telHref(lead.phone_number)}
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card active:bg-primary-pressed"
          >
            <PhoneCall className="h-6 w-6" />
            Call {lead.phone_number}
          </a>
        </div>

        {/* One tap for a dial that went nowhere — the 40% of calls nobody wants to fill a form for. */}
        <Section title="Did not speak to them?" hint="One tap saves the attempt and opens your next lead.">
          <div className="flex flex-wrap gap-2">
            {NOT_CONNECTED_QUICK.map((option) => (
              <Button key={option.reason} variant="outline" onClick={() => saveNotConnected(option.reason)}>
                <PhoneOff className="h-4 w-4" />
                {option.label}
              </Button>
            ))}
          </div>
        </Section>

        <Section
          title="Spoke to them"
          hint="Everything below is the record the manager reads. Tap the lines that match, speak the rest."
        >
          <div className="flex flex-wrap gap-2">
            <Chip active={connected} onClick={() => setConnected(true)}>
              Yes, we spoke
            </Chip>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuggested(AI_DRAFT);
                setRemark((r) => ({ ...AI_DRAFT, ...r }));
              }}
            >
              <Sparkles className="h-4 w-4" />
              Fill from the recording
            </Button>
            <span className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Speak in</span>
              {DICTATION_LANGUAGES.map((option) => (
                <Chip
                  key={option.value}
                  active={dictationLang === option.value}
                  onClick={() => setDictationLang(option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </span>
          </div>
        </Section>

        {/* What the patient said — chips, mic, or typing. All three write the same field. */}
        <Section title="What did the patient say?" hint="Their words. This is what the next call starts from.">
          <div className="flex flex-wrap gap-2">
            {PATIENT_PHRASES.map((g) => (
              <Chip key={g.group} active={phraseGroup === g.group} onClick={() => setPhraseGroup(g.group)}>
                {g.group}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.phrases.map((phrase) => (
              <Chip
                key={phrase}
                onClick={() => setRemark((r) => ({ ...r, patientSaid: appendPhrase(r.patientSaid, phrase) }))}
              >
                {phrase}
              </Chip>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <Textarea
              rows={3}
              value={remark.patientSaid || ""}
              onChange={(event) => setRemark((r) => ({ ...r, patientSaid: event.target.value }))}
              placeholder="Tap a line above, speak it, or type it."
            />
            <Button
              variant={patientDictation.listening ? "destructive" : "outline"}
              onClick={patientDictation.toggle}
              title="Speak the remark"
            >
              {patientDictation.listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
          </div>
          {patientDictation.error && <p className="text-xs text-destructive">{patientDictation.error}</p>}
        </Section>

        <Section title="What did you tell them?">
          <div className="flex flex-wrap gap-2">
            {AGENT_PHRASES.map((phrase) => (
              <Chip
                key={phrase}
                onClick={() => setRemark((r) => ({ ...r, agentExplained: appendPhrase(r.agentExplained, phrase) }))}
              >
                {phrase}
              </Chip>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <Textarea
              rows={2}
              value={remark.agentExplained || ""}
              onChange={(event) => setRemark((r) => ({ ...r, agentExplained: event.target.value }))}
              placeholder="Tap a line above, speak it, or type it."
            />
            <Button
              variant={agentDictation.listening ? "destructive" : "outline"}
              onClick={agentDictation.toggle}
              title="Speak what you explained"
            >
              {agentDictation.listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
          </div>
        </Section>

        <Section title="What is stopping them?" hint="Leave it blank if nothing came up.">
          <div className="flex flex-wrap gap-2">
            {QUICK_OBJECTIONS.map((option) => (
              <Chip
                key={option.reason}
                active={remark.objectionRaised === option.reason}
                onClick={() =>
                  setRemark((r) => ({ ...r, objectionCategory: option.category, objectionRaised: option.reason }))
                }
              >
                {option.reason}
              </Chip>
            ))}
            <Chip
              active={!remark.objectionRaised}
              onClick={() => setRemark((r) => ({ ...r, objectionCategory: "None", objectionRaised: "" }))}
            >
              Nothing
            </Chip>
          </div>
        </Section>

        <Section title="What happens next, and when?">
          <div className="flex flex-wrap gap-2">
            {NEXT_ACTIONS.map((action) => (
              <Chip
                key={action.value}
                active={remark.nextAction === action.value}
                onClick={() => setRemark((r) => ({ ...r, nextAction: action.value }))}
              >
                {action.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Chip
                key={preset.label}
                active={remark.nextActionAt === preset.value}
                onClick={() => setRemark((r) => ({ ...r, nextActionAt: preset.value }))}
              >
                {preset.label}
              </Chip>
            ))}
          </div>
          {chosenPreset && (
            <p className="text-xs text-muted-foreground">
              {`It will come back on your list ${chosenPreset.label.toLowerCase()}.`}
            </p>
          )}
        </Section>

        {/* Temperature, on the same screen as the call, with the promise attached. */}
        <Section
          title="How interested are they?"
          hint="This decides the calls that land on your list. Pick honestly — the recording is checked against it."
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {TEMPERATURE_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => setTemperature(choice.value)}
                className={cn(
                  "rounded-md p-4 text-left transition-colors",
                  temperature === choice.value
                    ? "bg-primary-tint text-primary"
                    : "bg-card text-foreground shadow-card active:bg-secondary"
                )}
              >
                <span className="block text-sm font-semibold">{choice.label}</span>
                <span className="mt-1 block text-xs">{choice.plain}</span>
                <span className="mt-2 block text-xs text-muted-foreground">{choice.promise}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* The shipped seven-part form, unchanged, writing into the same object. */}
        <div className="card-surface p-4">
          <button
            type="button"
            onClick={() => setShowFullForm((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Full form — all seven parts</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Same fields, written the long way. The taps above fill these.
              </span>
            </span>
            <ChevronDown className={cn("h-6 w-6 shrink-0 transition-transform", showFullForm && "rotate-180")} />
          </button>
          {showFullForm && (
            <div className="mt-4">
              <StructuredRemark value={remark} onChange={setRemark} connected={connected} suggested={suggested} />
              <Textarea
                className="mt-4"
                rows={2}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Anything else worth writing down."
              />
            </div>
          )}
        </div>

        {/* Save. Two ways out, and the missing pieces named before the tap, not after. */}
        <div className="card-surface flex flex-wrap items-center gap-4 p-4">
          <Button onClick={() => saveConnected(true)} disabled={!complete || !temperature}>
            <Save className="h-6 w-6" />
            {nextLead ? `Save and call ${nextLead.patient_name}` : "Save"}
          </Button>
          <Button variant="outline" onClick={() => saveConnected(false)} disabled={!complete || !temperature}>
            Save and stay here
          </Button>
          {(!complete || !temperature) && (
            <p className="text-xs text-muted-foreground">
              Still needed:{" "}
              {[...missing, temperature ? null : "how interested they are"].filter(Boolean).join(", ")}
            </p>
          )}
          {complete && temperature && (
            <Badge variant="success">Ready to save</Badge>
          )}
        </div>
      </div>
    </>
  );
}
