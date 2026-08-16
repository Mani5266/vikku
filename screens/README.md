# Screen Inventory

Every screen required to deliver the thesis. Each screen traces back to one or more thesis sections — no screen exists without a thesis justification, and no thesis section is left without a screen that implements it.

Specs are grouped by role:

- [Agent / Telecaller screens](01-agent-screens.md) — 9 screens
- [Manager screens](02-manager-screens.md) — 9 screens
- [Leadership & Analytics screens](03-leadership-screens.md) — 7 screens
- [Clinical & Operations screens](04-operations-screens.md) — 4 screens
- [Administration screens](05-admin-screens.md) — 6 screens

**Total: 35 screens.**

## Full index

| # | Screen | Role | Thesis sections |
|---|--------|------|-----------------|
| A1 | [My Leads](01-agent-screens.md#a1-my-leads) | Agent | 4, 7, 12–15 |
| A2 | [Lead Detail (360 View)](01-agent-screens.md#a2-lead-detail-360-view) | Agent | 3, 4, 5, 29 |
| A3 | [New Call / Call Logging](01-agent-screens.md#a3-new-call--call-logging) | Agent | 3.2, 6 |
| A4 | [Qualification & Scoring](01-agent-screens.md#a4-qualification--scoring) | Agent | 7, 30.3 |
| A5 | [Follow-up Update](01-agent-screens.md#a5-follow-up-update) | Agent | 12–16, 30.5 |
| A6 | [Communication Composer](01-agent-screens.md#a6-communication-composer) | Agent | 8, 9, 10, 11, 30.4 |
| A7 | [Daily Tasks](01-agent-screens.md#a7-daily-tasks) | Agent | 12–15, 31 |
| A8 | [Appointment Booking](01-agent-screens.md#a8-appointment-booking) | Agent | 17, 30.6 |
| A9 | [Non-Conversion Reason Capture](01-agent-screens.md#a9-non-conversion-reason-capture) | Agent | 3.3, 18, 19, 23 |
| M1 | [Manager Dashboard](02-manager-screens.md#m1-manager-dashboard) | Manager | 31 |
| M2 | [Daily Conversion Monitor](02-manager-screens.md#m2-daily-conversion-monitor) | Manager | 31, 26 |
| M3 | [Funnel Dashboard](02-manager-screens.md#m3-funnel-dashboard) | Manager | 26 |
| M4 | [Follow-up Compliance & Overdue Queue](02-manager-screens.md#m4-follow-up-compliance--overdue-queue) | Manager | 24, 28, 30.5 |
| M5 | [Unassigned & Assignment Board](02-manager-screens.md#m5-unassigned--assignment-board) | Manager | 30.2 |
| M6 | [Agent Scorecard](02-manager-screens.md#m6-agent-scorecard) | Manager | 28 |
| M7 | [Team](02-manager-screens.md#m7-team) | Manager | 28, 30.2 |
| M8 | [Escalation & Objection Desk](02-manager-screens.md#m8-escalation--objection-desk) | Manager | 24, 31 |
| M9 | [Communication Performance](02-manager-screens.md#m9-communication-performance) | Manager | 27 |
| L1 | [Founder Dashboard](03-leadership-screens.md#l1-founder-dashboard) | Leadership | 1, 34 |
| L2 | [Source & Campaign ROI](03-leadership-screens.md#l2-source--campaign-roi) | Leadership | 5, 26 |
| L3 | [Cohort Comparison](03-leadership-screens.md#l3-cohort-comparison) | Leadership | 21, 22 |
| L4 | [90-Day Conversion Trend](03-leadership-screens.md#l4-90-day-conversion-trend) | Leadership | 26, 32 |
| L5 | [Drill-Down Explorer](03-leadership-screens.md#l5-drill-down-explorer) | Leadership | 25 |
| L6 | [15-Day Diagnostic Report](03-leadership-screens.md#l6-15-day-diagnostic-report) | Leadership | 32, 33 |
| L7 | [Reports Library](03-leadership-screens.md#l7-reports-library) | Leadership | 30.10 |
| O1 | [Appointment Calendar & No-show Board](04-operations-screens.md#o1-appointment-calendar--no-show-board) | Operations | 17, 24, 30.6 |
| O2 | [Financial Counseling Desk](04-operations-screens.md#o2-financial-counseling-desk) | Operations | 17, 24, 30.7 |
| O3 | [IPD / Admission Management](04-operations-screens.md#o3-ipd--admission-management) | Operations | 4, 17, 30.7 |
| O4 | [Recovery & Reactivation Console](04-operations-screens.md#o4-recovery--reactivation-console) | Operations | 19, 20, 30.9 |
| S1 | [Lead Intake & Source Configuration](05-admin-screens.md#s1-lead-intake--source-configuration) | Admin | 5, 30.1 |
| S2 | [Assignment Rules](05-admin-screens.md#s2-assignment-rules) | Admin | 30.2 |
| S3 | [Template Library & Approval](05-admin-screens.md#s3-template-library--approval) | Admin | 9, 11, 30.11 |
| S4 | [Status, Reason Code & SLA Configuration](05-admin-screens.md#s4-status-reason-code--sla-configuration) | Admin | 3.3, 23, 30.11 |
| S5 | [Audit Log](05-admin-screens.md#s5-audit-log) | Admin | 29 |
| S6 | [Roles, Permissions & User Manual](05-admin-screens.md#s6-roles-permissions--user-manual) | Admin | 30.11 |

## Coverage check — thesis section to screen

| Thesis section | Implemented by |
|----------------|----------------|
| 1. Central Thesis | L1 |
| 2. Business Problem | L1, L3, O4 |
| 3.1 No Lead Without a Source | S1, A2 |
| 3.2 No Call Without a Remark | A3 |
| 3.3 No Final Closure Without a Reason | A9, S4 |
| 3.4 No Decision Without Evidence | L5, S5 |
| 3.5 Lead Expiry Is Not the End | A9, O4 |
| 4. Complete Lead Lifecycle | A2, M3 |
| 5. Lead Intake and Source Configuration | S1, L2 |
| 6. Connected / Not Connected | A3, M3 |
| 7. Lead Quality Classification | A4 |
| 8. 48-Hour Messaging Pattern | A6, S3 |
| 9. Alternating WhatsApp / RCS | A6, S3 |
| 10. Channel Orchestration Logic | A6, M9 |
| 11. Nurturing Sequence | A6, S3 |
| 12. Hot Lead Follow-up | A5, A7 |
| 13. Warm Lead Follow-up | A5, A7 |
| 14. Cold Lead Follow-up | A5, A7 |
| 15. Not Connected Follow-up | A5, A7 |
| 16. Follow-up + Nurturing | A5, A6 |
| 17. Appointment and Conversion | A8, O1, O2, O3 |
| 18. Lead Expiry Diagnosis | A9 |
| 19. Expired Lead Segmentation | A9, O4 |
| 20. Three-Month Reactivation | O4 |
| 21. Conversion Diagnosis | L3, L5 |
| 22. Cohort Comparison | L3 |
| 23. Non-Conversion Reason Structure | A9, S4 |
| 24. Reason-Based Corrective Action | M8, O2, O4 |
| 25. Drill-Down Technique | L5 |
| 26. CRM Funnel Metrics | M3, L2, L4 |
| 27. Communication Performance Metrics | M9 |
| 28. Agent Performance | M6, M7 |
| 29. Evidence and Audit Trail | S5, A2 |
| 30. CRM Modules | all |
| 31. Manager's Daily Working Pattern | M1, M2, M8 |
| 32. Fifteen-Day Diagnostic Report | L6 |
| 33. Sample Management Conclusion | L6 |
| 34. Final Product Vision | L1, L5, L6 |
| 35. Final Thesis Statement | enforced by [guardrails](../reference/guardrails.md) |

## Spec format

Each screen spec carries the same seven fields:

| Field | Meaning |
|-------|---------|
| **Purpose** | The single question the screen answers |
| **Users** | Roles that can open it |
| **Thesis** | Sections implemented |
| **Data shown** | Fields, columns, panels |
| **Actions** | What the user can do |
| **Guards** | Blocking rules the screen enforces |
| **Exit** | Where the lead or user goes next |
