import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, History, Save } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import NoAccess from "@/components/shared/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import { formatDateTime, relative } from "@/lib/utils";
import {
  CORRECTABLE_FIELDS,
  buildCorrection,
  changedFields,
  correctionProblems,
  describeCorrection,
  isQuietWindow,
} from "@/lib/corrections";

// A2 / A3 — correcting a call that was logged wrong.
//
// §29 says the history is append-only and that corrections post a new entry referencing the
// original. The Audit Log screen has been printing that sentence for a while and nothing
// implemented it: there was no way to correct a call at all, so the promise held only because
// nobody could test it.
//
// The gap mattered. An agent mistypes a figure, attributes an objection to the wrong person, or
// logs a call against the patient they had open rather than the one they rang — and the record
// carried it forever, into the manager's compliance view and into whatever closure cited it as
// evidence.
//
// Nothing on this screen edits the original. It writes a second record that says what changed and
// why, and both stay in the history with the older one marked as superseded.

const LONG_FIELDS = new Set(["patient_said", "agent_explained", "objection_raised", "material_shared"]);

export default function CorrectCall() {
  const { leadId } = useParams();
  const [params] = useSearchParams();
  const interactionId = params.get("call");
  const navigate = useNavigate();
  const store = useStore();
  const { user } = useSession();
  const { toast } = useToast();

  const lead = store.leads.find((entry) => entry.id === leadId);
  const interactions = store.interactionsFor(leadId);
  const original = interactions.find((entry) => entry.id === interactionId) ?? null;

  const [draft, setDraft] = useState(() =>
    Object.fromEntries(CORRECTABLE_FIELDS.map(({ key }) => [key, original?.[key] ?? ""]))
  );
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const changed = useMemo(() => changedFields(original ?? {}, draft), [original, draft]);
  const problems = useMemo(() => correctionProblems(original, draft, reason), [original, draft, reason]);
  const quiet = original ? isQuietWindow(original) : false;

  const owned = lead && canOpenLead(user, lead);
  if (!lead || !owned) return <NoAccess screen="A2" />;

  if (!original) {
    return (
      <>
        <PageHeader
          screen="A2"
          title="No such call"
          subtitle="That call is not on this lead."
          back={{ to: `/leads/${leadId}`, label: "Back to the lead" }}
        />
      </>
    );
  }

  // A correction of a correction points at the record it actually replaces, not at the first one,
  // so the chain reads in the order it happened.
  const post = () => {
    setTouched(true);
    if (problems.length) return;

    const record = buildCorrection(original, draft, reason, { agentName: user?.name });
    const written = store.saveInteraction(record);
    store.logAudit({
      actor: user?.name || "Agent",
      action: "CALL_CORRECTED",
      entity: "LeadInteraction",
      entity_id: written.id,
      detail: `${describeCorrection(changed, reason || null)} (corrects ${original.id})`,
    });

    toast({
      title: "Correction posted",
      description: "The original is still there, marked as corrected. Nothing was overwritten.",
    });
    navigate(`/leads/${leadId}`);
  };

  return (
    <>
      <PageHeader
        screen="A2"
        title="Correct this call"
        subtitle={`Logged ${relative(original.interaction_date)} · ${formatDateTime(original.interaction_date)}`}
        thesis="§29, §3.2"
        back={{ to: `/leads/${leadId}`, label: "Back to the lead" }}
      />

      <div className="space-y-4 p-4">
        <section className="card-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary" />
            The first version stays
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            This does not edit what was written. It posts a second record saying what changed, and
            the history keeps both — the older one marked as corrected. That is what makes a remark
            worth citing as evidence later.
          </p>
          {!quiet && (
            <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This call was logged more than fifteen minutes ago. Somebody may have read it or acted
              on it already, so this one needs a reason.
            </p>
          )}
        </section>

        <section className="card-surface space-y-4 p-4">
          {CORRECTABLE_FIELDS.map(({ key, label }) => {
            const isChanged = changed.some((field) => field.key === key);
            return (
              <div key={key} className="space-y-1.5">
                <Label className="flex items-center justify-between text-sm font-medium">
                  <span>{label}</span>
                  {isChanged && <span className="text-xs font-semibold text-primary">changed</span>}
                </Label>
                {LONG_FIELDS.has(key) ? (
                  <Textarea
                    rows={2}
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  />
                ) : (
                  <Input
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  />
                )}
                {isChanged && (
                  <p className="text-xs text-muted-foreground">
                    {`Was: ${String(original[key] ?? "").trim() || "empty"}`}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        <section className="card-surface space-y-2 p-4">
          <Label className="text-sm font-medium">
            {quiet ? "Why, if it is worth saying" : "Why this is being corrected"}
          </Label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Logged against the wrong patient — this was Ravi Kumar's call."
          />
        </section>

        {touched && problems.length > 0 && (
          <section className="card-surface p-4">
            <p className="text-sm font-semibold text-danger">Still needed</p>
            <ul className="mt-2 space-y-1">
              {problems.map((problem) => (
                <li key={problem} className="text-sm text-muted-foreground">
                  {problem}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="card-surface flex flex-wrap items-center gap-3 p-4">
          <Button onClick={post}>
            <Save className="h-5 w-5" />
            Post the correction
          </Button>
          <p className="text-xs text-muted-foreground">
            {changed.length
              ? describeCorrection(changed)
              : "Change what was wrong, then post it."}
          </p>
        </div>
      </div>
    </>
  );
}
