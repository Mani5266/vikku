import React, { useMemo } from "react";
import { Copy, Radio } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import {
  DUPLICATE_WINDOW_DAYS,
  attributionAudit,
  campaignHierarchy,
  duplicateCandidates,
  sourceRegistry,
} from "@/lib/sourceRegistry";

// S1. Lead Intake & Source Configuration.
//
// One rule, and the whole screen is built to show whether it holds: no lead enters without a
// complete source. §3.1 names five mandatory fields; the audit below checks the leads that
// actually arrived against all five and reports what each absence costs downstream.
//
// Two of the five are missing on every record in the system. That is why leadership can rank a
// campaign and can never rank a creative — the hierarchy is truncated here, at intake, and this
// is the screen that says so.

export default function LeadSources() {
  const rows = JOURNEYS;

  const registry = useMemo(() => sourceRegistry(rows), [rows]);
  const audit = useMemo(() => attributionAudit(rows), [rows]);
  const hierarchy = useMemo(() => campaignHierarchy(rows), [rows]);
  const duplicates = useMemo(() => duplicateCandidates(rows), [rows]);

  const live = registry.filter((line) => line.live);
  const silent = registry.filter((line) => !line.live);
  const incomplete = audit.filter((line) => !line.enforced);

  return (
    <>
      <PageHeader
        screen="S1"
        title="Lead Sources & Intake"
        subtitle="The seventeen §5 sources, and whether the leads arriving through them carry what §3.1 makes mandatory."
        thesis="§5, §3.1, §30.1"
      />

      <div className="space-y-6 p-4">
        <SectionCard title="What is actually enforced at intake">
          <p className="text-lg font-semibold">
            {`${incomplete.length} of the five mandatory attribution fields are missing on every lead in the system.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {`${live.length} of the seventeen registered sources are producing leads. ${silent.length} are configured and silent — kept on the list on purpose, because a source that stopped producing is exactly the row a marketing lead needs to see.`}
          </p>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Live sources" value={live.length} icon={Radio} detail={`of ${registry.length} registered`} />
          <StatTile label="Leads attributed" value={rows.length.toLocaleString("en-IN")} detail="Every one carries a source and a campaign" />
          <StatTile
            label="Fields not enforced"
            value={incomplete.length}
            tone="bad"
            detail="Of the five §3.1 requires"
          />
          <StatTile
            label="Possible duplicates"
            value={duplicates.strongCount + duplicates.weakCount}
            icon={Copy}
            tone={duplicates.strongCount ? "warn" : "default"}
            detail={`${duplicates.strongCount} on a shared phone number`}
          />
        </div>

        <DataTable
          title="The §3.1 attribution audit"
          caption="Per mandatory field: how many leads carry it, and what its absence blocks. A completeness figure with nothing beside it reads as a data-quality nit rather than as the reason a leadership screen stops working."
          columns={[
            { key: "value", label: "Mandatory field" },
            { key: "present", label: "Present", align: "right" },
            { key: "missing", label: "Missing", align: "right" },
            { key: "completenessLabel", label: "Completeness", align: "right" },
            { key: "enforcedLabel", label: "Enforced" },
            { key: "blocks", label: "What its absence blocks" },
          ]}
          rows={audit.map((line) => ({
            ...line,
            completenessLabel: `${line.completeness}%`,
            enforcedLabel: line.enforced ? "Yes" : "No",
          }))}
        />

        <SectionCard
          title="The campaign hierarchy, as deep as the data goes"
          caption={`§5 describes six rungs. This walks ${hierarchy.depth} and stops.`}
        >
          <div className="flex flex-wrap gap-2">
            {hierarchy.rungs.map((rung) => (
              <StatusPill
                key={rung}
                status={rung}
                tone={hierarchy.missingRungs.includes(rung) ? "bad" : "good"}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {`${hierarchy.missingRungs.join(", ")} are never captured, so a campaign can be ranked and a creative cannot. Campaign ROI already carries this limit; it starts here.`}
          </p>
          <ul className="mt-4 space-y-3">
            {hierarchy.tree.map((node) => (
              <li key={node.source}>
                <p className="text-sm font-semibold">{`${node.source} · ${node.leads} leads`}</p>
                <ul className="mt-1 space-y-1 pl-4">
                  {node.campaigns.map((campaign) => (
                    <li key={campaign.campaign} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span>{campaign.campaign}</span>
                      <span className="num text-muted-foreground">
                        {`${campaign.leads} leads · ${campaign.converted} surgeries · ${campaign.diseases.length} disease(s)`}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </SectionCard>

        <DataTable
          title="The source registry"
          caption="All seventeen §5 sources. Where the ad platform's name differs from the specification's, the two are folded into one row — reporting Meta Ads and Facebook separately produces two half-funnels and no decision."
          columns={[
            { key: "value", label: "Source" },
            { key: "platform", label: "Platform" },
            { key: "paidLabel", label: "Paid" },
            { key: "arrivesAs", label: "Arrives as" },
            { key: "leads", label: "Leads", align: "right" },
            { key: "campaigns", label: "Campaigns", align: "right" },
            { key: "converted", label: "Surgeries", align: "right" },
            { key: "admissionRateLabel", label: "Per 100 leads", align: "right" },
            { key: "revenueLabel", label: "Revenue", align: "right" },
            { key: "stateLabel", label: "State" },
          ]}
          rows={registry.map((line) => ({
            ...line,
            paidLabel: line.paid ? "Paid" : "Owned",
            admissionRateLabel: `${line.admissionRate}%`,
            revenueLabel: line.revenue ? rupees(line.revenue) : "—",
            stateLabel: line.unmapped ? "Unmapped — register it" : line.live ? "Live" : "Configured, silent",
          }))}
        />

        <SectionCard
          title="Duplicate detection"
          caption={`Matching inside a ${DUPLICATE_WINDOW_DAYS}-day window. A shared phone number is almost always the same person; two people with the same name and the same condition is a Tuesday in a hospital of this size, so the two rules never share a count.`}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">{`Strong — same phone number: ${duplicates.strongCount}`}</p>
              <ul className="mt-2 space-y-1">
                {duplicates.strong.slice(0, 10).map((entry) => (
                  <li key={entry.key} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="num">{entry.match}</span>
                    <span className="text-muted-foreground">
                      {`${entry.leads} records · ${entry.sources} · keeps ${entry.keeps}`}
                    </span>
                  </li>
                ))}
                {duplicates.strongCount === 0 && (
                  <li className="text-xs text-muted-foreground">No phone number appears twice inside the window.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">{`Weak — same name and condition: ${duplicates.weakCount}`}</p>
              <ul className="mt-2 space-y-1">
                {duplicates.weak.slice(0, 10).map((entry) => (
                  <li key={entry.key} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span>{entry.match}</span>
                    <span className="text-muted-foreground">{`${entry.leads} records · ${entry.sources}`}</span>
                  </li>
                ))}
                {duplicates.weakCount === 0 && (
                  <li className="text-xs text-muted-foreground">No name-and-condition pair repeats inside the window.</li>
                )}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            The earliest record wins a merge, because attribution belongs to the touch that generated
            the lead rather than to the one that re-entered it. Merging itself is not built.
          </p>
        </SectionCard>

        <SectionCard
          title="Specified here and not built"
          caption="Stated per item rather than implied by absence."
        >
          <ul className="space-y-2 text-sm">
            {[
              ["Integrations", "Webhooks, ad platform connections, IVR and call-tracking numbers, CSV import, and the per-integration status and field mapping."],
              ["Editing the registry", "Adding a source, building a campaign hierarchy, and setting the intake SLA. The registry reads; it does not write."],
              ["The manual entry form", "The §3.1 write-layer guard exists and is tested. The form that would call it does not."],
              ["Merging duplicates", "The candidates are detected and ranked. Nothing merges them."],
            ].map(([title, detail]) => (
              <li key={title} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{title}</span>
                <span className="max-w-2xl text-xs text-muted-foreground">{detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
