import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import LeadJourney from "@/components/shared/LeadJourney";
import NoAccess from "@/components/shared/NoAccess";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import {
  MIN_JUSTIFICATION,
  QUALIFICATION_CONTEXT,
  QUALIFICATION_FACTORS,
  overrideProblem,
  scoreLead,
} from "@/lib/qualification";
import { FOLLOWUP_PROTOCOLS } from "@/lib/followupProtocols";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A4. Qualification & Scoring — the temperature stops being a feeling.
//
// Eleven questions, three answers each, and the classification falls out of the answers. The agent
// may override it; the override costs a sentence and lands on the manager's qualification-accuracy
// column. Saving activates the matching protocol, so nobody hand-builds a schedule.

const BAND_COPY = {
  Hot: "Wants to come in the next few days",
  Warm: "Interested, but not decided yet",
  Cold: "Only asking for information right now",
};

export default function Qualification() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { leadById, updateLead, audit } = useStore();
  const { user } = useSession();

  const lead = leadById(leadId);
  const [answers, setAnswers] = useState(() => lead?.qualification?.answers ?? {});
  const [context, setContext] = useState(() => lead?.qualification?.context ?? {});
  const [chosen, setChosen] = useState(() => lead?.plan?.temperature ?? null);
  const [justification, setJustification] = useState("");
  const [touched, setTouched] = useState(false);

  const score = useMemo(() => scoreLead(answers), [answers]);

  if (!lead) return <NoAccess screen="A4" />;
  if (!canOpenLead(user, lead)) return <NoAccess screen="A4" />;

  const suggested = score.suggested;
  const isOverride = Boolean(suggested && chosen && chosen !== suggested);
  const problem = overrideProblem({ suggested, chosen, justification });

  const save = () => {
    setTouched(true);
    if (problem) return;

    const protocol = FOLLOWUP_PROTOCOLS[chosen];
    const activated_at = new Date().toISOString();

    updateLead(lead.id, {
      lead_status: "Follow-up Plan Activated",
      qualification: {
        answers,
        context,
        suggested,
        chosen,
        override: isOverride,
        justification: isOverride ? justification.trim() : null,
        scored_by: user?.name ?? null,
        scored_at: activated_at,
        matched: score.matched,
      },
      // Saving a classification activates the matching plan. The agent never builds a schedule.
      plan: { temperature: chosen, day: 1, activated_at },
    });

    audit?.({
      action: isOverride ? "qualification_override" : "qualification_saved",
      lead_id: lead.id,
      actor: user?.name,
      detail: isOverride
        ? `Answers said ${suggested}, agent graded ${chosen}: ${justification.trim()}`
        : `Graded ${chosen} from ${score.total} answers`,
    });

    navigate(`/leads/${lead.id}/plan`);
  };

  return (
    <>
      <PageHeader
        screen="A4"
        title={`Qualify ${lead.patient_name}`}
        subtitle="Eleven questions. The classification comes out of the answers, not out of a feeling."
        thesis="§7, §30.3"
        back={{ to: `/leads/${lead.id}`, label: lead.patient_name }}
      />

      <LeadJourney lead={lead} current="qualify" />

      <div className="space-y-6 p-4">
        <SectionCard
          title={`Answered ${score.answered} of ${score.total}`}
          caption={
            suggested
              ? `The answers point to ${suggested}: ${score.matched.Hot.length} Hot, ${score.matched.Warm.length} Warm and ${score.matched.Cold.length} Cold indicators matched.`
              : "Answer all eleven and the classification appears here."
          }
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {["Hot", "Warm", "Cold"].map((band) => (
              <div
                key={band}
                className={cn(
                  "rounded-md p-4",
                  suggested === band ? "bg-primary-tint" : "bg-secondary"
                )}
              >
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {band}
                  {suggested === band && <Check className="h-4 w-4 text-primary" />}
                </p>
                <p className="num mt-1 text-xl font-semibold">{score.matched[band].length}</p>
                <p className="mt-1 text-xs text-muted-foreground">indicators matched</p>
                {score.matched[band].length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {score.matched[band].map((label) => (
                      <li key={label}>· {label}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="The eleven factors" caption="Each answer is an input, not a judgement.">
          <div className="space-y-4">
            {QUALIFICATION_FACTORS.map((factor) => (
              <div key={factor.key}>
                <p className="text-sm font-semibold">{factor.label}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {factor.options.map((option) => {
                    const active = answers[factor.key] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setAnswers((current) => ({ ...current, [factor.key]: option.value }))
                        }
                        className={cn(
                          "rounded-md px-4 py-2 text-sm",
                          active ? "bg-primary-tint font-semibold text-primary" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Clinical context" caption="Recorded with the score. Not scored.">
          <div className="grid gap-4 sm:grid-cols-3">
            {QUALIFICATION_CONTEXT.map((field) => (
              <div key={field.key} className="space-y-2">
                <label htmlFor={field.key} className="block text-sm font-semibold">
                  {field.label}
                </label>
                <Input
                  id={field.key}
                  value={context[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setContext((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Classification"
          caption="Accept what the answers say, or override it and write why."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {["Hot", "Warm", "Cold"].map((band) => {
              const protocol = FOLLOWUP_PROTOCOLS[band];
              const active = chosen === band;
              return (
                <button
                  key={band}
                  type="button"
                  onClick={() => setChosen(band)}
                  className={cn(
                    "rounded-md p-4 text-left",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary"
                  )}
                >
                  <p className="text-sm font-semibold">
                    {band}
                    {suggested === band ? " · suggested" : ""}
                  </p>
                  <p className={cn("mt-1 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {BAND_COPY[band]}
                  </p>
                  <p className={cn("mt-2 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    Activates: {protocol.label}
                  </p>
                </button>
              );
            })}
          </div>

          {isOverride && (
            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-4">
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-muted-foreground">
                  {`The answers say ${suggested}. Grading this ${chosen} is allowed — the patient's tone
                  carries things eleven questions do not — but the manager's scorecard will show this
                  as an override, so write the reason.`}
                </p>
              </div>
              <label htmlFor="justification" className="block text-sm font-semibold">
                Why {chosen} and not {suggested}?
              </label>
              <Textarea
                id="justification"
                rows={3}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                placeholder={`At least ${MIN_JUSTIFICATION} characters.`}
              />
            </div>
          )}

          {touched && problem && <p className="mt-2 text-sm text-destructive">{problem}</p>}

          <Button className="mt-4 w-full" onClick={save} disabled={Boolean(problem)}>
            Save and activate the {chosen ?? ""} plan
          </Button>
        </SectionCard>
      </div>
    </>
  );
}
