# Guardrails

The ten operating principles of [Section 35](../docs/THESIS.md#35-final-thesis-statement), restated as enforceable system rules. Each one names the screen that enforces it and what the system does when the rule is violated.

| # | Principle | Enforced by | Enforcement |
|---|-----------|-------------|-------------|
| 1 | **No Lead Without Source** | S1 intake | Lead creation is rejected — through integration, import or manual entry — unless source, campaign, platform, landing page or form, and generation timestamp are all present. Attribution locks after creation. |
| 2 | **No Call Without a Remark** | A3 call logging | Save is disabled until all seven remark parts are filled: connected or not, what the patient said, what the agent explained, what objection was raised, what material was shared, what the next action is, when it must happen. |
| 3 | **No Message Without a Purpose** | S3 templates, A6 composer | A template cannot be saved without a stated purpose and a nurture step. Only approved templates reach the composer. A lint rule flags "Are you interested?" phrasing. |
| 4 | **No Repeated Message Within the Planned 48-Hour Cycle** | A6 composer | Send is blocked before 48 hours elapse; same channel twice in a row is blocked; same template twice to the same patient is blocked; simultaneous multi-channel send is blocked. Exceptions require an audited manager approval. Calls are never blocked. |
| 5 | **No Final Closure Without a Reason** | A9, S4 | Closure statuses carry a permanently mandatory reason flag that admin cannot disable. "Lead Expired" alone is rejected; a business reason, evidence link, recoverability and review date are required. |
| 6 | **No Blame Without Data** | M6 scorecard | Outcome metrics are never displayed without the process-compliance column and the lead-quality mix beside them. Delivery failure is counted separately from agent non-execution. |
| 7 | **No Decision Without Evidence** | L5, L6, S5 | A drill-down conclusion cannot be saved without an evidence link at each level traversed. A 15-day report conclusion cannot be published without evidence. |
| 8 | **No Additional Ad Spend Before Funnel Diagnosis** | L1, L2 | The founder dashboard shows recoverable leads and projected recovery conversions *before* any lead-volume recommendation. Campaign ROI defaults to sorting by cost per surgery, never by lead count. |
| 9 | **No Expired Lead Without Recoverability Analysis** | A9, O4 | Every closure assigns one of the four segments — Recoverable, Long-Term Nurture, Genuine Lost, Invalid. Recoverable requires an action, an owner and a review date, and enrols the lead in a recovery segment. |
| 10 | **No CRM Status Without an Audit Trail** | S5 | The audit log is append-only with no delete path in any role. Corrections append a referencing entry. Blocked and failed actions are logged as evidence that a guard fired. |

## Derived guards

Rules that follow from the thesis but are not in the ten-line list.

| Guard | Source | Behaviour |
|-------|--------|-----------|
| Scheduled message suppression | [12](../docs/THESIS.md#12-revised-hot-lead-follow-up) | Routine sends are suppressed and the suppression logged when the patient has responded, booked an appointment, requested a later date, opted out, been taken over by a doctor, been admitted, or converted. |
| Forced classification at plan end | [13](../docs/THESIS.md#13-revised-warm-lead-follow-up) | At Warm Day 15 the lead must be moved to one of the ten defined outcomes. A generic "follow-up" status is not available. |
| Immediate qualification on connect | [15](../docs/THESIS.md#15-revised-not-connected-follow-up) | A connect during the Not Connected plan forces Hot/Warm/Cold qualification before the agent can leave the screen. |
| Cold Lead content restriction | [14](../docs/THESIS.md#14-revised-cold-lead-follow-up) | Price-offer and aggressive-surgery templates are blocked from Cold plans. |
| Reactivation exclusion list | [20](../docs/THESIS.md#20-three-month-reactivation-mechanism) | Opted out, wrong number, invalid, firmly not interested, already treated, clinically ineligible and do-not-contact leads cannot be added to any reactivation campaign, including by manual override. |
| Counseling before price loss | [33](../docs/THESIS.md#33-sample-management-conclusion) | A patient cannot be closed lost on a price reason unless counseling was logged, or the absence of counseling is itself recorded as the reason. |
| Revenue attribution chain | [34](../docs/THESIS.md#34-final-product-vision) | Revenue posts against the originating lead so the source-to-revenue chain stays intact through to cost per surgery. |
| Cohort matching | [22](../docs/THESIS.md#22-converted-vs-non-converted-cohort-comparison) | Converted and non-converted cohorts are matched on disease and source mix before comparison, so the table compares process rather than luck. |
