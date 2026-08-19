import React, { useMemo, useState } from "react";
import { Ban, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import Tabs from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { JOURNEYS } from "@/store/journeys";
import { recoveryRates, rupees } from "@/lib/funnel";
import {
  excludedFromPool,
  reactivationPool,
  recoveryCampaigns,
  recoveryResultsByReason,
  segmentation,
} from "@/lib/recovery";

// O4. Recovery & Reactivation Console — turn the lost pool back into revenue.
//
// §19 asks one question of the lost pile: how much of it can still produce revenue? §20
// then says which leads may be worked and which may never be, and that list is a guard
// rather than a filter — there is no override control on this screen because the library
// exposes no way to add an excluded lead to a campaign.
//
// The exclusions panel exists for the same reason the suppression rows exist in the
// composer: a refusal is evidence that a rule fired, not a lead quietly dropped.

const TABS = [
  { value: "segments", label: "Segments" },
  { value: "campaigns", label: "Recovery campaigns" },
  { value: "pool", label: "90-day pool" },
  { value: "excluded", label: "Excluded" },
  { value: "results", label: "Results" },
];

export default function RecoveryConsole() {
  const rows = JOURNEYS;
  const [tab, setTab] = useState("segments");

  const segments = useMemo(() => segmentation(rows), [rows]);
  const campaigns = useMemo(() => recoveryCampaigns(rows), [rows]);
  const pool = useMemo(() => reactivationPool(rows), [rows]);
  const excluded = useMemo(() => excludedFromPool(rows), [rows]);
  const results = useMemo(() => recoveryResultsByReason(rows), [rows]);
  const recovery = useMemo(() => recoveryRates(rows), [rows]);

  return (
    <>
      <PageHeader
        screen="O4"
        title="Recovery & Reactivation Console"
        subtitle="The four §19 segments, the campaigns §30.9 names, and the 90-day pool §20 allows — with its exclusions enforced."
        thesis="§18–20, §30.9"
        actions={<Tabs items={TABS} value={tab} onChange={setTab} className="w-fit" />}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Closed leads" value={segments.closed} detail="each carries a §23 reason" />
          <StatTile
            label="Still winnable"
            value={segments.winnable}
            detail={`${segments.winnableShare}% of the closed pool — Recoverable plus Long-Term Nurture`}
          />
          <StatTile
            label="Gross package value in that pool"
            value={rupees(segments.estimatedValue)}
            detail="package value, not margin — an upper bound on what re-working it could bill"
          />
          <StatTile
            label="Expired lead recovery"
            value={`${recovery.expiredRecoveryRate}%`}
            detail={`${recovery.reactivationConverted} conversions from ${recovery.reactivated} reactivation sequences`}
          />
        </div>

        {tab === "segments" && (
          <>
            <DataTable
              title="Expired lead segmentation"
              caption="§19. The value column is filled only for the two segments that can still bill; Genuine Lost and Invalid are deliberately zero rather than optimistic."
              columns={[
                { key: "value", label: "Segment" },
                { key: "leads", label: "Leads", align: "right" },
                { key: "share", label: "% of closed", align: "right" },
                { key: "quotedLeads", label: "With a real quote", align: "right" },
                { key: "valueLabel", label: "Gross package value", align: "right" },
                { key: "note", label: "What is in it" },
              ]}
              rows={segments.segments.map((s) => ({
                id: s.value,
                value: s.value,
                leads: s.leads,
                share: s.share,
                quotedLeads: s.quotedLeads,
                valueLabel: s.estimatedValue ? rupees(s.estimatedValue) : "—",
                note: s.note,
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Value is computed from the package actually quoted where the lead reached that stage, and from the
              treatment's package band where it did not. It is gross billing, not contribution — the point of the
              figure is to be compared against the cost of new lead generation, which is the §2 argument.
            </p>
          </>
        )}

        {tab === "campaigns" && (
          <DataTable
            title="Recovery campaigns"
            caption="§30.9. Each campaign may only work the closure reasons listed against it, and only leads the §20 guard admits — which is why an eligible count can be small."
            columns={[
              { key: "value", label: "Campaign" },
              { key: "owner", label: "Owner" },
              { key: "eligible", label: "Eligible", align: "right" },
              { key: "valueLabel", label: "Gross value", align: "right" },
              { key: "sent", label: "Sent", align: "right" },
              { key: "replied", label: "Replied", align: "right" },
              { key: "replyRate", label: "Reply %", align: "right" },
              { key: "converted", label: "Converted", align: "right" },
              { key: "recoveryRate", label: "Recovery %", align: "right" },
              { key: "revenueLabel", label: "Revenue", align: "right" },
              { key: "content", label: "Content" },
            ]}
            rows={campaigns.map((c) => ({
              id: c.value,
              value: c.value,
              owner: c.owner,
              eligible: c.eligible,
              valueLabel: rupees(c.estimatedValue),
              sent: c.sent,
              replied: c.replied,
              replyRate: c.replyRate,
              converted: c.converted,
              recoveryRate: c.recoveryRate,
              revenueLabel: rupees(c.revenue),
              content: c.content,
            }))}
          />
        )}

        {tab === "pool" && (
          <>
            <div className="flex items-start gap-3 card-surface p-4 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{pool.length} leads the pool admits</p>
                <p className="mt-0.5 text-muted-foreground">
                  Every one is past its review date, carries a reason that maps to real content, and sits in a
                  segment §19 allows. Reactivation is a new activity on the same alternating framework — WhatsApp
                  first, RCS/MMS next, with the 48-hour floor still applying — never a resumption of the original
                  plan.
                </p>
              </div>
            </div>
            <DataTable
              title="90-day reactivation pool"
              caption="Content is matched to the closure reason, because §11 blocks a generic 'are you still interested' send."
              columns={[
                { key: "patient_name", label: "Patient" },
                { key: "phone_number", label: "Mobile" },
                { key: "disease", label: "Disease" },
                { key: "loss_category", label: "Closed under" },
                { key: "loss_reason", label: "Reason" },
                { key: "days_since_closure", label: "Days since closure", align: "right" },
                { key: "review_date", label: "Review date" },
                { key: "content", label: "Reactivation content" },
                { key: "first_channel", label: "First touch" },
                { key: "next_channel", label: "Next touch" },
                { key: "valueLabel", label: "Gross value", align: "right" },
              ]}
              rows={pool.map((lead) => ({ ...lead, valueLabel: rupees(lead.value) }))}
            />
          </>
        )}

        {tab === "excluded" && (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/5 p-4 text-sm">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{excluded.length} leads the pool refuses</p>
                <p className="mt-0.5 text-muted-foreground">
                  §20's exclusion list is enforced, not advisory. There is no override control on this screen
                  because <code>reactivationPool()</code> is the only way into a campaign and it does not accept
                  one. A refusal is kept as a record so the rule can be seen to have fired.
                </p>
              </div>
            </div>
            <DataTable
              title="Excluded from reactivation"
              columns={[
                { key: "patient_name", label: "Patient" },
                { key: "loss_reason", label: "Closure reason" },
                { key: "segment", label: "Segment" },
                { key: "days_since_closure", label: "Days since closure", align: "right" },
                { key: "excluded_because", label: "Excluded because" },
              ]}
              rows={excluded}
            />
          </>
        )}

        {tab === "results" && (
          <>
            <DataTable
              title="Reactivation results by closure reason"
              caption="Reason-wise, because §20 says reactivation is reason-based activity rather than a second round of the same follow-up."
              columns={[
                { key: "value", label: "Closed under" },
                { key: "sent", label: "Sequences sent", align: "right" },
                { key: "replied", label: "Replied", align: "right" },
                { key: "converted", label: "Converted", align: "right" },
                { key: "recoveryRate", label: "Recovery %", align: "right" },
                { key: "revenueLabel", label: "Revenue", align: "right" },
              ]}
              rows={results.map((r) => ({ id: r.value, ...r, revenueLabel: rupees(r.revenue) }))}
            />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{`Not Connected recovery ${recovery.notConnectedRecoveryRate}%`}</Badge>
              <Badge variant="outline">{`No-show recovery ${recovery.noShowRecoveryRate}%`}</Badge>
              <Badge variant="outline">{`Expired lead recovery ${recovery.expiredRecoveryRate}%`}</Badge>
            </div>
          </>
        )}
      </div>
    </>
  );
}
