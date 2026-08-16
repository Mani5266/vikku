# Reason Code Taxonomy

The closed vocabulary for closing a lead. From [Section 23](../docs/THESIS.md#23-mandatory-non-conversion-reason-structure). Configured in [S4](../screens/05-admin-screens.md#s4-status-reason-code--sla-configuration), captured in [A9](../screens/01-agent-screens.md#a9-non-conversion-reason-capture).

## Mandatory fields on every closure

| Field | Required | Note |
|-------|----------|------|
| Primary reason | Yes | Category below |
| Secondary reason | Yes | Sub-reason within the category |
| Detailed remark | Yes | Free text, minimum length |
| Evidence source | Yes | Must resolve to a real activity record |
| Recoverable | Yes | Yes / No |
| Recommended action | Yes | Defaults from the [corrective action map](corrective-actions.md) |
| Responsible person | Yes | User |
| Review date | Yes when recoverable | Date |

## Categories

### Financial

| Sub-reason | Default recoverable | Default action |
|------------|--------------------|----------------|
| Treatment cost high | Yes | Financial counselor call |
| Discount requested | Yes | Controlled discount approval |
| EMI required | Yes | EMI option |
| Insurance unavailable | Yes | Insurance check |
| Budget insufficient | Yes | Package explanation, value comparison |
| Financial counseling not completed | Yes | Counselor call — this is a process failure, not a patient decision |

### Interest

| Sub-reason | Default recoverable | Default action |
|------------|--------------------|----------------|
| Not interested | No | Close |
| General enquiry | No | Long-term nurture |
| No current requirement | Yes | Long-term nurture |
| Wants to wait | Yes | 90-day reactivation |
| Symptoms reduced | Yes | Health check reminder |
| Surgery fear | Yes | Doctor counseling, procedure explainer |

### Follow-up Failure

Every sub-reason here is recoverable, because the loss was caused by the hospital rather than by the patient.

| Sub-reason | Default recoverable | Default action |
|------------|--------------------|----------------|
| First response delayed | Yes | Immediate re-engagement, SLA review |
| Follow-up missed | Yes | Agent alert, manager escalation |
| Insufficient calls | Yes | Reschedule the plan |
| Message not sent | Yes | Send, and investigate the scheduler |
| Wrong information provided | Yes | Corrective call, agent coaching |
| Patient query unresolved | Yes | Escalate to doctor or counselor |

### Hospital or Doctor

| Sub-reason | Default recoverable | Default action |
|------------|--------------------|----------------|
| Doctor confidence issue | Yes | Doctor profile, credentials, callback |
| Requested another doctor | Yes | Reassign doctor |
| Hospital too far | Yes | Nearest branch, video consultation |
| Branch unavailable | Yes | Alternative branch or camp |
| Appointment timing unsuitable | Yes | Suitable slot |
| Waiting time issue | Yes | Priority slot, process review |

### Competition

| Sub-reason | Default recoverable | Default action |
|------------|--------------------|----------------|
| Chose another hospital | No | Capture competitor name and the learning |
| Lower competitor price | Sometimes | Value comparison if pre-treatment |
| Continued with existing doctor | No | Long-term nurture |
| Preferred local facility | No | Note location gap for branch planning |

### Lead Quality

Not recoverable, but each one is a campaign signal that routes to [L2](../screens/03-leadership-screens.md#l2-source--campaign-roi).

| Sub-reason | Default recoverable | Campaign signal |
|------------|--------------------|-----------------|
| Wrong number | No | Lead form quality |
| Duplicate | No | Duplicate detection rules |
| Fake lead | No | Audience or creative quality |
| Out of location | No | Location targeting |
| Unrelated enquiry | No | Creative and landing page relevance |
| Already treated | No | Audience exclusion |

### Contactability

| Sub-reason | Default recoverable | Default action |
|------------|--------------------|----------------|
| Not lifting | Yes | Alternative-time attempts, controlled reactivation |
| Switched off | Yes | Retry schedule |
| Call rejected | Sometimes | Message-first approach |
| Invalid number | No | Lead form validation signal |
| No WhatsApp | Yes | RCS/MMS or SMS only |
| Repeatedly unreachable | No | Final Not Connected |

## Segment assignment

Every closure also lands in one of the four [Section 19](../docs/THESIS.md#19-expired-lead-segmentation) segments, which drives eligibility in [O4](../screens/04-operations-screens.md#o4-recovery--reactivation-console).

| Segment | Contains | Reactivation eligible |
|---------|----------|----------------------|
| Recoverable | Small price gap, EMI required, insurance pending, no-show, family approval pending, doctor callback required, surgery fear, follow-up missed, wants a second opinion | Yes |
| Long-Term Nurture | Treatment in one or two months, waiting for leave, waiting for family support, symptoms manageable, awaiting reports | Yes, on a longer cycle |
| Genuine Lost | Already treated elsewhere, permanently relocated, clinically not eligible, no treatment required, firmly declined further contact | No |
| Invalid / Non-Actionable | Wrong number, fake data, duplicate, unrelated enquiry, out of service area with no support possible, invalid contact information | No |
