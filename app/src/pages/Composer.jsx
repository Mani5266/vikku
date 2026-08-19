import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  MESSAGE_FLOOR_HOURS,
  NURTURE_SEQUENCE,
  canSendMessage,
  hoursSinceLastMessage,
  lastSent,
  nextAllowedSendAt,
  nextChannel,
  nextNurtureStep,
  plannedMessageForDay,
} from "@/lib/communicationEngine";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import NoAccess from "@/components/shared/NoAccess";
import PageHeader from "@/components/shared/PageHeader";
import LeadJourney from "@/components/shared/LeadJourney";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn, formatDateTime, relative } from "@/lib/utils";

// A6. Communication Composer — Thesis §8, §9, §10, §11, §30.4.
// Every guard on this screen is canSendMessage() from
// implementation/src/lib/communicationEngine.js. The UI states the verdict;
// it does not re-implement any rule.

const HARD_STOPS = ["OPTED_OUT", "DO_NOT_CONTACT", "INVALID_NUMBER", "CONVERTED"];

export default function Composer() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useStore();
  const { templates, sendCommunication, recordSuppressed } = store;

  const lead = store.leadById(leadId);
  const { user } = useSession();
  // Screen access is not lead access: an agent may open A2, but only for their own leads.
  const owned = canOpenLead(user, lead);
  const communications = store.communicationsFor(leadId);
  const [templateId, setTemplateId] = useState(null);

  const now = new Date();
  const last = lastSent(communications);
  const elapsed = hoursSinceLastMessage(communications, now);
  const expected = nextChannel(communications, { rcsSupported: lead?.rcs_supported !== false });
  const due = nextNurtureStep(communications);
  const planned = plannedMessageForDay(lead?.plan?.temperature, lead?.plan?.day);
  const template = templates.find((t) => t.id === templateId) || null;

  const usedSteps = useMemo(
    () => new Set(communications.filter((c) => c.sent_at && !c.suppressed).map((c) => c.nurture_step)),
    [communications]
  );

  const eligibleTemplates = useMemo(
    () =>
      templates.filter((t) => {
        if (t.approval_status !== "Approved") return false; // only approved content reaches the composer
        if (expected === "MMS") return t.channel === "RCS" || t.channel === "MMS";
        return t.channel === expected;
      }),
    [templates, expected]
  );

  const verdict = useMemo(
    () =>
      lead
        ? canSendMessage({ plan: lead.plan, lead, template, communications, channel: expected, now: new Date() })
        : null,
    [lead, template, communications, expected]
  );

  const overrideVerdict = useMemo(
    () =>
      lead
        ? canSendMessage({
            plan: lead.plan,
            lead,
            template,
            communications,
            channel: expected,
            now: new Date(),
            managerOverride: true,
          })
        : null,
    [lead, template, communications, expected]
  );

  if (!lead) return <div className="p-4 text-sm text-muted-foreground">Lead not found.</div>;
  if (!owned) return <NoAccess screen="A2" />;

  const blockedByHardStop = !verdict.allowed && HARD_STOPS.includes(verdict.code);
  const overrideAvailable = !verdict.allowed && verdict.code === "TOO_SOON" && overrideVerdict.allowed;

  const attemptSend = ({ managerOverride = false, schedule = false } = {}) => {
    const v = canSendMessage({
      plan: lead.plan,
      lead,
      template,
      communications,
      channel: expected,
      now: new Date(),
      managerOverride,
    });

    if (!v.allowed) {
      // Section 12: a blocked send is written as a suppressed row, never dropped.
      recordSuppressed({ lead, template, channel: expected, code: v.code, reason: v.reason });
      toast({
        title: `Blocked — ${v.code.replace(/_/g, " ")}`,
        description: `${v.reason} Recorded as a suppressed communication.`,
        variant: "destructive",
      });
      return;
    }

    if (!template) {
      toast({ title: "Pick a template", description: "Sends carry approved content only.", variant: "destructive" });
      return;
    }

    sendCommunication({
      lead,
      template,
      channel: v.channel,
      nurtureStep: template.nurture_step,
      verdict: v,
      schedule,
    });

    toast({
      title: schedule ? "Scheduled" : v.code === "OVERRIDE" ? "Sent under manager exception" : "Sent",
      description: schedule
        ? `Queued for ${formatDateTime(v.nextAllowedAt || nextAllowedSendAt(communications))} on ${v.channel}.`
        : `${template.name} on ${v.channel}.${v.requiresAudit ? " Written to the audit log." : ""}`,
    });
    setTemplateId(null);
  };

  return (
    <>
      <PageHeader
        screen="A6"
        title={`Send a message — ${lead.patient_name}`}
        subtitle="Part of working the plan. The channel is picked by the rotation, not by you, and the 48-hour floor decides whether it can go at all."
        thesis="§8, §9, §10, §11, §30.4"
        back={{ to: `/leads/${lead.id}`, label: "Back to lead" }}
      />

      <LeadJourney lead={lead} current="plan" />

      <div className="grid gap-4 p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <GuardBanner verdict={verdict} overrideAvailable={overrideAvailable} />

          <Card>
            <CardHeader>
              <CardTitle>Nurture position — Section 11</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {NURTURE_SEQUENCE.map((label, index) => {
                const step = index + 1;
                const done = usedSteps.has(step);
                const isDue = due.step === step;
                return (
                  <span
                    key={label}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      done && "opacity-40 line-through",
                      isDue && "border-primary bg-primary/10 font-medium text-primary"
                    )}
                  >
                    {step}. {label}
                  </span>
                );
              })}
              {due.step === null && (
                <p className="text-xs text-muted-foreground">Sequence exhausted — this patient needs a decision, not another message.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Template picker — approved only, filtered to {expected}
                {due.label ? ` · due step: ${due.label}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {eligibleTemplates.map((t) => {
                const alreadySent = communications.some((c) => c.template_id === t.id && c.sent_at && !c.suppressed);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition-colors hover:bg-accent",
                      templateId === t.id && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="outline">
                        {t.nurture_step}. {t.nurture_label}
                      </Badge>
                      <Badge variant="secondary">{t.media_type}</Badge>
                      {t.is_price_offer && <Badge variant="warning">price offer</Badge>}
                      {t.is_surgery_push && <Badge variant="warning">surgery push</Badge>}
                      {alreadySent && <Badge variant="destructive">already sent</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Purpose: {t.purpose}</p>
                  </button>
                );
              })}
              {eligibleTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No approved {expected} template exists yet. Create one in the Template Library.
                </p>
              )}
            </CardContent>
          </Card>

          {template && (
            <Card>
              <CardHeader>
                <CardTitle>Preview — {expected}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{template.body}</p>
                  {template.media_type !== "None" && (
                    <p className="mt-2 text-xs text-muted-foreground">Attachment: {template.media_type}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => attemptSend()} disabled={blockedByHardStop}>
              <Send className="h-4 w-4" />
              Send now
            </Button>
            <Button variant="outline" onClick={() => attemptSend({ schedule: true })} disabled={blockedByHardStop || !template}>
              <CalendarClock className="h-4 w-4" />
              Schedule at next allowed slot
            </Button>
            {overrideAvailable && (
              <Button variant="destructive" onClick={() => attemptSend({ managerOverride: true })} disabled={!template}>
                <ShieldAlert className="h-4 w-4" />
                Request exception send (manager)
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate(`/leads/${lead.id}/call`)}>
              Call instead — never blocked
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cadence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Last channel used" value={last ? last.channel : "none yet"} />
              <Row label="Hours since last message" value={Number.isFinite(elapsed) ? `${Math.floor(elapsed)}h of ${MESSAGE_FLOOR_HOURS}h` : "—"} />
              <Row label="Next allowed send" value={formatDateTime(nextAllowedSendAt(communications))} />
              <Row label="Rotation expects" value={expected} />
              <Row label="RCS supported" value={lead.rcs_supported === false ? "No — MMS fallback" : "Yes"} />
              <Row
                label={`Protocol day ${lead.plan?.day}`}
                value={planned ? `${planned.channel} — ${planned.activity}` : "No routine message scheduled"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History strip — last five</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...communications]
                .sort((a, b) => new Date(b.sent_at || b.scheduled_at) - new Date(a.sent_at || a.scheduled_at))
                .slice(0, 5)
                .map((c) => (
                  <div key={c.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.channel}</span>
                      <Badge variant={c.suppressed ? "destructive" : c.replied_at ? "success" : "secondary"}>
                        {c.delivery_status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{c.template_name || "—"}</p>
                    <p className="text-muted-foreground">
                      {c.suppressed ? c.suppression_reason : relative(c.sent_at || c.scheduled_at)}
                    </p>
                  </div>
                ))}
              {communications.length === 0 && <p className="text-xs text-muted-foreground">No communications yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function GuardBanner({ verdict, overrideAvailable }) {
  const allowed = verdict.allowed;
  const Icon = allowed ? ShieldCheck : verdict.code === "TOO_SOON" ? Clock : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        allowed ? "border-emerald-600/40 bg-emerald-600/10" : "border-destructive/40 bg-destructive/10"
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5", allowed ? "text-emerald-700" : "text-destructive")} />
      <div className="text-sm">
        <p className="font-medium">
          {allowed ? (
            <>
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
              Clear to send on {verdict.channel}
            </>
          ) : (
            verdict.code.replace(/_/g, " ")
          )}
        </p>
        <p className="text-muted-foreground">{verdict.reason || "All guards passed."}</p>
        {verdict.nextAllowedAt && (
          <p className="text-muted-foreground">Next allowed at {formatDateTime(verdict.nextAllowedAt)}.</p>
        )}
        {overrideAvailable && (
          <p className="mt-1 text-xs">
            A manager may override the cadence floor. The exception is written to the audit log with the approver's name.
          </p>
        )}
      </div>
    </div>
  );
}
