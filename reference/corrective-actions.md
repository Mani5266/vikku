# Reason-to-Action Map

From [Section 24](../docs/THESIS.md#24-reason-based-corrective-action). The CRM does not merely display reasons — every reason resolves to an action, an owner and a screen. This table is what [A9](../screens/01-agent-screens.md#a9-non-conversion-reason-capture) uses to pre-fill "Recommended action", and what routes work into [M8](../screens/02-manager-screens.md#m8-escalation--objection-desk).

## Price issue

| Action | Owner | Screen |
|--------|-------|--------|
| Financial counselor call | Financial Counselor | [O2](../screens/04-operations-screens.md#o2-financial-counseling-desk) |
| Package explanation | Financial Counselor | O2, [A6](../screens/01-agent-screens.md#a6-communication-composer) |
| EMI option | Financial Counselor | O2 |
| Insurance check | Financial Counselor | O2 |
| Controlled discount approval | Manager | [M8](../screens/02-manager-screens.md#m8-escalation--objection-desk) |
| Value comparison | Agent | A6 |

## Surgery fear

| Action | Owner | Screen |
|--------|-------|--------|
| Doctor counseling | Doctor | M8 |
| Procedure explainer | Agent | A6 |
| Recovery timeline image | Agent | A6 |
| Pain-management information | Agent | A6 |
| Patient testimonial | Agent | A6 |
| Family counseling | Agent / Counselor | M8 |

## Doctor trust issue

| Action | Owner | Screen |
|--------|-------|--------|
| Doctor profile | Agent | A6 |
| Experience and credentials | Agent | A6 |
| Procedure volume | Agent | A6 |
| Video consultation | Front Desk | [A8](../screens/01-agent-screens.md#a8-appointment-booking) |
| Success story | Agent | A6 |
| Doctor callback | Doctor | M8 |

## Location issue

| Action | Owner | Screen |
|--------|-------|--------|
| Nearest branch | Agent | A8 |
| Map and travel information | Agent | A6 |
| Video consultation | Front Desk | A8 |
| Camp or satellite consultation | Marketing | [O4](../screens/04-operations-screens.md#o4-recovery--reactivation-console) |
| Suitable appointment timing | Front Desk | A8 |

## Appointment no-show

| Action | Owner | Screen |
|--------|-------|--------|
| Rescheduling | Front Desk | [O1](../screens/04-operations-screens.md#o1-appointment-calendar--no-show-board) |
| Reminder sequence | System | O1 |
| Call before appointment | Agent | O1 |
| RCS/MMS appointment card | System | A6 |
| Video consultation alternative | Front Desk | A8 |
| No-show reason capture | Agent | O1 |

## Follow-up missed

| Action | Owner | Screen |
|--------|-------|--------|
| Agent alert | System | [A7](../screens/01-agent-screens.md#a7-daily-tasks) |
| Manager escalation | Manager | [M4](../screens/02-manager-screens.md#m4-follow-up-compliance--overdue-queue) |
| Automatic rescheduling | System | [A5](../screens/01-agent-screens.md#a5-follow-up-update) |
| Follow-up compliance report | Manager | M4 |
| Hot Lead overdue queue | Manager | M4 |

## Poor source quality

| Action | Owner | Screen |
|--------|-------|--------|
| Campaign qualification questions | Marketing | [S1](../screens/05-admin-screens.md#s1-lead-intake--source-configuration) |
| Location filtering | Marketing | S1 |
| Audience correction | Marketing | S1 |
| Creative change | Marketing | [L2](../screens/03-leadership-screens.md#l2-source--campaign-roi) |
| Landing page improvement | Marketing | L2 |
| Campaign reduction or pause | Leadership | L2 |

## Recovery campaigns

The [Section 30.9](../docs/THESIS.md#309-recovery-campaign-module) campaign types, each drawing from the reason that created them. All run in [O4](../screens/04-operations-screens.md#o4-recovery--reactivation-console).

| Campaign | Draws from | Content anchored to |
|----------|-----------|---------------------|
| Price recovery | Financial reasons | Financial counseling update, EMI, insurance support |
| No-show recovery | Appointment no-show | Reschedule offer, appointment card, video alternative |
| Doctor-trust recovery | Doctor confidence, requested another doctor | Doctor profile, credentials, success story |
| Surgery-fear recovery | Surgery fear | Procedure explainer, recovery timeline, testimonial |
| 30 / 60 / 90-day reactivation | Postponed, wants to wait, waiting for insurance, non-urgent | Doctor availability, new branch, treatment education, health check reminder |
