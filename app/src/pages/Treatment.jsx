import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Circle, IndianRupee, Stethoscope } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import LeadJourney, { NextStepCard } from "@/components/shared/LeadJourney";
import NoAccess from "@/components/shared/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import { rupees } from "@/lib/funnel";
import { useToast } from "@/components/ui/toast";
import {
  CONSULTATION_DECISIONS,
  INSURANCE_STATES,
  TREATMENT_STEPS,
  decisionByValue,
  nextTreatmentStep,
  outstandingSteps,
  updateProblems,
} from "@/lib/treatment";

// The half of the journey that did not exist.
//
// A patient who has been to the hospital and been told they need an operation is the most valuable
// record in this system: they cost an ad click, a telecaller's week and a surgeon's afternoon to
// produce, and they have already said yes to the hard part. Until this screen, the product marked
// them Finished and stopped asking anybody to call them.
//
// Nothing here is a clinical judgement. The doctor decides; this records the decision and then
// works the two things that lose an operation somebody already agreed to — the money conversation
// and the date.

function Step({ step, treatment }) {
  const done = step.done(treatment);
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-3">
      <Icon className={done ? "mt-0.5 h-5 w-5 shrink-0 text-success" : "mt-0.5 h-5 w-5 shrink-0 text-placeholder"} />
      <div>
        <p className={done ? "text-sm font-medium text-muted-foreground line-through" : "text-sm font-semibold"}>
          {step.label}
        </p>
        <p className="text-xs text-muted-foreground">{step.plain}</p>
      </div>
    </li>
  );
}

