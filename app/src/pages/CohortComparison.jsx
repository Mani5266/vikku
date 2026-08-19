import React, { useMemo, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import Tabs from "@/components/ui/tabs";
import { JOURNEYS } from "@/store/journeys";
import { cohortComparison, comparableDiseases } from "@/lib/cohorts";

// L3. Cohort Comparison — what did converted patients receive that non-converted
// patients did not?
//
// §21 argues this comparison is worth more than staring at the lost pile, and §22 gives
// the factor list. Two things keep it honest:
//
//   · every factor states the population it is a rate of, because several of them are
//     structurally downstream of conversion and "100% against 6%" would be arithmetic
//     rather than a finding;
//   · the source mix of both cohorts is printed above the table, so a gap cannot be read
//     as process when it is really a difference in what each cohort was made of.

export default function CohortComparison() {
  const rows = JOURNEYS;
  const diseases = useMemo(() => comparableDiseases(rows), [rows]);
  const [disease, setDisease] = useState("all");

  const comparison = useMemo(
    () => cohortComparison(rows, disease === "all" ? null : disease),
    [rows, disease]
  );

  const tabs = [{ value: "all", label: "All treatment categories" }, ...diseases.map((d) => ({ value: d, label: d }))];

  return (
    <>
      <PageHeader
        screen="L3"
        title="Cohort Comparison"
        subtitle="The §22 factor table, converted against non-converted, per treatment category."
        thesis="§21, §22"
      />

      <div className="space-y-6 p-6">
        <Tabs items={tabs} value={disease} onChange={setDisease} className="w-fit" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Converted" value={comparison.convertedCount} detail="completed treatment" />
          <StatTile
            label="Non-converted"
            value={comparison.nonConvertedCount}
            detail="finished journeys only — leads still in play are excluded"
          />
          <StatTile label="Converted source mix" value=" " detail={comparison.convertedSourceMix} />
          <StatTile label="Non-converted source mix" value=" " detail={comparison.nonConvertedSourceMix} />
        </div>

        <DataTable
          title={`Converted against non-converted — ${comparison.disease}`}
          caption="The Base column is the population each rate is computed over. Read the gap only against the base beside it."
          columns={[
            { key: "factor", label: "Factor" },
            { key: "base", label: "Base" },
            { key: "convertedBase", label: "n (converted)", align: "right" },
            { key: "converted", label: "Converted", align: "right" },
            { key: "nonConvertedBase", label: "n (non-converted)", align: "right" },
            { key: "nonConverted", label: "Non-converted", align: "right" },
            { key: "gap", label: "Gap", align: "right" },
          ]}
          rows={comparison.factors.map((f, index) => ({ id: `f${index}`, ...f }))}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            title="Conversion pattern"
            caption="What the converted cohort actually received, each line with the number of patients behind it."
            columns={[
              { key: "label", label: "Received" },
              { key: "leads", label: "Patients", align: "right" },
              { key: "share", label: "% of cohort", align: "right" },
            ]}
            rows={comparison.patterns.conversion.map((line, index) => ({ id: `c${index}`, ...line }))}
            empty="No converted patients in this category yet."
          />
          <DataTable
            title="Non-conversion pattern"
            caption="What the non-converted cohort was missing. These are the process rules worth writing."
            columns={[
              { key: "label", label: "Missing or delayed" },
              { key: "leads", label: "Leads", align: "right" },
              { key: "share", label: "% of cohort", align: "right" },
            ]}
            rows={comparison.patterns.nonConversion.map((line, index) => ({ id: `n${index}`, ...line }))}
            empty="No finished non-converted journeys in this category."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          A line in the conversion pattern only becomes a process rule once it survives the base check above
          it. "Financial counseling completed before booking" is a rule worth enforcing; "patient visited the
          hospital" is not a rule, it is the definition of a visit.
        </p>
      </div>
    </>
  );
}
