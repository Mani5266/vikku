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
| [`screens/`](screens/README.md) | 35 screen specifications, grouped by role, each traced to thesis sections |
| [`screens/06-existing-app-mapping.md`](screens/06-existing-app-mapping.md) | Status of all 35 screens against the existing client-approved Base44 app |
| [`reference/`](reference/) | Lookup tables extracted from the thesis: guardrails, reason codes, corrective actions, metrics, lifecycle and follow-up plans |
| [`source/`](source/) | Original PDF |

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
| [`metrics.md`](reference/metrics.md) | Every metric with formula and owning screen — contact, funnel, cost, communication, agent, cohort |
| [`lifecycle-and-plans.md`](reference/lifecycle-and-plans.md) | 20 lifecycle stages, exit statuses, appointment states, the four follow-up plans, channel rotation, nurture sequence |
