# Clinical & Operations Screens

Four screens. These cover the stages of the lifecycle after the patient agrees to come in — where, per [Section 17](../docs/THESIS.md#17-appointment-and-conversion-management), a lead can still be lost in four different ways that each need a different fix.

---

## O1. Appointment Calendar & No-show Board

**Purpose** — Protect the visit, and recover it when it fails.

**Users** — Front desk, Manager, Agent

**Thesis** — [17](../docs/THESIS.md#17-appointment-and-conversion-management), [24](../docs/THESIS.md#24-reason-based-corrective-action), [30.6](../docs/THESIS.md#306-appointment-module)

**Data shown**

Calendar by doctor, branch and day, with each slot carrying its appointment state from the Section 17 list: Suggested · Patient Considering · Booked · Confirmation Pending · Confirmed · Rescheduled · Cancelled · No-show · Patient Arrived · Consultation Completed.

Side panels:

- **Confirmation queue** — booked but unconfirmed, sorted by how close the appointment is, with reminder history per patient.
- **No-show board** — yesterday's and today's no-shows, each with a captured reason, a recovery owner, and the state of the recovery attempt.
- **Arrival board** — today's expected patients, marked as they arrive.

Metrics strip: booked, confirmed, arrived, no-show rate, no-show recovery rate, average confirmations per kept appointment.

**Actions** — Book · Confirm · Reschedule with reason · Cancel with reason · Mark arrived · Mark no-show with reason · Trigger the recovery sequence · Offer a video consultation alternative.

**Guards**

- No-show requires a reason and immediately creates a recovery task; it is never a dead end (Section 24).
- The reminder sequence — confirmation call, RCS/MMS appointment card, day-before reminder, morning-of reminder — is system-driven and its completion is tracked per appointment, so a no-show can be attributed to a missing reminder rather than to the patient.
- Cancellation by the hospital and cancellation by the patient are separate reasons and report separately.

**Exit** — O2, A8, M8.

---

## O2. Financial Counseling Desk

**Purpose** — Close the gap between "surgery advised" and "surgery booked".

**Users** — Financial Counselor, Manager

**Thesis** — [17](../docs/THESIS.md#17-appointment-and-conversion-management), [24](../docs/THESIS.md#24-reason-based-corrective-action), [30.7](../docs/THESIS.md#307-conversion-module)

**Data shown**

Queue of patients in the post-consultation states: Surgery Advised · Financial Counseling Pending · Financial Counseling Completed · Insurance Approval Pending · Surgery Date Pending · Surgery Booked.

Per patient: advised procedure, quoted package, patient's stated budget, gap, insurance provider and status, EMI eligibility, discount requested and approval state, family decision-maker, objection history from call remarks, counseling attempts and outcomes.

Aggregates: counseling coverage rate — of patients advised surgery, how many actually received counseling — plus conversion rate with counseling versus without, average gap closed, discount usage and its conversion effect.

**Actions** — Log a counseling session · Explain package (sends the approved package comparison creative) · Check insurance · Offer EMI · Raise a discount request · Escalate to doctor · Book surgery · Close as lost with reason (routes to A9).

**Guards**

- A patient cannot be closed as lost for a price reason unless a counseling session has been logged, or the absence of counseling is itself recorded as the reason. Section 33's worked example — four of seven price objectors never received counseling — is exactly the failure this guard prevents.
- Discount requests carry amount, justification, approver and outcome into the audit log (Section 29).
- Counseling coverage is reported to M6 as process compliance, not as an outcome number.

**Exit** — O3, A9, M8.

---

## O3. IPD / Admission Management

**Purpose** — Carry the conversion through admission, treatment and recorded revenue.

**Users** — IPD coordinator, Manager

**Thesis** — [4](../docs/THESIS.md#4-complete-lead-lifecycle), [17](../docs/THESIS.md#17-appointment-and-conversion-management), [30.7](../docs/THESIS.md#307-conversion-module)

**Data shown** — patients at lifecycle stages 17 to 20: Surgery Booked · Admission Completed · Treatment Completed · Converted Revenue Recorded.

Per patient: scheduled procedure date, surgeon, branch, room category, admission checklist, insurance pre-authorisation state, package versus final billed amount and the variance reason, discharge date, treatment completion, revenue posted, source and campaign carried through from intake.

Board view of upcoming admissions and pending pre-authorisations.

**Actions** — Confirm admission · Update procedure status · Record final amount with variance reason · Mark treatment complete · Post revenue · Handle a cancellation after booking with a reason.

**Guards**

- Revenue posts against the originating lead, so the source-to-revenue chain of Section 34 stays unbroken all the way to L2's cost per surgery.
- A change between quoted package and final amount requires a reason and is audited (Section 29).
- A cancellation at this stage routes to A9 like any other loss — a late loss is still a diagnosed loss.

**Exit** — L2, A9.

---

## O4. Recovery & Reactivation Console

**Purpose** — Turn the lost pool back into revenue.

**Users** — Manager, Recovery agent, Marketing

**Thesis** — [19](../docs/THESIS.md#19-expired-lead-segmentation), [20](../docs/THESIS.md#20-three-month-reactivation-mechanism), [30.9](../docs/THESIS.md#309-recovery-campaign-module)

**Data shown**

**Segments** — the four Section 19 buckets with counts and estimated recoverable revenue: Recoverable · Long-Term Nurture · Genuine Lost · Invalid / Non-Actionable.

**Recovery campaigns** — one per reason, per Section 30.9: price recovery · no-show recovery · doctor-trust recovery · surgery-fear recovery. Each shows its eligible pool, the content mapped to that reason, the send schedule, and the results.

**90-day reactivation pool** — leads whose review date has arrived, with the original reason, days since closure, and the reactivation content matched to that reason: financial counseling update · doctor availability · new branch · insurance support · treatment education · relevant testimonial · health check reminder.

**Eligibility panel** — included: postponed treatment, cost concerns, wanted time, waiting for insurance, non-urgent symptoms, appointment no-shows, asked to be contacted later. Excluded: opted out, wrong number, invalid lead, firmly not interested, already treated, clinically ineligible, do-not-contact.

**Results** — reactivation sends, replies, re-engagements, appointments, conversions, revenue, and recovery rate per reason.

**Actions** — Build a campaign from a segment · Preview the eligible list · Schedule · Launch · Assign a recovery agent · Re-enter a responding lead into an active follow-up plan · Retire a lead permanently with a reason.

**Guards**

- Excluded leads cannot be added to any campaign, including by manual override. Section 20's exclusion list is enforced, not advisory.
- Reactivation uses the same alternating channel framework — WhatsApp for one reactivation, RCS/MMS for the next — and the same 48-hour floor. Reactivation is a new activity, never a resumption of the original cycle.
- Reactivation content must map to the original closure reason; generic "are you interested" sends are blocked (Section 11).
- A lead that re-engages leaves the pool and returns to A4 for fresh qualification.

**Exit** — A4, A1, L4.
