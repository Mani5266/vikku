# Manager Screens

Nine screens. These implement [Section 31, the manager's daily working pattern](../docs/THESIS.md#31-managers-daily-working-pattern), and the process-versus-outcome separation of [Section 28](../docs/THESIS.md#28-agent-performance-must-be-data-based).

---

## M1. Manager Dashboard

**Purpose** — Morning, midday and end of day in one screen.

**Users** — Manager, Team Lead

**Thesis** — [31](../docs/THESIS.md#31-managers-daily-working-pattern)

**Data shown** — three tabs matching the thesis rhythm.

**Morning** — new leads received · unassigned leads · fresh leads not yet called · Hot Leads due today · Not Connected leads due today · today's appointments · pending confirmations · overdue follow-ups. Each tile is a live count and a click-through into the filtered list.

**During the Day** — first-response delays breaching SLA · high-intent leads currently in play · missed follow-ups accumulating · appointments booked today · patient objections raised today by category · open escalations · doctor callbacks pending · financial counseling pending · message delivery failures.

**End of Day** — the eleven closing numbers of Section 31: New Leads · Connected · Not Connected · Hot/Warm/Cold split · Appointments · Visits · Conversions · Missed Follow-ups · Top Drop Reasons · Recoverable Leads · Required Management Actions.

**Actions** — Assign leads · Escalate · Reassign · Open any drill-through · Generate and send the end-of-day report.

**Guards** — Required Management Actions cannot be dismissed; each must be accepted with an owner and a date, or explicitly declined with a reason.

**Exit** — M2, M4, M5, M8, or a filtered lead list.

---

## M2. Daily Conversion Monitor

**Purpose** — Is today tracking, and if not, where is it leaking?

**Users** — Manager, Leadership

**Thesis** — [31](../docs/THESIS.md#31-managers-daily-working-pattern), [26](../docs/THESIS.md#26-crm-funnel-metrics)

**Data shown** — today versus the trailing 7-day and 30-day average, on: leads in, connected rate, first-response median, Hot generated, appointments booked, appointments confirmed, visits, consultations, surgery advised, surgery booked, revenue recorded.

A live stage-drop strip shows where today's cohort is stalling relative to normal, with the delta highlighted.

Below: today's top five drop reasons, and today's recoverable count.

**Actions** — Drill into any metric (hands off to L5) · Filter by branch, disease, source, agent · Flag a metric for the 15-day report.

**Guards** — Comparisons are always against a like-for-like cohort. Absolute counts alone are never displayed as a verdict, per Section 5's rule that lead count is not a quality judgement.

**Exit** — L5 Drill-Down Explorer.

---

## M3. Funnel Dashboard

**Purpose** — Where in the twenty-stage lifecycle do leads actually die?

**Users** — Manager, Leadership

**Thesis** — [26](../docs/THESIS.md#26-crm-funnel-metrics), [4](../docs/THESIS.md#4-complete-lead-lifecycle)

**Data shown** — the full funnel with count, conversion rate and drop count at each transition:

Lead-to-Connected · Connected-to-Qualified · Qualified-to-Hot · Hot-to-Appointment · Appointment-to-Visit · Visit-to-Consultation · Consultation-to-Surgery-Advice · Surgery-Advice-to-Booking · Booking-to-Completion · Overall Lead-to-Conversion · Lead-to-Revenue.

Recovery metrics shown alongside: Not Connected Recovery Rate · Expired Lead Recovery Rate · No-show Recovery Rate.

Every stage is sliceable by the ten Section 26 dimensions: date · source · campaign · disease · branch · doctor · agent · lead quality · location · communication channel.

**Actions** — Slice · Compare two periods · Compare two segments · Export · Click any drop bucket to list those leads with their exit reasons.

**Guards** — Clicking a drop bucket always lands on leads with reasons attached; a stage cannot report a drop it cannot explain lead by lead.

**Exit** — Lead list, L5.

---

## M4. Follow-up Compliance & Overdue Queue

**Purpose** — Was the process actually executed?

**Users** — Manager

**Thesis** — [24](../docs/THESIS.md#24-reason-based-corrective-action), [28](../docs/THESIS.md#28-agent-performance-must-be-data-based), [30.5](../docs/THESIS.md#305-follow-up-scheduler)

**Data shown** — every lead whose plan has slipped, grouped by severity: Hot overdue (worst) · appointment confirmation overdue · Not Connected double-dial missed · Warm touch missed · Cold touch missed · post-consultation follow-up missed.

Per row: lead, agent, plan and day, what was due, how long overdue, prior missed count on this lead, whether a message failed to deliver versus was never scheduled.

Aggregates: follow-up completion rate by agent, by disease, by source; missed-touch heatmap by hour and by day.

**Actions** — Escalate to the agent · Reassign · Auto-reschedule the missed touch · Add to a coaching list · Bulk-notify.

**Guards** — Delivery failure and non-execution are counted separately. A message the system failed to deliver is an infrastructure issue, not an agent miss — Section 28 requires the system to distinguish them before management acts.

**Exit** — A2, M6, M8.

---

## M5. Unassigned & Assignment Board

**Purpose** — No lead sits without an owner.

**Users** — Manager

**Thesis** — [30.2](../docs/THESIS.md#302-lead-assignment-module)

**Data shown** — unassigned leads with age since arrival, source, disease, branch, location, and the assignment rule that should have matched. Right panel: agent roster with current open load, Hot load, overdue count, today's completion rate and language or disease skill tags.

**Actions** — Assign · Bulk assign by rule · Rebalance workload · Reassign with reason · Override a routing rule.

**Guards** — Every assignment and reassignment writes to the reassignment history and the audit log. Unassigned age drives an escalating alert against the intake SLA.

**Exit** — A1, S2.

---

## M6. Agent Scorecard

**Purpose** — Judge the agent on data, and separate what they achieved from what they followed.

**Users** — Manager, Leadership

**Thesis** — [28](../docs/THESIS.md#28-agent-performance-must-be-data-based)

**Data shown** — the twenty Section 28 metrics, split into two explicitly labelled columns.

**Outcome performance** — leads assigned · Hot Leads generated · appointment bookings · patient visits · surgery conversions · revenue generated · recovery conversions.

**Process compliance** — first response time · calls attempted · connected rate · qualification accuracy · follow-ups due · follow-ups completed · follow-ups missed · WhatsApp activities · RCS/MMS activities · remarks quality · non-conversion reasons logged · recoverable leads identified.

A lead-quality-adjusted view normalises outcome numbers against the source mix the agent was actually given.

**Actions** — Compare agents · Compare periods · Open the underlying leads for any metric · Start a coaching note · Export.

**Guards**

- Outcome numbers are never shown without the process column beside them, and never without the lead-quality mix. Section 28: an agent may convert less because the leads were worse, and the system must say which.
- Remarks quality is scored on structural completeness — the seven Section 3.2 parts — not on prose style.

**Exit** — A1 filtered to that agent, M4.

---

## M7. Team

**Purpose** — Roster, capacity and coverage.

**Users** — Manager

**Thesis** — [28](../docs/THESIS.md#28-agent-performance-must-be-data-based), [30.2](../docs/THESIS.md#302-lead-assignment-module)

**Data shown** — every agent with role, branch, disease and language skills, shift, current capacity, open leads, Hot leads, overdue, today's completions, leave status. Team-level rollups of the same figures.

**Actions** — Add or deactivate a user · Change skills and routing tags · Set capacity caps · Manage shifts · Cover an absence by bulk reassignment.

**Guards** — Deactivating a user forces reassignment of their open leads before the change commits.

**Exit** — M5, M6, S6.

---

## M8. Escalation & Objection Desk

**Purpose** — The queue of leads that need someone more senior than the agent.

**Users** — Manager, Doctor, Financial Counselor

**Thesis** — [24](../docs/THESIS.md#24-reason-based-corrective-action), [31](../docs/THESIS.md#31-managers-daily-working-pattern)

**Data shown** — escalations grouped by objection type, each carrying the corrective action Section 24 prescribes:

| Objection | Queue routes to | Prescribed action |
|-----------|-----------------|-------------------|
| Price issue | Financial counselor | Counselor call, package explanation, EMI, insurance check, controlled discount, value comparison |
| Surgery fear | Doctor | Doctor counseling, procedure explainer, recovery timeline, pain-management info, testimonial, family counseling |
| Doctor trust | Doctor / Manager | Doctor profile, credentials, procedure volume, video consultation, success story, doctor callback |
| Location | Manager | Nearest branch, map and travel info, video consultation, camp or satellite consultation, suitable timing |
| Appointment no-show | Agent / Front desk | Reschedule, reminder sequence, pre-appointment call, RCS/MMS appointment card, video alternative, no-show reason capture |
| Follow-up missed | Manager | Agent alert, escalation, auto-reschedule, compliance report, Hot overdue queue |

Per row: lead, objection, evidence link, age of escalation, owner, SLA, current state.

**Actions** — Claim · Take action (opens the matching tool) · Approve a discount within limits · Assign a doctor callback · Resolve with outcome · Return to agent with instructions.

**Guards** — Resolution requires an outcome and a note; discount approvals write amount, approver and justification to the audit log (Section 29).

**Exit** — O2, A2, S5.

---

## M9. Communication Performance

**Purpose** — Is the 48-hour alternating model actually working?

**Users** — Manager, Marketing, Leadership

**Thesis** — [27](../docs/THESIS.md#27-communication-performance-metrics), [10](../docs/THESIS.md#10-channel-orchestration-logic)

**Data shown** — the Section 27 metric set: messages scheduled · sent · delivered · failed · read · patient replies · link clicks · appointment actions · opt-outs · WhatsApp response rate · RCS/MMS response rate · image communication response rate · conversion after each communication touch · best-performing content · best-performing channel sequence · communication fatigue indicators.

Analysis views:

- **Channel** — WhatsApp versus RCS/MMS on delivery, read, reply and downstream conversion.
- **Sequence** — which orderings of the seven nurture communications precede the most conversions.
- **Template** — per-template reply rate, appointment rate and conversion contribution.
- **Fatigue** — reply rate and opt-out rate plotted against touch count, to find the point where more touches start costing engagement.
- **Cadence proof** — 48-hour compliance rate, and outcomes for compliant versus exception sends.

**Actions** — Compare channels · Compare templates · Compare sequences · Retire an underperforming template (routes to S3) · Export.

**Guards** — Every comparison is conversion-weighted. Delivery and read counts alone are never presented as success (Section 5's principle applied to messaging).

**Exit** — S3 Template Library, L5.
