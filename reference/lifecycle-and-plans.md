# Lifecycle, Statuses and Follow-up Plans

The state vocabulary and the four follow-up schedules. From [Section 4](../docs/THESIS.md#4-complete-lead-lifecycle), [12](../docs/THESIS.md#12-revised-hot-lead-follow-up), [13](../docs/THESIS.md#13-revised-warm-lead-follow-up), [14](../docs/THESIS.md#14-revised-cold-lead-follow-up), [15](../docs/THESIS.md#15-revised-not-connected-follow-up) and [17](../docs/THESIS.md#17-appointment-and-conversion-management). Configured in [S4](../screens/05-admin-screens.md#s4-status-reason-code--sla-configuration).

## The 20 lifecycle stages

| # | Stage | # | Stage |
|---|-------|---|-------|
| 1 | Lead Received | 11 | Appointment Booked |
| 2 | Source Identified | 12 | Appointment Confirmed |
| 3 | Lead Assigned | 13 | Patient Visited |
| 4 | First Contact Attempted | 14 | Consultation Completed |
| 5 | Connected or Not Connected | 15 | Treatment or Surgery Advised |
| 6 | Patient Requirement Identified | 16 | Financial Counseling Completed |
| 7 | Disease Categorised | 17 | Surgery or Procedure Booked |
| 8 | Lead Qualified as Hot, Warm or Cold | 18 | Admission Completed |
| 9 | Follow-up Plan Activated | 19 | Treatment Completed |
| 10 | Appointment Suggested | 20 | Converted Revenue Recorded |

## Exit statuses

Available from any stage. Every one requires a reason ([Section 3.3](../docs/THESIS.md#33-no-final-closure-without-a-reason)).

Not Connected · Not Interested · Follow-up Later · Appointment No-show · Chose Competitor · Financial Issue · Out of Service Area · Clinically Not Eligible · Already Treated · Duplicate Lead · Invalid Lead · Lead Expired

The system records exactly which stage the lead exited from, not only that it exited.

## Appointment states — Section 17

Suggested · Patient Considering · Booked · Confirmation Pending · Confirmed · Rescheduled · Cancelled · No-show · Patient Arrived · Consultation Completed

## Post-consultation states — Section 17

Medical Management Advised · Tests Advised · Surgery Advised · Financial Counseling Pending · Financial Counseling Completed · Insurance Approval Pending · Surgery Date Pending · Surgery Booked · Surgery Completed · Lost After Consultation

These exist because four different patients fail four different ways: one never answered, one booked but did not visit, one visited but declined surgery, one accepted surgery but could not arrange finance. Each needs a different fix.

## Follow-up plans

The 48-hour floor applies to **planned messages only**. Calls are scheduled on patient priority and are never blocked by it ([Section 8](../docs/THESIS.md#8-revised-communication-thesis-48-hour-messaging-pattern)).

### Hot Lead — 5 to 7 days

| Day | Call | Message |
|-----|------|---------|
| 1 | Immediate priority call | WhatsApp introduction and relevant information |
| 2 | Call if response or urgency requires it | None |
| 3 | Priority follow-up call | RCS/MMS visual message |
| 4 | Call based on patient commitment | None |
| 5 | Appointment or objection-resolution call | WhatsApp follow-up |
| 6–7 | Final active-stage call | RCS/MMS or final action message, when required |

**Exit routing after the active period:** converted → conversion process · appointment booked → confirmation · interested but undecided → Warm · unreachable → Not Connected outcome · clearly uninterested → Final Reason Analysis · recoverable → targeted recovery queue.

### Warm Lead — 15 days

| Day | Communication |
|-----|---------------|
| 1 | Call + WhatsApp |
| 3 | RCS/MMS |
| 5 | Call + WhatsApp |
| 7 | RCS/MMS |
| 9 | Call + WhatsApp |
| 11 | RCS/MMS |
| 13 | Call + WhatsApp |
| 15 | Final qualification call + RCS/MMS or appropriate closure message |

Extra calls may be added for: patient response, appointment intention, report availability, family decision, financial discussion, doctor recommendation, clinical urgency.

**Day 15 is a hard decision point.** The lead must become one of: Hot · Still Warm with a future date · Cold · Appointment Booked · Converted · Not Interested · Not Connected · Chose Competitor · Follow-up After a Defined Period · Lead Expired. A generic "follow-up" status is not available.

### Cold Lead — monthly

| When | Activity |
|------|----------|
| Day 1 | Call + WhatsApp |
| Week 2 | One call or RCS/MMS education message |
| Week 3 | One WhatsApp message |
| Week 4 | One call + final monthly qualification |
| Thereafter | Long-term nurture or closure |

Content: disease awareness · preventive information · doctor availability · camp announcements · new branch information · patient education. **Not** price offers or aggressive surgery messaging.

### Not Connected — 5 days

| Day | Action |
|-----|--------|
| 1 | Double dial + WhatsApp |
| 2 | No routine message; call attempted at a different time |
| 3 | Double dial + RCS/MMS |
| 4 | Alternative-time call attempt |
| 5 | Double dial + final WhatsApp communication |

Double dial = two call attempts separated by a reasonable interval.

Recorded per attempt: first attempt time · second attempt time · call result · message channel · delivery status · number validity · WhatsApp existence · RCS support · whether the patient replied by message.

A connect at any point forces immediate Hot/Warm/Cold qualification.

**Outcomes:** Unreachable · Invalid Number · Wrong Number · Retry Later · Final Not Connected · Eligible for controlled reactivation.

## Channel rotation — Sections 9 and 10

System-driven, never left to the agent's memory.

| Touch | Channel | Typical content |
|-------|---------|-----------------|
| 1 | WhatsApp | Introduction, hospital name, reason for contact, doctor information, call-back request, treatment information |
| 2 (+48h) | RCS / MMS | Treatment awareness image, doctor profile, hospital credibility, appointment card, procedure explainer |
| 3 (+48h) | WhatsApp | Continues the conversation — must not repeat touch 1 |
| 4 (+48h) | RCS / MMS | Testimonial, recovery, insurance, financial counseling, consultation benefits |
| 5+ | Alternating | Per the active plan |

## Nurture content sequence — Section 11

Channel rotation alone is not enough; the content must also progress.

| # | Communication | Carries |
|---|---------------|---------|
| 1 | Acknowledgement | Enquiry received, contact attempted, request a suitable call time |
| 2 | Education | Disease information, symptoms, when consultation is needed, risk of delay |
| 3 | Trust | Doctor experience, facilities, treatment volume, technology, credentials |
| 4 | Treatment Understanding | Procedure process, duration, recovery, pain management, hospital stay |
| 5 | Social Proof | Testimonial, success story, FAQs |
| 6 | Financial Support | Insurance, EMI, package explanation, financial counseling |
| 7 | Action | Appointment booking, call-back, video consultation, branch selection, preferred time |

## Message suppression conditions — Section 12

A scheduled message is suppressed, and the suppression logged, when the patient has already responded · an appointment is booked · a later date was requested · the patient opted out · a doctor has taken over communication · the patient is admitted · the patient has converted.

## Blocked at all times — Section 10

Duplicate communication · repeated use of the same content · the same message across multiple channels simultaneously · any communication after opt-out · lead follow-up templates to a converted patient · messaging invalid or do-not-contact numbers.
