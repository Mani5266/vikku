# Leadership & Analytics Screens

Seven screens. These deliver the three forms of clarity demanded by [Section 34](../docs/THESIS.md#34-final-product-vision): operational, diagnostic and decision clarity.

---

## L1. Founder Dashboard

**Purpose** — Answer the five questions of the central thesis on one screen.

**Users** — Founder, Leadership

**Thesis** — [1](../docs/THESIS.md#1-central-thesis), [34](../docs/THESIS.md#34-final-product-vision)

**Data shown** — the screen is literally structured as the five questions of Section 1.

| Question | Panel |
|----------|-------|
| Where are the leads coming from? | Source and campaign mix, weighted by conversion and revenue, not by count |
| What is happening to every lead? | Live distribution across the 20 lifecycle stages, plus the exit buckets |
| Why are some leads converting? | Top conversion patterns from the cohort engine — source, response time, channel sequence, counseling, doctor touch |
| Why are some leads not converting? | Top drop stages and top reasons, with counts and recoverable subtotals |
| What action should management take? | The open action list with owner, expected result and review date |

Header band: leads, connected rate, conversions, revenue, cost per surgery, recoverable revenue currently sitting in the lost pool.

**Actions** — Change period · Compare periods · Drill any panel · Accept or decline a recommended action · Export a board pack.

**Guards**

- The "should we buy more leads?" panel is explicit: it shows recoverable leads and the projected conversions from fixing the current leak **before** it shows any lead-volume recommendation. Section 2 and the Section 35 principle *No Additional Ad Spend Before Funnel Diagnosis* are enforced as screen ordering, not as advice.
- Every number on the screen is clickable down to the individual leads behind it.

**Exit** — L2, L3, L5, L6.

---

## L2. Source & Campaign ROI

**Purpose** — Which spend actually produces surgeries?

**Users** — Leadership, Marketing, Manager

**Thesis** — [5](../docs/THESIS.md#5-lead-intake-and-source-configuration), [26](../docs/THESIS.md#26-crm-funnel-metrics)

**Data shown** — a row per source, campaign, ad set, creative and landing page, with the full chain:

leads · connected rate · qualified · Hot rate · appointments · visits · consultations · surgery advised · surgery booked · revenue · spend · cost per lead · cost per connected lead · cost per appointment · **cost per surgery** · junk-lead rate · invalid-number rate · out-of-area rate.

The seven Section 5 questions are pre-built views: most leads · most connected leads · most Hot Leads by creative · most appointments · most surgeries · most junk data · lowest cost per surgery.

**Actions** — Rank by any column · Compare campaigns · Compare creatives · Compare landing pages · Drill to leads · Flag a campaign for correction · Export for the ad platform.

**Guards**

- Default sort is cost per surgery, never lead count. Section 5: lead count alone must never be used to judge campaign quality.
- A campaign cannot be flagged "not working" from this screen without the drill-down showing whether the failure is in lead quality or in follow-up execution — the same distinction Section 28 makes for agents.

**Exit** — L5, M9, S1.

---

## L3. Cohort Comparison

**Purpose** — What did converted patients receive that non-converted patients did not?

**Users** — Leadership, Manager

**Thesis** — [21](../docs/THESIS.md#21-conversion-diagnosis), [22](../docs/THESIS.md#22-converted-vs-non-converted-cohort-comparison)

**Data shown** — the Section 22 table, computed per treatment category, converted column against non-converted column, with the gap and its significance:

average first response time · connected rate · average number of calls · follow-up completion · WhatsApp delivery · RCS/MMS delivery · reply rate · appointment booking · patient visit · doctor interaction · financial counseling · average quoted package · insurance availability · main source · main agent.

Below the table, two generated narratives:

- **Conversion pattern** — the Section 21 factors that most separate the converted cohort, e.g. first call within ten minutes, doctor profile on Day 1, financial counseling before the appointment, appointment confirmed twice, doctor callback for objections.
- **Non-conversion pattern** — delayed first call, missing remarks, no RCS/MMS content, no financial counseling, missed appointment reminder, incomplete follow-up.

Each narrative line carries the lead count behind it and links to those leads.

**Actions** — Change treatment category · Change period · Add a dimension · Turn a pattern into a process rule (routes to S4 SLA configuration) · Export.

**Guards** — Cohorts are matched on disease and source mix before comparison, so the table compares process, not luck.

**Exit** — L5, S4, M6.

---

## L4. 90-Day Conversion Trend

**Purpose** — Is the system improving, and did the corrective actions land?

**Users** — Leadership

**Thesis** — [26](../docs/THESIS.md#26-crm-funnel-metrics), [32](../docs/THESIS.md#32-fifteen-day-diagnostic-report)

**Data shown** — every funnel rate from Section 26 plotted over 90 days, with corrective actions from previous diagnostic reports marked on the timeline as annotations, so the effect of each action is visible against the curve.

Cohort view: leads grouped by intake week and tracked to maturity, so conversions are attributed to the week the lead arrived rather than the week it closed.

Also plotted: recoverable pool size, recovery conversions, reactivation campaign results.

**Actions** — Overlay dimensions · Mark an intervention · Compare cohorts · Export.

**Guards** — Conversions are cohort-attributed. Leads with long decision cycles are not counted as failures before their plan has matured.

**Exit** — L6, L5.

---

## L5. Drill-Down Explorer

**Purpose** — Take any metric from symptom to root cause without leaving the screen.

**Users** — Manager, Leadership

**Thesis** — [25](../docs/THESIS.md#25-drill-down-technique)

**Data shown** — the nine-level drill of Section 25, implemented as a breadcrumb that never loses the thread:

```
Level 1  Overall conversions
Level 2  Conversion type          (surgery / consultation / procedure)
Level 3  Disease                  (Piles, …)
Level 4  Source and campaign      (Facebook Campaign B, …)
Level 5  Funnel stage             (connected normal, appointment booking fell)
Level 6  Objection                (pricing)
Level 7  Process gap              (financial counseling not completed)
Level 8  Agent                    (the two agents handling those leads)
Level 9  Specific behaviour       (package comparison creative not sent, no escalation)
```

At every level the panel shows: the metric, the delta against the comparison period, the contributing segments ranked by how much of the drop they explain, and the underlying leads with their remarks.

The screen ends on a **Conclusion** block that assembles: finding, evidence, root cause, corrective action, responsible person, expected result, review date.

**Actions** — Drill · Pivot to another dimension at the same level · Open evidence · Save the conclusion into the 15-day report · Assign the corrective action.

**Guards**

- The conclusion block cannot be saved without an evidence link at each of the levels traversed. Section 3.4: no decision without evidence.
- The explorer refuses to attribute a drop to lead volume when the funnel data shows the loss happening at a later stage.

**Exit** — L6, M8.

---

## L6. 15-Day Diagnostic Report

**Purpose** — The recurring management document the thesis is built to produce.

**Users** — Manager (authors), Leadership (reads)

**Thesis** — [32](../docs/THESIS.md#32-fifteen-day-diagnostic-report), [33](../docs/THESIS.md#33-sample-management-conclusion)

**Structure** — Week 1 · Week 2 · Overall 15-day summary, each answering the two questions.

**Why did leads convert?** — best source · best disease category · best agent · best channel sequence · best content · best appointment process · best counseling method · average conversion time.

**Why did leads not convert?** — top non-conversion reasons · funnel drop stage · source-wise drop · disease-wise drop · agent-wise process gap · price issues · no-show issues · competitor losses · follow-up failures · Not Connected cases.

**Conclusions** — every conclusion carries the seven mandatory fields: finding · evidence · root cause · corrective action · responsible person · expected result · review date. Conclusions saved from L5 arrive here pre-filled.

The report renders in the Section 33 worked format — Finding, Drill-Down, Source Finding, Stage Finding, Root Cause, Evidence, Corrective Action, Expected Result — so the output is directly usable in a management meeting.

**Actions** — Generate · Edit narrative · Attach conclusions from L5 · Assign actions with owners and dates · Publish · Export to PDF · Review the previous period's expected results against what actually happened.

**Guards**

- A conclusion without evidence links cannot be published.
- The report opens with the previous period's expected results scored against actuals, so corrective actions are closed out rather than forgotten.

**Exit** — L4, M8.

---

## L7. Reports Library

**Purpose** — Every scheduled and ad-hoc report in one place.

**Users** — All roles, filtered by permission

**Thesis** — [30.10](../docs/THESIS.md#3010-reporting-module)

**Data shown** — the nine Section 30.10 report types: daily · weekly · 15-day · monthly · agent · source · disease · funnel · revenue. Each with schedule, recipients, last run, format and delivery status.

**Actions** — Run now · Schedule · Change recipients · Build a custom report from the metric catalogue · Subscribe · Export to PDF, Excel or CSV.

**Guards** — Report permissions inherit from role. Revenue and cost figures are restricted to leadership and finance roles.

**Exit** — Any report; L6.