export default function Treatment() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { leadById, updateLead, audit } = useStore();
  const { user } = useSession();
  const { toast } = useToast();

  const lead = leadById(leadId);
  const [draft, setDraft] = useState(() => lead?.treatment ?? {});
  const [touched, setTouched] = useState(false);

  const problems = useMemo(() => updateProblems(draft, lead), [draft, lead]);
  const outstanding = useMemo(() => outstandingSteps({ ...lead, treatment: draft }), [lead, draft]);
  const step = useMemo(() => nextTreatmentStep(lead), [lead]);

  if (!lead || !canOpenLead(user, lead)) return <NoAccess />;

  const seen = lead.appointment?.state === "Consultation Completed";
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const save = ({ book = false } = {}) => {
    setTouched(true);
    const next = book ? { ...draft, surgeryBookedAt: new Date().toISOString() } : draft;
    const found = updateProblems(next, lead);
    if (found.length) return;

    updateLead(lead.id, {
      treatment: { ...next, updated_by: user?.name ?? null, updated_at: new Date().toISOString() },
      ...(book ? { lead_status: "Surgery Booked", stage: 17 } : {}),
    });
    audit?.({
      action: book ? "surgery_booked" : "treatment_updated",
      lead_id: lead.id,
      actor: user?.name,
      detail: book
        ? `Surgery booked for ${next.surgeryDate} at ${rupees(Number(next.quotedPackage) || 0)}`
        : `${next.decision}${next.counselingAt ? " · money talk logged" : ""}`,
    });
    toast({
      title: book ? "Surgery booked" : "Treatment updated",
      description: book ? "Admissions own this patient now." : nextTreatmentStep({ ...lead, treatment: next })?.label,
    });
    if (book) navigate(`/leads/${lead.id}`);
  };

  return (
    <>
      <PageHeader
        screen="A10"
        title={`After the consultation — ${lead.patient_name}`}
        subtitle="What the doctor decided, and what stands between that and an operation."
        back={{ to: `/leads/${lead.id}`, label: "Back to lead" }}
        thesis="§17, §24, §30.7, §33"
      />

      <LeadJourney lead={lead} current="treatment" />

      <div className="space-y-4 p-4">
        {!seen && (
          <SectionCard title="This patient has not been seen yet">
            <p className="text-sm text-muted-foreground">
              Nothing here applies until the appointment reaches Consultation Completed. Book and
              confirm the visit first — the doctor has to decide before anybody can work the decision.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate(`/leads/${lead.id}/appointment`)}>
              Open the appointment
            </Button>
          </SectionCard>
        )}

        {seen && (
          <>
            {step?.action && <NextStepCard step={step} />}

            <SectionCard
              title="What did the doctor decide?"
              caption="Recorded, never guessed. Two of these four are finished clinical outcomes rather than lost leads, and the difference is what stops a changing case mix reading as a falling conversion rate."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {CONSULTATION_DECISIONS.map((decision) => (
                  <button
                    key={decision.value}
                    type="button"
                    onClick={() => set({ decision: decision.value })}
                    className={
                      draft.decision === decision.value
                        ? "rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                        : "rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                    }
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{decision.value}</span>
                      {decision.clinical && <StatusPill status="Not a lost lead" tone="good" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{decision.plain}</p>
                  </button>
                ))}
              </div>
              {draft.decision && (
                <p className="mt-3 text-xs text-muted-foreground">{decisionByValue(draft.decision)?.detail}</p>
              )}
            </SectionCard>

            {draft.decision === "Surgery advised" && (
              <>
                <SectionCard
                  title="What stands between here and the operation"
                  caption="Three steps, in order. Each one loses patients who had already agreed to surgery."
                >
                  <ul className="space-y-3">
                    {TREATMENT_STEPS.map((entry) => (
                      <Step key={entry.key} step={entry} treatment={draft} />
                    ))}
                  </ul>
                  {outstanding.length === 0 && (
                    <p className="mt-4 text-sm text-success">
                      Everything is settled. The surgery can be booked.
                    </p>
                  )}
                </SectionCard>

                <SectionCard title="The quote" caption="What the patient was told the operation costs. The money conversation cannot start without a number.">
                  <div className="flex flex-wrap items-center gap-3">
                    <IndianRupee className="h-5 w-5 text-muted-foreground" />
                    <Input
                      inputMode="numeric"
                      className="max-w-xs"
                      value={draft.quotedPackage ?? ""}
                      onChange={(event) => set({ quotedPackage: event.target.value })}
                      placeholder="e.g. 240000"
                    />
                    {Number(draft.quotedPackage) > 0 && (
                      <span className="num text-sm font-semibold">{rupees(Number(draft.quotedPackage))}</span>
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="The money talk"
                  caption="§33's worked example is four of seven price objectors who never had this conversation, and a hospital that concluded it had a pricing problem. Log it here and the closure guard below stops that happening."
                >
                  {draft.counselingAt ? (
                    <div className="space-y-2">
                      <StatusPill status="Money talk logged" tone="good" />
                      <p className="text-sm">{draft.counselingNote}</p>
                      <Button variant="outline" size="sm" onClick={() => set({ counselingAt: null, counselingNote: "" })}>
                        Undo — it did not happen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        rows={3}
                        value={draft.counselingNote ?? ""}
                        onChange={(event) => set({ counselingNote: event.target.value })}
                        placeholder="What was explained, and what the patient said about it. The next person to open this lead reads this."
                      />
                      <Button
                        variant="outline"
                        onClick={() => set({ counselingAt: new Date().toISOString() })}
                        disabled={String(draft.counselingNote || "").trim().length < 12}
                      >
                        Log the money talk
                      </Button>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Insurance" caption="A patient waiting on an approval nobody is chasing goes quiet, and it reads afterwards as a price objection.">
                  <div className="flex flex-wrap gap-2">
                    {INSURANCE_STATES.map((state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant={draft.insurance === state ? "default" : "outline"}
                        onClick={() => set({ insurance: state })}
                      >
                        {state}
                      </Button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="The date" caption="The last thing standing between the hospital and the operation.">
                  <Input
                    type="date"
                    className="max-w-xs"
                    value={draft.surgeryDate ?? ""}
                    onChange={(event) => set({ surgeryDate: event.target.value })}
                  />
                </SectionCard>
              </>
            )}

            {draft.decision === "Tests advised" && (
              <SectionCard title="Which reports, and when" caption="The lead stays open. The follow-up is about the reports, not about the surgery.">
                <Textarea
                  rows={3}
                  value={draft.testsNote ?? ""}
                  onChange={(event) => set({ testsNote: event.target.value })}
                  placeholder="What the doctor asked for and when the patient expects to have it."
                />
              </SectionCard>
            )}

            {touched && problems.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>· {problem}</li>
                ))}
              </ul>
            )}

            <div className="card-surface flex flex-wrap items-center gap-3 p-4">
              <Button onClick={() => save()} disabled={problems.length > 0}>
                <Stethoscope className="h-5 w-5" />
                Save
              </Button>
              {draft.decision === "Surgery advised" && (
                <Button variant="outline" onClick={() => save({ book: true })} disabled={outstanding.length > 0}>
                  {outstanding.length > 0
                    ? `${outstanding.length} step(s) still open`
                    : "Book the surgery"}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(`/leads/${lead.id}/close`)}>
                Not going ahead — close with a reason
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
