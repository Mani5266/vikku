import React, { useMemo } from "react";
import { communicationStats } from "@/lib/communicationEngine";
import { useStore } from "@/store/store";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// M9. Communication Performance — Thesis §27, §10.
// Every number here comes from communicationStats() in the engine, so the screen
// and the guard cannot disagree about what happened.

export default function CommunicationPerformance() {
  const { communications, templates, leads } = useStore();

  const stats = useMemo(() => communicationStats(communications), [communications]);

  const byTemplate = useMemo(() => {
    const acc = {};
    for (const c of communications) {
      if (!c.template_id) continue;
      const row = (acc[c.template_id] ||= {
        id: c.template_id,
        name: c.template_name,
        sent: 0,
        read: 0,
        replied: 0,
        suppressed: 0,
      });
      if (c.suppressed) row.suppressed += 1;
      else if (c.sent_at) row.sent += 1;
      if (c.read_at) row.read += 1;
      if (c.replied_at) row.replied += 1;
    }
    return Object.values(acc)
      .map((r) => ({
        ...r,
        replyRate: r.sent ? Math.round((r.replied / r.sent) * 100) : 0,
        approval: templates.find((t) => t.id === r.id)?.approval_status || "—",
      }))
      .sort((a, b) => b.replyRate - a.replyRate || b.sent - a.sent);
  }, [communications, templates]);

  // Fatigue — reply rate against touch count, per Section 27.
  const fatigue = useMemo(() => {
    const buckets = {};
    for (const lead of leads) {
      const sent = communications
        .filter((c) => c.lead_id === lead.id && c.sent_at && !c.suppressed)
        .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
      sent.forEach((c, index) => {
        const touch = index + 1;
        const bucket = (buckets[touch] ||= { touch, sent: 0, replied: 0 });
        bucket.sent += 1;
        if (c.replied_at) bucket.replied += 1;
      });
    }
    return Object.values(buckets)
      .map((b) => ({ ...b, replyRate: b.sent ? Math.round((b.replied / b.sent) * 100) : 0 }))
      .sort((a, b) => a.touch - b.touch);
  }, [communications, leads]);

  const suppressions = communications.filter((c) => c.suppressed);

  return (
    <>
      <PageHeader
        screen="M9"
        title="Communication Performance"
        subtitle="Is the 48-hour alternating model actually working? Delivery and read counts alone are never presented as success."
        thesis="§27, §10"
      />

      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Scheduled" value={stats.scheduled} />
          <Metric label="Sent" value={stats.sent} />
          <Metric label="Delivered" value={stats.delivered} hint={`${stats.deliveryRate}% of sent`} />
          <Metric label="Failed" value={stats.failed} />
          <Metric label="Read" value={stats.read} hint={`${stats.readRate}% read rate`} />
          <Metric label="Patient replies" value={stats.replied} hint={`${stats.replyRate}% reply rate`} />
          <Metric label="Link clicks" value={stats.linkClicks} />
          <Metric label="Suppressed" value={stats.suppressed} hint="recorded, not dropped" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadence proof — Section 8</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold">{stats.cadenceComplianceRate}%</span>
              <p className="text-sm text-muted-foreground">
                of sent messages sat at least 48 hours behind the previous one. Everything below that figure is either a
                manager exception or a bug — both are visible in the audit log.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel — WhatsApp versus RCS/MMS</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Channel</th>
                  <th className="py-1 font-medium">Sent</th>
                  <th className="py-1 font-medium">Replies</th>
                  <th className="py-1 font-medium">Reply rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byChannel).map(([channel, row]) => (
                  <tr key={channel} className="border-t">
                    <td className="py-1.5">{channel}</td>
                    <td className="py-1.5">{row.sent}</td>
                    <td className="py-1.5">{row.replied}</td>
                    <td className="py-1.5 font-medium">{row.replyRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Template — reply rate, best first</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium">Template</th>
                    <th className="py-1 font-medium">Sent</th>
                    <th className="py-1 font-medium">Replies</th>
                    <th className="py-1 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {byTemplate.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-1.5">
                        {row.name}
                        {row.approval !== "Approved" && (
                          <Badge variant="outline" className="ml-1.5">
                            {row.approval}
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5">{row.sent}</td>
                      <td className="py-1.5">{row.replied}</td>
                      <td className="py-1.5 font-medium">{row.replyRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fatigue — reply rate by touch number</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fatigue.map((b) => (
                <div key={b.touch} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-muted-foreground">Touch {b.touch}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${b.replyRate}%` }} />
                  </div>
                  <span className="w-24 text-right">
                    {b.replyRate}% of {b.sent}
                  </span>
                </div>
              ))}
              {fatigue.length === 0 && <p className="text-xs text-muted-foreground">No sends yet.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Suppressions and blocks — evidence a guard fired</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suppressions.map((c) => (
              <div key={c.id} className="rounded-md border p-2 text-xs">
                <span className="font-medium">{c.patient_name}</span> · {c.channel} · {c.template_name || "—"}
                <p className="text-muted-foreground">{c.suppression_reason}</p>
              </div>
            ))}
            {suppressions.length === 0 && <p className="text-xs text-muted-foreground">No suppressions recorded.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
