# Agent / Telecaller Screens

Nine screens. This is where the operating philosophy of [Section 3](../docs/THESIS.md#3-crm-operating-philosophy) is enforced: no call closes without a remark, no lead closes without a reason.

---

## A1. My Leads

**Purpose** — What must I work on, in what order?

**Users** — Agent, Manager (view any agent's queue)

**Thesis** — [4](../docs/THESIS.md#4-complete-lead-lifecycle), [7](../docs/THESIS.md#7-lead-quality-classification), [12–15](../docs/THESIS.md#12-revised-hot-lead-follow-up)

**Data shown**

Queue tabs, ordered by urgency: `Fresh (uncalled)` · `Hot due` · `Not Connected due` · `Warm due` · `Cold due` · `Appointment pending confirmation` · `Overdue` · `All`.

Row columns:

| Column | Note |
|--------|------|
| Patient name, phone | Phone masked per role permission |
| Disease | Category, not free text |
| Source / Campaign | From intake, never editable by agent |
| Quality | Hot / Warm / Cold / Unqualified |
| Stage | Lifecycle stage 1–20 |
| Day in plan | e.g. `Hot Day 3 of 7` |
| Next action | Call / WhatsApp / RCS-MMS |
| Next action due | Time; red when overdue |
| Last remark | Truncated, hover for full |
| Last channel used | Drives the alternation rule |
| SLA | First-response countdown on fresh leads |

**Actions** — Open lead · Quick call (logs an attempt) · Snooze with mandatory reason · Request reassignment · Bulk-select for a compliant message batch.

**Guards**

- Fresh leads sort to the top and cannot be hidden until a first attempt is logged.
- Overdue count is visible to the agent and to the manager simultaneously — it cannot be dismissed locally.
- Bulk messaging is blocked for any lead inside its 48-hour cooldown, opted out, converted, or flagged do-not-contact.

**Exit** — A2 Lead Detail, A3 Call Logging.

---

## A2. Lead Detail (360 View)

**Purpose** — Everything known about this patient and everything that has been done to them.

**Users** — Agent (own leads), Manager, Leadership (read-only)

**Thesis** — [3](../docs/THESIS.md#3-crm-operating-philosophy), [4](../docs/THESIS.md#4-complete-lead-lifecycle), [5](../docs/THESIS.md#5-lead-intake-and-source-configuration), [29](../docs/THESIS.md#29-evidence-and-audit-trail)

**Data shown** — Five panels.

1. **Identity** — name, phone, alternate phone, WhatsApp availability, RCS support flag, city, distance from branch, language, consent and opt-out status.
2. **Attribution** (read-only) — source, campaign, ad set, creative, landing page, lead form, disease, date and time of lead generation. Section 3.1 makes every field mandatory at intake.
3. **Qualification** — Hot/Warm/Cold, lead score with contributing factors, symptom severity, duration, urgency, financial readiness, insurance, decision authority, appointment readiness.
4. **Lifecycle timeline** — the 20 stages rendered as a rail with the current stage marked and every past transition timestamped, attributed and reasoned.
5. **Activity history** — chronological, append-only: every call attempt and result, every message with channel/template/content/delivery/read/reply, every status change, every reassignment, every discount request, every doctor callback, every financial counseling touch.

Right rail: next scheduled action, active follow-up plan and day number, last channel used, next allowed message time, recoverability flag, responsible person.

**Actions** — Log call · Send message · Update qualification · Book appointment · Change status (reason required) · Escalate · Request doctor callback · Request financial counseling · Request discount · Add remark.

**Guards**

- Activity history is append-only. Corrections post a new correcting entry that references the original; nothing is overwritten (Section 29).
- Attribution fields are locked after intake. Changes require admin rights and are audited.
- Status cannot move to any closure value from this screen directly — it routes through A9.

**Exit** — Any agent screen; A9 on closure.

---

## A3. New Call / Call Logging

**Purpose** — Turn a call into a structured, evidenced record.

**Users** — Agent

**Thesis** — [3.2](../docs/THESIS.md#32-no-call-without-a-remark), [6](../docs/THESIS.md#6-connected-and-not-connected-mechanism)

**Data shown / captured**

Step 1 — **Outcome**: Connected, or Not Connected with sub-reason (no answer, busy, switched off, out of network, call rejected, invalid number, wrong number, phone unavailable, repeatedly unreachable).

Step 2, when connected — **Structured remark**, seven required parts per Section 3.2:

| Field | Input |
|-------|-------|
| Whether the call connected | auto from step 1 |
| What the patient said | free text, minimum length enforced |
| What the agent explained | multi-select of talk points + free text |
| What objection was raised | picklist from the [reason taxonomy](../reference/reason-codes.md) + free text |
| What material was shared | template picker, links to the sent message record |
| What the next action is | Call / WhatsApp / RCS-MMS / Appointment / Escalate / Close |
| When the next action must happen | date-time, pre-filled from the active follow-up plan |

Step 3, when not connected — attempt number, time of attempt, whether this completes a double dial, whether the alternative-time slot has been tried.

Also captured: call duration, recording link where available, who else was on the line (family, decision maker).

**Actions** — Save and return to queue · Save and open qualification · Save and compose message · Save and escalate.

**Guards**

- Save is disabled until every required remark part is filled. This is the hard implementation of *No Call Without a Remark*.
- "Not Connected" on a fresh lead automatically enrols the lead in the 5-day Not Connected plan (Section 15).
- A connect during the Not Connected plan forces an immediate Hot/Warm/Cold qualification before the agent can leave the screen (Section 15).
- Free-text remarks cannot be edited after 15 minutes; later corrections append.

**Exit** — A4 if newly connected, A5 otherwise.

---

## A4. Qualification & Scoring

**Purpose** — Classify the lead on evidence, not on feeling.

**Users** — Agent

**Thesis** — [7](../docs/THESIS.md#7-lead-quality-classification), [30.3](../docs/THESIS.md#303-qualification-module)

**Data shown / captured**

Eleven scoring factors, each an explicit input rather than a judgement:

symptom severity · duration of problem · treatment urgency · distance from hospital · financial readiness · appointment readiness · decision-making authority · previous treatment · insurance availability · interest in consultation · interest in surgery.

Plus: disease category, sub-condition, investigations already done, referring doctor.

The screen computes a suggested classification and displays the indicator checklist for each band side by side, so the agent can see which Hot / Warm / Cold indicators actually matched.

**Actions** — Accept the suggested classification · Override with a written justification · Save and activate the matching follow-up plan.

**Guards**

- An override away from the computed score requires a justification and is surfaced on M6 as a qualification-accuracy signal (Section 28).
- Saving a classification activates the corresponding follow-up plan automatically — Hot 5–7 days, Warm 15 days, Cold monthly. The agent does not hand-build schedules.

**Exit** — A5 Follow-up Update.

---

## A5. Follow-up Update

**Purpose** — Advance the lead's plan and set the next action.

**Users** — Agent

**Thesis** — [12](../docs/THESIS.md#12-revised-hot-lead-follow-up), [13](../docs/THESIS.md#13-revised-warm-lead-follow-up), [14](../docs/THESIS.md#14-revised-cold-lead-follow-up), [15](../docs/THESIS.md#15-revised-not-connected-follow-up), [16](../docs/THESIS.md#16-follow-up-and-nurturing-are-part-of-the-same-process), [30.5](../docs/THESIS.md#305-follow-up-scheduler)

**Data shown**

The active plan rendered as a day grid — for a Hot Lead, Days 1 through 7 with the call activity and the message activity on each day, marked done / due / skipped / suppressed. Warm shows the 15-day alternating grid; Cold shows the four-week pattern; Not Connected shows the five-day double-dial pattern.

Alongside: plan day number, days remaining, completion percentage, suppression reasons currently active.

**Actions** — Mark today's touch complete · Reschedule a touch with reason · Change lead quality (routes to A4) · Extend or end the plan · Move to appointment (A8) · Move to closure (A9).

**Guards**

- Scheduled messages are suppressed, not sent, when any Section 12 condition holds: patient already responded, appointment booked, later date requested, opted out, doctor has taken over, patient admitted, patient converted. The suppression and its reason are logged.
- At Warm Day 15 the lead cannot stay in a generic "follow-up" status. The screen forces a deliberate classification into one of the ten Section 13 outcomes.
- Ending a plan without conversion routes to A9. There is no silent expiry.

**Exit** — A6, A8, A9, or back to A1.

---

## A6. Communication Composer

**Purpose** — Send the right content, on the right channel, at the right time.

**Users** — Agent

**Thesis** — [8](../docs/THESIS.md#8-revised-communication-thesis-48-hour-messaging-pattern), [9](../docs/THESIS.md#9-alternating-whatsapp-and-mobile-rich-communication), [10](../docs/THESIS.md#10-channel-orchestration-logic), [11](../docs/THESIS.md#11-communication-content-must-follow-a-nurturing-sequence), [30.4](../docs/THESIS.md#304-communication-module)

**Data shown**

- **Channel** — pre-selected by the system from the rotation, not by the agent. Shows: last channel used, hours elapsed, next allowed send time, and which channel is next in the WhatsApp → RCS/MMS alternation.
- **Nurture position** — which of the seven Section 11 communications this patient is due (Acknowledgement → Education → Trust → Treatment Understanding → Social Proof → Financial Support → Action), with the ones already sent greyed out.
- **Template picker** — approved templates only, filtered to the current nurture step, current disease and current channel. Rich content available: doctor image, hospital image, treatment card, procedure benefit card, education poster, appointment reminder creative, testimonial, insurance info, financial counseling info, location card, recovery timeline, before-visit checklist, call-back request card.
- **Preview** — exact rendering per channel.
- **History strip** — the last five communications with channel, template, delivery, read and reply status.

**Actions** — Send now · Schedule at next allowed slot · Request an exception send (manager approval) · Mark patient reply received.

**Guards** — the 48-hour engine, enforced here rather than trusted to memory:

- Send is blocked before 48 hours have elapsed since the previous planned message.
- The same channel twice in a row is blocked; the rotation decides.
- The same template twice to the same patient is blocked.
- Simultaneous send across two channels is blocked.
- Sending is blocked entirely for: opted out, do-not-contact, invalid number, converted patient on a lead template.
- Cold Leads are blocked from price-offer and aggressive-surgery templates (Section 14).
- An urgent call is never blocked by this screen — the 48-hour rule governs messages only (Section 8).

**Exit** — A2, A5.

---

## A7. Daily Tasks

**Purpose** — The agent's day, in execution order.

**Users** — Agent

**Thesis** — [12–15](../docs/THESIS.md#12-revised-hot-lead-follow-up), [31](../docs/THESIS.md#31-managers-daily-working-pattern)

**Data shown** — Sectioned worklist: overdue from yesterday · fresh leads awaiting first response with SLA countdown · Hot calls due today · Not Connected double dials due · Warm touches due · Cold touches due · appointment confirmations due · post-consultation follow-ups due · doctor callbacks promised · financial counseling handoffs pending.

Header counters: assigned, completed, remaining, missed, first-response average today.

**Actions** — Work item (opens the right screen) · Mark complete · Reschedule with reason · Escalate.

**Guards** — Missed items roll forward and stay visible; they cannot be cleared without a reason, and they feed M4 and M6.

**Exit** — Whichever screen the task requires.

---

## A8. Appointment Booking

**Purpose** — Book, confirm and protect the visit.

**Users** — Agent, Front desk

**Thesis** — [17](../docs/THESIS.md#17-appointment-and-conversion-management), [30.6](../docs/THESIS.md#306-appointment-module)

**Data shown** — Doctor, branch, date, time, slot availability, consultation type (in-person or video), estimated consultation fee, travel and map information, preparation instructions, accompanying family member.

Appointment state, from the Section 17 list: Suggested · Patient Considering · Booked · Confirmation Pending · Confirmed · Rescheduled · Cancelled · No-show · Patient Arrived · Consultation Completed.

Reminder plan: confirmation call, RCS/MMS appointment card, day-before reminder, morning-of reminder.

**Actions** — Suggest · Book · Confirm · Reschedule with reason · Cancel with reason · Mark arrived · Mark no-show with reason.

**Guards**

- Cancel and no-show both require a reason from the taxonomy — they are closure-adjacent events and Section 3.3 applies.
- A no-show automatically creates a recovery task and adds the lead to the no-show recovery segment (Section 24).
- Booking suppresses routine follow-up messaging and switches the lead to the appointment reminder sequence (Section 12).

**Exit** — O1 Appointment Calendar, O2 Financial Counseling Desk.

---

## A9. Non-Conversion Reason Capture

**Purpose** — No lead closes without a diagnosed, evidenced, actionable reason.

**Users** — Agent (submit), Manager (review)

**Thesis** — [3.3](../docs/THESIS.md#33-no-final-closure-without-a-reason), [18](../docs/THESIS.md#18-lead-expiry-and-post-expiry-diagnosis), [19](../docs/THESIS.md#19-expired-lead-segmentation), [23](../docs/THESIS.md#23-mandatory-non-conversion-reason-structure)

**Data captured** — the eight mandatory fields of Section 23:

| Field | Input |
|-------|-------|
| Primary reason | Category from the [reason taxonomy](../reference/reason-codes.md) |
| Secondary reason | Sub-reason within that category |
| Detailed remark | Free text, minimum length |
| Evidence source | Link to a specific call remark, message record, appointment record or counseling record |
| Recoverable | Yes / No |
| Recommended action | Auto-suggested from the [reason-to-action map](../reference/corrective-actions.md), editable |
| Responsible person | User picker |
| Review date | Date |

Plus, for genuine losses: competitor name where known, and the learning to be carried forward (Section 18).

The screen also assigns the Section 19 segment: Recoverable · Long-Term Nurture · Genuine Lost · Invalid / Non-Actionable.

**Actions** — Submit closure · Save as draft · Request manager review.

**Guards**

- Operational status "Lead Expired" alone is rejected. A business reason is mandatory (Section 18).
- Evidence source must resolve to a real activity record — it cannot be typed free-hand.
- Recoverable = Yes requires both a recommended action and a review date, and enrols the lead in the appropriate recovery segment for O4.
- Recoverable = No excludes the lead from the 90-day reactivation pool (Section 20).

**Exit** — O4 Recovery & Reactivation Console, or archive.
