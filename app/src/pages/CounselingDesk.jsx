import React, { useMemo, useState } from "react";
import { HandCoins, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import {
  NO_COUNSELING_REASON,
  PRICE_REASONS,
  closureProblems,
  counselingEffect,
  counselingQueue,
  coverage,
  discountEffect,
  gapAnalysis,
  insuranceMix,
} from "@/lib/counseling";

// O2. Financial Counseling Desk — the screen §33 was written about.
//
// Its worked example is four of seven price objectors who never received counseling, and a
// hospital that concluded from that it had a pricing problem. What it had was a process that
// stopped. The guard at the bottom of this screen is the fix, and it refuses in both
// directions — a price closure on a patient nobody counseled, and "counseling not completed"
// on a patient who was.

export default function CounselingDesk() {
  const rows = JOURNEYS;
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState(null);

  const queue = useMemo(() => counselingQueue(rows), [rows]);
  const cover = useMemo(() => coverage(rows), [rows]);
  const effect = useMemo(() => counselingEffect(rows), [rows]);
  const discounts = useMemo(() => discountEffect(rows), [rows]);
  const insurance = useMemo(() => insuranceMix(rows), [rows]);
  const gap = useMemo(() => gapAnalysis(rows), [rows]);

  const lead = queue.find((entry) => entry.id === selected) ?? null;
  const problems = closureProblems({ lead, reason });
  const blocked = queue.filter((entry) => !entry.counseled && !entry.booked);

  return (
    <>
      <PageHeader
        screen="O2"
        title="Financial Counseling Desk"
        subtitle="Close the gap between surgery advised and surgery booked."
        thesis="§17, §24, §30.7, §33"
      />

      <div className="space-y-6 p-4">
        <SectionCard title="The §33 finding, on this hospital's own numbers">
          <p className="text-lg font-semibold">
            {`${cover.uncounseled} of ${cover.advised} patients advised surgery never received a counseling conversation. ${cover.uncounseledAndLost} of those never booked.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {`Counseling coverage is ${cover.coverageRate}%. Patients who got the conversation booked at ${effect.withCounseling.bookingRate}% (${effect.withCounseling.patients} patients); patients who did not booked at ${effect.withoutCounseling.bookingRate}% (${effect.withoutCounseling.patients}). That is ${effect.pointsGained} percentage points.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Coverage is reported here as process compliance and never as an outcome number, per §28.
            It says whether the step happened, not whether the counselor is good.
          </p>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Advised surgery" value={cover.advised.toLocaleString("en-IN")} detail="Everybody this desk owns" />
          <StatTile
            label="Counseling coverage"
            value={`${cover.coverageRate}%`}
            icon={ShieldCheck}
            tone={cover.coverageRate >= 90 ? "good" : "bad"}
            detail={`${cover.uncounseled} patients never had the conversation`}
          />
          <StatTile
            label="Booking rate with counseling"
            value={`${effect.withCounseling.bookingRate}%`}
            tone="good"
            detail={`${effect.withoutCounseling.bookingRate}% without it`}
          />
          <StatTile
            label="Discount usage"
            value={`${discounts.usageRate}%`}
            icon={HandCoins}
            detail={`${discounts.requested.bookingRate}% book with one, ${discounts.notRequested.bookingRate}% without`}
          />
        </div>

        {blocked.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-semibold">
                {`${blocked.length} patient(s) cannot be closed for a price reason`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                They were advised surgery, never counseled, and never booked. Until a session is
                logged, the only closure the guard below will accept for them is
                {` "${NO_COUNSELING_REASON}"` } — which is the truth, and which routes them straight
                into the recovery pool instead of into a pricing decision.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <SectionCard
            title="The queue"
            caption="Unbooked first, and inside that the uncounseled first. Click a patient to test a closure against the guard."
          >
            <div className="scroll-slim max-h-[32rem] overflow-auto">
              <ul className="space-y-2">
                {queue.slice(0, 120).map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(entry.id === selected ? null : entry.id);
                        setReason(null);
                      }}
                      className={
                        entry.id === selected
                          ? "w-full rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                          : "w-full rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                      }
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{entry.patient_name}</span>
                        <StatusPill
                          status={entry.stateLabel}
                          tone={entry.booked ? "good" : entry.counseled ? "pending" : "bad"}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {`${entry.disease} · ${entry.doctor_name} · ${entry.quotedLabel} · insurance: ${entry.insurance}`}
                      </p>
                      <p className="mt-1 text-xs text-primary">{`Next: ${entry.next} (${entry.owner})`}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>

          <SectionCard
            title="Close as not going ahead"
            caption="The guard §33 asks for, running on the patient you selected."
          >
            {!lead && <p className="text-sm text-muted-foreground">Pick a patient on the left.</p>}
            {lead && (
              <>
                <p className="text-sm">
                  {`${lead.patient_name} — ${lead.counseled ? "counseling was completed" : "never counseled"}.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...PRICE_REASONS, NO_COUNSELING_REASON, "Surgery fear"].map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      variant={option === reason ? "default" : "outline"}
                      onClick={() => setReason(option === reason ? null : option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
                {problems.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-xs text-destructive">
                    {problems.map((problem) => (
                      <li key={problem}>· {problem}</li>
                    ))}
                  </ul>
                ) : (
                  reason && (
                    <p className="mt-4 text-sm text-success">
                      {`Accepted. "${reason}" is a reason this patient's record actually supports.`}
                    </p>
                  )
                )}
                <Button className="mt-4 w-full" disabled={problems.length > 0 || !reason}>
                  {problems.length > 0 ? "Refused" : "Close with this reason"}
                </Button>
              </>
            )}
          </SectionCard>
        </div>

        <DataTable
          title="Counseling against conversion"
          caption="Both bases are printed beside both rates. A gap between two percentages is only an argument once a reader can see how many patients sit under each of them."
          columns={[
            { key: "value", label: "Group" },
            { key: "patients", label: "Patients", align: "right" },
            { key: "booked", label: "Booked", align: "right" },
            { key: "bookingRateLabel", label: "Booking rate", align: "right" },
            { key: "revenueLabel", label: "Revenue", align: "right" },
          ]}
          rows={[effect.withCounseling, effect.withoutCounseling].map((line) => ({
            ...line,
            bookingRateLabel: `${line.bookingRate}%`,
            revenueLabel: rupees(line.revenue),
          }))}
        />

        <DataTable
          title="Insurance"
          caption="Insurance moves the conversation more than a discount does, so it gets its own table rather than a column."
          columns={[
            { key: "value", label: "Cover" },
            { key: "patients", label: "Patients", align: "right" },
            { key: "shareLabel", label: "Share", align: "right" },
            { key: "booked", label: "Booked", align: "right" },
            { key: "bookingRateLabel", label: "Booking rate", align: "right" },
          ]}
          rows={insurance.map((line) => ({
            ...line,
            shareLabel: `${line.share}%`,
            bookingRateLabel: `${line.bookingRate}%`,
          }))}
        />

        <SectionCard
          title="The gap this desk exists to close, and why it cannot be measured"
          caption="Named rather than estimated."
        >
          <p className="text-sm">
            {`${gap.patients} patients carry a quoted package, averaging ${rupees(gap.averageQuoted)}.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{gap.missingField}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            A rupee figure invented in front of a financial counselor is the fastest way to lose the
            room, so the gap column reads as unavailable rather than as an estimate. Capturing one
            number on the counseling form — what the patient said they could arrange — makes every
            figure on this screen actionable.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
