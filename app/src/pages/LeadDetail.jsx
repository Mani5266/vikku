import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, ListChecks, MessageSquare, Phone, Sliders, XCircle } from "lucide-react";
import { canSendMessage, nextAllowedSendAt, nextChannel, nextNurtureStep } from "@/lib/communicationEngine";
import { FOLLOWUP_PROTOCOLS } from "@/lib/followupProtocols";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import NoAccess from "@/components/shared/NoAccess";
import PageHeader from "@/components/shared/PageHeader";
import LeadJourney, { NextStepCard } from "@/components/shared/LeadJourney";
import { nextStep } from "@/lib/journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDateTime, relative } from "@/lib/utils";

// A2. Lead Detail (360 View) — Thesis §3, §4, §5, §29.
// Activity history is append-only: nothing on this screen edits a past record.

export default function LeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const lead = store.leadById(leadId);
  const { user } = useSession();
  // Screen access is not lead access: an agent may open A2, but only for their own leads.
  const owned = canOpenLead(user, lead);
  const communications = store.communicationsFor(leadId);
  const interactions = store.interactionsFor(leadId);

  const timeline = useMemo(() => {
    const fromComms = communications.map((c) => ({
      id: c.id,
      at: c.sent_at || c.scheduled_at,
      kind: c.suppressed ? "suppressed" : "message",
      title: `${c.channel} — ${c.template_name || "ad hoc"}`,
      detail: c.suppressed
        ? c.suppression_reason
        : [c.delivery_status, c.replied_at ? "patient replied" : null, c.link_clicked ? "link clicked" : null]
            .filter(Boolean)
            .join(" · "),
    }));
    const fromCalls = interactions.map((i) => ({
      id: i.id,
      at: i.interaction_date,
      kind: "call",
      title: `Call — ${i.contact_outcome}${i.not_connected_reason ? ` (${i.not_connected_reason})` : ""}`,
      detail: i.patient_said || i.feedback || "—",
      extra: i.next_action ? `Next: ${i.next_action} at ${formatDateTime(i.next_action_at)}` : null,
    }));
    return [...fromComms, ...fromCalls].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [communications, interactions]);

  if (!lead) return <div className="p-4 text-sm text-muted-foreground">Lead not found.</div>;
  if (!owned) return <NoAccess screen="A2" />;

  const verdict = canSendMessage({ plan: lead.plan, lead, communications, now: new Date() });
  const protocol = FOLLOWUP_PROTOCOLS[lead.plan?.temperature];
  const due = nextNurtureStep(communications);

  return (
    <>
      <PageHeader
        screen="A2"
        title={lead.patient_name}
        subtitle={`${lead.disease} · ${lead.source} · ${lead.campaign}`}
        thesis="§3, §4, §5, §29"
        back={{ to: "/", label: "Back to queue" }}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate(`/leads/${lead.id}/call`)}>
              <Phone className="h-3.5 w-3.5" />
              Log call
            </Button>
            <Button size="sm" onClick={() => navigate(`/leads/${lead.id}/compose`)}>
              <MessageSquare className="h-3.5 w-3.5" />
              Send message
            </Button>
          </>
        }
      />

      <LeadJourney lead={lead} current={null} />

      <div className="px-4 pt-4">
        {/* One instruction. Everything below it is reference — this is the thing an agent reads. */}
        <NextStepCard step={nextStep(lead, { messageAllowed: verdict.allowed, messageReason: verdict.reason })} />
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Identity and consent</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="Phone" value={lead.phone_number} />
              <Field label="Lead type" value={lead.lead_type} />
              <Field label="Branch" value={lead.branch} />
              <Field label="Agent" value={lead.agent_name} />
              <Field label="RCS support" value={lead.rcs_supported === false ? "No — MMS fallback" : "Yes"} />
              <Field label="Number valid" value={lead.number_valid === false ? "No" : "Yes"} />
              <Field label="Opted out" value={lead.opted_out ? "Yes" : "No"} />
              <Field label="Lifecycle stage" value={`${lead.stage} — ${lead.lead_status}`} />
            </CardContent>
          </Card>

          {protocol && (
            <Card>
              <CardHeader>
                <CardTitle>{protocol.label} — day {lead.plan.day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {protocol.steps.map((step) => (
                  <div
                    key={step.day}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs",
                      step.day === lead.plan.day && "border-primary bg-primary/5",
                      step.day < lead.plan.day && "opacity-60"
                    )}
                  >
                    <span className="w-14 font-medium">Day {step.day}</span>
                    <span className="flex-1">{step.callActivity}</span>
                    <Badge variant={step.messageRequired ? "secondary" : "outline"}>
                      {step.messageRequired ? step.messageChannel : "no message"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity history — append-only</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timeline.map((item) => (
                <div key={item.id} className="rounded-md border p-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(item.at)} · {relative(item.at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  {item.extra && <p className="mt-0.5 text-xs">{item.extra}</p>}
                </div>
              ))}
              {timeline.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* The four screens that move a lead forward. Before these existed the only things an
              agent could do from here were call and message, so a qualified lead with a booked
              appointment had nowhere to record either. */}
          <Card>
            <CardHeader>
              <CardTitle>What to do with this lead</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => navigate(`/leads/${lead.id}/qualify`)}>
                <Sliders className="h-4 w-4" />
                {lead.qualification ? "Re-qualify — eleven questions" : "Qualify — eleven questions"}
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate(`/leads/${lead.id}/plan`)}>
                <ListChecks className="h-4 w-4" />
                {lead.plan?.temperature ? `Follow-up plan — ${lead.plan.temperature}` : "Follow-up plan"}
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate(`/leads/${lead.id}/appointment`)}>
                <CalendarCheck className="h-4 w-4" />
                {lead.appointment?.state ? `Appointment — ${lead.appointment.state}` : "Book an appointment"}
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate(`/leads/${lead.id}/close`)}>
                <XCircle className="h-4 w-4" />
                {lead.closure ? `Closed — ${lead.closure.reason}` : "Close with a reason"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next action rail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Message guard" value={verdict.allowed ? `Clear — ${verdict.channel}` : verdict.code.replace(/_/g, " ")} />
              <p className="text-xs text-muted-foreground">{verdict.reason || "All guards passed."}</p>
              <Field label="Next allowed send" value={formatDateTime(nextAllowedSendAt(communications))} />
              <Field label="Rotation expects" value={nextChannel(communications, { rcsSupported: lead.rcs_supported !== false })} />
              <Field label="Nurture step due" value={due.label ? `${due.step}. ${due.label}` : "sequence exhausted"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suppressions on this lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {communications
                .filter((c) => c.suppressed)
                .map((c) => (
                  <div key={c.id} className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                    <p className="font-medium">{c.channel} · {c.template_name || "—"}</p>
                    <p className="text-muted-foreground">{c.suppression_reason}</p>
                  </div>
                ))}
              {communications.every((c) => !c.suppressed) && (
                <p className="text-xs text-muted-foreground">None. A suppression here would be evidence a guard fired.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
