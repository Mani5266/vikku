import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Link2, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import LeadJourney from "@/components/shared/LeadJourney";
import NoAccess from "@/components/shared/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import { NON_CONVERSION_CATEGORIES, getReasonsForCategory, reasonDefaults } from "@/lib/reasonTaxonomy";
import { MIN_DETAIL, OWNERS, closureProblems, evidenceOptions, segmentFor } from "@/lib/closure";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// A9. Non-Conversion Reason Capture — the screen the whole product is arguing for.
//
// "Lead Expired" is an operational status wearing a business reason's clothes: it says the clock ran
// out, not why nobody bought. Every downstream question — which reasons are recoverable, what the
// 90-day pool contains, which corrective action a manager owes — reads a field that today gets typed
// as "not interested" and forgotten.
//
// The eight §23 fields are mandatory here, and one of them cannot be typed at all: `evidence_source`
// is a picker built from this lead's real calls and messages. A closure that cites nothing is the
// same unfalsifiable claim as a copy-pasted remark.

export default function CloseLead() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { leadById, interactionsFor, communicationsFor, updateLead, audit } = useStore();
  const { user } = useSession();

  const lead = leadById(leadId);

  const [draft, setDraft] = useState({
    category: null,
    reason: null,
    detail: "",
    evidenceId: null,
    recoverable: null,
    action: "",
    owner: null,
    reviewDate: "",
    competitor: "",
    learning: "",
  });
  const [touched, setTouched] = useState(false);

  const evidence = useMemo(() => {
    if (!lead) return [];
    return evidenceOptions({
      interactions: interactionsFor(lead.id),
      communications: communicationsFor(lead.id),
      appointment: lead.appointment,
    });
  }, [lead, interactionsFor, communicationsFor]);

  const problems = useMemo(
    () => closureProblems(draft, { evidenceIds: evidence.map((option) => option.id) }),
    [draft, evidence]
  );

  if (!lead) return <NoAccess screen="A9" />;
  if (!canOpenLead(user, lead)) return <NoAccess screen="A9" />;

  const reasons = getReasonsForCategory(draft.category);
  const defaults = draft.category && draft.reason ? reasonDefaults(draft.category, draft.reason) : null;
  const placement = draft.reason ? segmentFor(draft.category, draft.reason, draft.recoverable) : null;

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const pickReason = (reason) => {
    const suggested = reasonDefaults(draft.category, reason);
    set({
      reason,
      // The taxonomy's defaults are filled in rather than assumed — the agent can still disagree.
      recoverable: suggested?.recoverable ?? null,
      action: suggested?.action ?? "",
    });
  };

  const submit = () => {
    setTouched(true);
    if (problems.length) return;

    const cited = evidence.find((option) => option.id === draft.evidenceId);
    const closure = {
      ...draft,
      detail: draft.detail.trim(),
      segment: placement.segment,
      reactivation: placement.reactivation,
      evidence: cited ? { id: cited.id, kind: cited.kind, label: cited.label, when: cited.when } : null,
      closed_by: user?.name ?? null,
      closed_at: new Date().toISOString(),
    };

    updateLead(lead.id, {
      lead_status: "Closed — reason recorded",
      closure,
      plan: { closed: true },
    });

    audit?.({
      action: "lead_closed",
      lead_id: lead.id,
      actor: user?.name,
      detail: `${draft.category} / ${draft.reason} · ${placement.segment} · evidence ${cited?.kind}`,
    });

    navigate(`/leads/${lead.id}`);
  };

  return (
    <>
      <PageHeader
        screen="A9"
        title={`Close ${lead.patient_name}`}
        subtitle="No lead closes without a reason that can be checked. Eight fields, one of which cannot be typed."
        thesis="§3.3, §18, §19, §23"
        back={{ to: `/leads/${lead.id}`, label: lead.patient_name }}
      />

      <LeadJourney lead={lead} current="outcome" />

      <div className="space-y-6 p-4">
        {lead.closure && (
          <div className="flex items-start gap-2 rounded-lg bg-secondary p-4">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm">
              Already closed on {formatDateTime(lead.closure.closed_at)} — {lead.closure.category} /{" "}
              {lead.closure.reason}. Submitting again replaces that record.
            </p>
          </div>
        )}

        <SectionCard title="Why did this lead not convert?" caption="The §23 taxonomy, not free text.">
          <div className="flex flex-wrap gap-1">
            {NON_CONVERSION_CATEGORIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set({ category: option.value, reason: null, action: "", recoverable: null })}
                className={cn(
                  "rounded-md px-4 py-2 text-sm",
                  draft.category === option.value
                    ? "bg-primary-tint font-semibold text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {reasons.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Which one exactly?</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {reasons.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => pickReason(reason)}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm",
                      draft.reason === reason
                        ? "bg-primary-tint font-semibold text-primary"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="What actually happened"
          caption={`In your own words, at least ${MIN_DETAIL} characters. "Lead expired" is a status, not a reason.`}
        >
          <Textarea
            rows={3}
            value={draft.detail}
            onChange={(event) => set({ detail: event.target.value })}
            placeholder="They wanted the surgery but the son who decides is abroad until December."
          />
        </SectionCard>

        <SectionCard
          title="What is this based on?"
          caption="Pick the call or message that shows it. This is the one field that cannot be typed — a closure that cites nothing cannot be checked, which is exactly the problem this product exists to fix."
        >
          {evidence.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-4">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
              <p className="text-sm text-muted-foreground">
                There is nothing on this lead to cite — no call has been logged and no message sent.
                A lead with no activity cannot be closed with a diagnosed reason. Log the call first.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {evidence.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => set({ evidenceId: option.id })}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-4 py-2 text-left text-sm",
                    draft.evidenceId === option.id ? "bg-primary-tint text-primary" : "bg-secondary"
                  )}
                >
                  <Link2 className="mt-1 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {option.kind} · {formatDateTime(option.when)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Can we still win this?"
          caption={
            defaults
              ? `The taxonomy says ${defaults.recoverable ? "yes" : "no"} for this reason. Disagree if you were on the call.`
              : "Pick a reason first."
          }
        >
          <div className="flex flex-wrap gap-1">
            {[
              { value: true, label: "Yes — still winnable" },
              { value: false, label: "No — genuinely lost" },
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => set({ recoverable: option.value })}
                className={cn(
                  "rounded-md px-4 py-2 text-sm",
                  draft.recoverable === option.value
                    ? "bg-primary-tint font-semibold text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {placement && (
            <p className="mt-2 text-xs text-muted-foreground">
              Lands in <span className="font-semibold">{placement.segment}</span> · 90-day
              reactivation: {placement.reactivation}
            </p>
          )}

          {draft.recoverable === true && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="action" className="block text-sm font-semibold">
                  What we will do about it
                </label>
                <Input
                  id="action"
                  value={draft.action}
                  onChange={(event) => set({ action: event.target.value })}
                  placeholder="Suggested from the reason, editable"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Who owns it</p>
                <div className="flex flex-wrap gap-1">
                  {OWNERS.map((owner) => (
                    <button
                      key={owner}
                      type="button"
                      onClick={() => set({ owner })}
                      className={cn(
                        "rounded-md px-4 py-2 text-sm",
                        draft.owner === owner
                          ? "bg-primary-tint font-semibold text-primary"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {owner}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="review" className="block text-sm font-semibold">
                  Reviewed on
                </label>
                <Input
                  id="review"
                  type="date"
                  value={draft.reviewDate}
                  onChange={(event) => set({ reviewDate: event.target.value })}
                />
              </div>
            </div>
          )}
        </SectionCard>

        {(draft.category === "Competition" || draft.recoverable === false) && (
          <SectionCard
            title="What we learn from losing this one"
            caption="§18: a genuine loss is only worth what the next lead gains from it."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.category === "Competition" && (
                <div className="space-y-2">
                  <label htmlFor="competitor" className="block text-sm font-semibold">
                    Which hospital they chose
                  </label>
                  <Input
                    id="competitor"
                    value={draft.competitor}
                    onChange={(event) => set({ competitor: event.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="learning" className="block text-sm font-semibold">
                  What we would do differently
                </label>
                <Input
                  id="learning"
                  value={draft.learning}
                  onChange={(event) => set({ learning: event.target.value })}
                  placeholder="Optional, but it is the only thing a loss produces"
                />
              </div>
            </div>
          </SectionCard>
        )}

        <div className="space-y-2">
          {touched && problems.length > 0 && (
            <p className="text-sm text-destructive">Still needed: {problems.join(" · ")}</p>
          )}
          {!touched && problems.length > 0 && (
            <p className="text-sm text-muted-foreground">Still needed: {problems.join(" · ")}</p>
          )}
          <Button className="w-full" onClick={submit} disabled={problems.length > 0}>
            Close this lead
          </Button>
          <p className="text-xs text-muted-foreground">
            Recoverable closures enter the recovery pool and appear on the operations console.
            Genuine losses are excluded from the 90-day reactivation campaign — that exclusion is
            enforced, not described.
          </p>
        </div>
      </div>
    </>
  );
}
