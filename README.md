# Enterprise Lead Conversion CRM

**A Data-Driven System for Lead Management, Follow-up, Conversion Diagnosis and Revenue Improvement**

This repository holds the complete product thesis and the screen-level specification derived from it.

> The purpose of the CRM is not to generate more activity. Its purpose is to convert activity into measurable outcomes, convert outcomes into evidence, and convert evidence into management decisions.

The CRM is not a contact database and not a telecalling app. It is a **Lead Conversion Intelligence System** that must answer five questions:

1. Where are the leads coming from?
2. What is happening to every lead after it enters the system?
3. Why are some leads converting?
4. Why are some leads not converting?
5. What action should management take to increase conversions without blindly increasing advertising expenditure?

## Repository map

| Path | Contents |
|------|----------|
| [`docs/THESIS.md`](docs/THESIS.md) | The complete thesis, all 35 sections. Source of truth. |
| [`docs/AI-LAYER.md`](docs/AI-LAYER.md) | Soniox transcription + OpenAI analysis design, with guardrails and open questions |
| [`screens/`](screens/README.md) | 35 screen specifications, grouped by role, each traced to thesis sections |
| [`screens/06-existing-app-mapping.md`](screens/06-existing-app-mapping.md) | Status of all 35 screens against the existing client-approved Base44 app |
| [`reference/`](reference/) | Lookup tables extracted from the thesis: guardrails, reason codes, corrective actions, metrics, lifecycle and follow-up plans |
| [`reference/base44-data-model.md`](reference/base44-data-model.md) | The real Base44 entities and fields, the five schema gaps, and the build order |
| [`implementation/`](implementation/README.md) | Drop-in code for build steps 1–2: the `Communication` and `Template` entities, the 48-hour guard, and the seven-part remark form. Runnable self-check, passes the app's eslint |
| [`app/`](app/README.md) | The runnable React application: fifteen screens across the agent, manager, leadership, operations and admin roles, running the `implementation/` code against 1,500 generated lead journeys. See [Application](#application) |
| [`site/`](site/) | The specification website: generator, theme and home page. See [Website](#website) |
| [`source/`](source/) | Original PDF |
| [`../design/design.md`](../design/design.md) | The design system: brand material, the composition every dashboard uses, the validated chart palette, and the deviations from the reference board |

## Application

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm test         # 23 engine + 15 access + 12 agent + 36 screen + 57 operations + 22 seed + 14 sheet + 12 design checks, then 58 server-rendered routes
```

Twenty-four screens, grouped by role — twenty-three of the 35 specified, plus Vikku AI:

- **Agent** — the complete A1–A9 group, entered through one home called **Today** (the queue and the day's duties merged into one list, grouped by urgency, one button per row): Lead Detail · Call Logging · Qualification & Scoring (eleven [§7](docs/THESIS.md#7-lead-quality-classification) factors decide the temperature; ties break cooler, and an override costs a written justification) · Follow-up Update (the whole protocol as a day grid, where a missed day stays missed and a Warm plan cannot end undecided) · Communication Composer · Daily Tasks (the 5-minute first-response clock, and the protocol's calls as mandatory duties) · Appointment Booking (the ten [§17](docs/THESIS.md#17-appointment-and-conversion-management) states enforced as a machine) · Non-Conversion Reason Capture (all eight [§23](docs/THESIS.md#23-mandatory-non-conversion-reason-structure) fields, and the evidence field is a picker over the lead's real activity — a lead with nothing logged cannot be closed)
- **Manager** — Manager Dashboard · Daily Conversion Monitor (eleven metrics against their own trailing averages; the reporting day is the last *complete* one, because a part-day and a collapse look identical and calling one the other every morning is how a dashboard stops being read) · Funnel Dashboard (the eleven [§26](docs/THESIS.md#26-crm-funnel-metrics) transitions and the three recovery rates, every drop clickable down to the leads and their reasons) · Follow-up Compliance (touches nobody made and messages the platform failed to deliver, counted apart on every row — [§28](docs/THESIS.md#28-agent-performance-must-be-data-based) requires the distinction *before* management acts) · Assignment Board (leads that arrived and were never touched, each naming the rule that should have caught it) · Agent Scorecard ([§28](docs/THESIS.md#28-agent-performance-must-be-data-based)'s outcome and process columns, never merged) · Team (deactivating somebody who still holds open leads is refused until they move) · Escalation & Objection Desk (the six [§24](docs/THESIS.md#24-reason-based-corrective-action) objections, plus the pool [§33](docs/THESIS.md#33-sample-management-conclusion) was written about: leads closed for an objection that had a named owner and never reached them) · Communication Performance · **Vikku AI**, a chat bar that answers any manager question in the hospital's own Excel format — disease blocks, source rows, subtotals with the sheet's own colour cells, downloadable
- **Leadership** — Founder Dashboard (the five questions of [§2](docs/THESIS.md#2-business-problem-the-crm-must-solve), and a "should we buy more leads?" panel that shows the recoverable pool first) · Source & Campaign ROI (cost per surgery as the default sort) · Cohort Comparison ([§22](docs/THESIS.md#22-converted-vs-non-converted-cohort-comparison)) · Drill-Down Explorer (the nine [§25](docs/THESIS.md#25-drill-down-technique) levels, ending in the [§33](docs/THESIS.md#33-sample-management-conclusion) conclusion) · 15-Day Diagnostic Report ([§32](docs/THESIS.md#32-fifteen-day-diagnostic-report)) · Ask, a single bar answering a typed or spoken question with a plain table that downloads as a spreadsheet
- **Operations** — Appointments & No-shows (how many of the people who did not turn up had never received the reminder sequence; the calendar itself is absent because there is no appointment time in the data model, and inventing slot times is the one thing a front desk catches in thirty seconds) · Financial Counseling Desk (the [§33](docs/THESIS.md#33-sample-management-conclusion) guard, refusing in both directions — no price closure on a patient nobody counseled, and no "counseling not completed" on a patient who was) · Recovery & Reactivation Console (the four [§19](docs/THESIS.md#19-expired-lead-segmentation) segments, and [§20](docs/THESIS.md#20-three-month-reactivation-mechanism)'s exclusion list enforced rather than described)
- **Administration** — Lead Sources & Intake (the seventeen [§5](docs/THESIS.md#5-lead-intake-and-source-configuration) sources, and the [§3.1](docs/THESIS.md#3-lead-capture-and-attribution) attribution audit — two of the five mandatory fields are missing on every lead in the system, which is why leadership can rank a campaign and can never rank a creative) · Template Library · Audit Log

One screen stands outside the specification and outside the generated dataset: **Weekly Sheet Diagnosis** takes the hospital's own weekly Excel export, pasted as-is, and reports what its fifteen columns cannot — where the pending pool sits, which sources produced volume and no admission, and the five questions the sheet has no field to answer. Its parser is checked against the hospital's own hand-typed subtotals.

Every table downloads as a spreadsheet, and no screen holds arithmetic — the metric libraries do, so two
screens cannot disagree about the same fact.

The interface is light-only and built to one rulebook: one brand hue (`#5438FA`), neutrals as
opacity steps of a single ink, one typeface (Inter), two surface treatments, one radius and one
shadow. The colour and the type are sampled from the reference board in `design/`; the rules they
are spent under come from the rulebook. Every dashboard is the same four
bands — greeting, stat row, chart band, tables — and every figure drawn in a chart also appears in a
downloadable table below it, because a picture is not something a manager can argue with. The charts
have no dependency and one ordinal ramp of the brand hue, validated rather than eyeballed. The whole
system, including where it departs from the reference board and why, is in
[`design/design.md`](../design/design.md).

A lead moves through four stages — Qualify, Work the plan, Appointment, Outcome — and that bar is on
every screen belonging to a lead, saying which stage it is in and what has to happen first. Above it
sits one instruction: what to do, why, and a single button. Specification screen codes are not
rendered anywhere; they live in the code and the tests, where they are useful.

Access is role-based: five roles, one screen group each, enforced on the route and again on the
data — an agent's queue is their own leads, and another agent's lead is refused even on a screen
they own. It is an interface boundary, not a security boundary; the same map has to be enforced
server-side before real patient data arrives. Details in [`app/README.md`](app/README.md#roles-and-access).

Full screen table, the metric libraries, the dataset's shape, and an honest per-screen list of what is
specified but not built: [`app/README.md`](app/README.md).

## Website

The whole specification is published as a browsable site, generated from the Markdown in this repository — the Markdown stays the source of truth, the site is only a view of it.

```bash
npm install
npm run build     # writes dist/
npm run dev       # builds, then serves dist/ on http://localhost:4173
```

`npm run build` fails if any internal link or heading anchor does not resolve, so a broken cross-reference cannot reach the published site.

| Path | Contents |
|------|----------|
| [`site/build.mjs`](site/build.mjs) | Generator: page manifest, Markdown rendering, search index, link check, dev server |
| [`site/home.html`](site/home.html) | Home page content — the summary of the whole specification |
| [`site/theme.css`](site/theme.css) | The single stylesheet, light and dark |
| [`site/app.js`](site/app.js) | Search, theme toggle, page-TOC scrollspy, mobile nav |

The build produces one page per document, plus `dist/all.html` — the entire specification as a single self-contained file for sharing, and `dist/artifact.html`, the same bundle without a document wrapper.

Deployment is [`.github/workflows/pages.yml`](.github/workflows/pages.yml): every push to `main` builds and publishes to GitHub Pages. It runs once Pages is enabled for the repository under **Settings → Pages → Source: GitHub Actions**.

## Screens

35 screens across five roles. Full index and thesis-coverage matrix in [`screens/README.md`](screens/README.md).

| Group | Count | Screens |
|-------|-------|---------|
| [Agent / Telecaller](screens/01-agent-screens.md) | 9 | My Leads · Lead Detail · Call Logging · Qualification & Scoring · Follow-up Update · Communication Composer · Daily Tasks · Appointment Booking · Non-Conversion Reason Capture |
| [Manager](screens/02-manager-screens.md) | 9 | Manager Dashboard · Daily Conversion Monitor · Funnel Dashboard · Follow-up Compliance · Assignment Board · Agent Scorecard · Team · Escalation & Objection Desk · Communication Performance |
| [Leadership & Analytics](screens/03-leadership-screens.md) | 7 | Founder Dashboard · Source & Campaign ROI · Cohort Comparison · 90-Day Trend · Drill-Down Explorer · 15-Day Diagnostic Report · Reports Library |
| [Clinical & Operations](screens/04-operations-screens.md) | 4 | Appointment Calendar & No-show Board · Financial Counseling Desk · IPD / Admission Management · Recovery & Reactivation Console |
| [Administration](screens/05-admin-screens.md) | 6 | Lead Intake & Source Configuration · Assignment Rules · Template Library & Approval · Status / Reason / SLA Configuration · Audit Log · Roles, Permissions & User Manual |

Every screen spec carries seven fields: purpose, users, thesis sections, data shown, actions, guards, exit.

## The core arguments

**The problem is not lead volume.** A hospital receiving 100 leads and converting 50 does not need 150 leads to reach 70 conversions. It needs to know what happened to the other 50 — how many hit a price objection, how many never got a proper follow-up, how many booked and never visited, how many are still recoverable. Only after the leak is measured should more spend be considered. See [Section 2](docs/THESIS.md#2-business-problem-the-crm-must-solve).

**The 48-hour alternating communication model.** Planned messages go out every 48 hours, not daily, alternating WhatsApp → RCS/MMS → WhatsApp → RCS/MMS, with visual content and a defined purpose for each touch. Calls remain driven by patient priority and are never blocked by the message cadence. See Sections [8](docs/THESIS.md#8-revised-communication-thesis-48-hour-messaging-pattern) through [11](docs/THESIS.md#11-communication-content-must-follow-a-nurturing-sequence).

**Every loss is diagnosed.** "Lead Expired" is an operational status, never a reason. Each closure carries a primary reason, a secondary reason, a remark, a link to real evidence, a recoverability verdict, a recommended action, an owner and a review date. See Sections [18](docs/THESIS.md#18-lead-expiry-and-post-expiry-diagnosis), [19](docs/THESIS.md#19-expired-lead-segmentation) and [23](docs/THESIS.md#23-mandatory-non-conversion-reason-structure).

**Drill down until the cause is real.** A conversion drop is traced through nine levels — overall, conversion type, disease, campaign, funnel stage, objection, process gap, agent, specific behaviour — until the conclusion is evidence-based and the action is specific. See [Section 25](docs/THESIS.md#25-drill-down-technique) and [Section 33](docs/THESIS.md#33-sample-management-conclusion).

## The ten operating principles

Restated as enforceable system rules, with the screen that enforces each one, in [`reference/guardrails.md`](reference/guardrails.md).

1. No Lead Without Source.
2. No Call Without a Remark.
3. No Message Without a Purpose.
4. No Repeated Message Within the Planned 48-Hour Cycle.
5. No Final Closure Without a Reason.
6. No Blame Without Data.
7. No Decision Without Evidence.
8. No Additional Ad Spend Before Funnel Diagnosis.
9. No Expired Lead Without Recoverability Analysis.
10. No CRM Status Without an Audit Trail.

## The chain

```
Lead Source > Patient Contact > Qualification > Communication > Follow-up >
Appointment > Consultation > Financial Counseling > Conversion or Loss Reason >
Corrective Action
```

The system succeeds only when management can answer: what happened, where it happened, why it happened, who handled it, what evidence exists, whether the lead can be recovered, what process must change, and whether more leads would actually solve the problem.

## Reference tables

| File | Contents |
|------|----------|
| [`guardrails.md`](reference/guardrails.md) | The ten principles as enforced rules, plus derived guards |
| [`reason-codes.md`](reference/reason-codes.md) | The seven closure categories, their sub-reasons, default recoverability and default actions |
| [`corrective-actions.md`](reference/corrective-actions.md) | Reason-to-action map with owner and screen for each action |
| [`base44-data-model.md`](reference/base44-data-model.md) | Real entities and fields from `base44/entities/*.jsonc`, code conventions to follow, the five missing entities with proposed schemas, and the schema-first build order |
| [`metrics.md`](reference/metrics.md) | Every metric with formula and owning screen — contact, funnel, cost, communication, agent, cohort |
| [`lifecycle-and-plans.md`](reference/lifecycle-and-plans.md) | 20 lifecycle stages, exit statuses, appointment states, the four follow-up plans, channel rotation, nurture sequence |
