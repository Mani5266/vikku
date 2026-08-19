// The rest of the working desk.
//
// `seed.js` holds nine leads, and every one of them exists to make a specific communication guard
// reachable from the interface — the 48-hour floor, the rotation, the opt-out, the dead number.
// That made it a good test fixture and a poor demonstration: signing in as an agent showed five
// leads, four of which were edge cases, and nothing about the day an agent actually works.
//
// This file adds thirty-six more so the product can be seen doing its job. It is not random
// filler. Every lead is placed deliberately, and the `shows` field on each row says what it is
// there to demonstrate — which is also how the coverage below stays checkable rather than claimed:
//
//   · **All five Today buckets, populated for both demo agents.** Ring now, behind, due today,
//     waiting, finished. Previously an agent could sign in and see three of the five.
//   · **All ten §17 appointment states.** Suggested through Consultation Completed, including the
//     three that are not a dead end — Rescheduled, Cancelled and No-show — so the appointment
//     screen has something to transition.
//   · **Seven §23 closure categories**, each with a real cited evidence record, so the closure
//     screen, the recovery segments and the escalation desk all read from something.
//   · **All eight diseases, all seven sources, both branches, four agents.** The manager and
//     leadership screens were computing over the 1,500-journey dataset already; the live store now
//     has enough spread that a filtered agent view is not one row.
//
// Two rules this file holds to, both the same rule the generator holds to:
//
//   1. **Nothing random.** Every value is written down. `hoursBefore` is the only clock, and it is
//      relative to the same `now` the rest of the seed uses, so a demo at 9am and a demo at 6pm
//      show the same leads in the same buckets.
//   2. **The first nine leads are untouched.** Tests assert on Priya Sharma, on lead_003's
//      composer and on lead_009's dead number. Adding data must not move them.

import { hoursBefore } from "../lib/utils.js";

/**
 * Which bucket a row lands in is decided by `calls` against what the protocol owed by `day`:
 *
 *   Hot           calls on days 1, 3, 5, 7        Warm  calls on days 1, 5, 9, 13, 15
 *   Cold          calls on days 1 and 22          Not Connected  a call every day to day 5
 *
 * `calls: 0` with a lead older than the five-minute SLA is *Ring now*. Fewer calls than the plan
 * owed is *Behind*. Exactly what it owed, on a day the plan asks for a call, is *Due today*.
 * Exactly what it owed on a quiet day is *Waiting*. A booked appointment or a closure is *Finished*.
 */
const ROWS = [
  // ---- Nikhil Rao (agent123), Jayanagar ---------------------------------------------------
  {
    id: "lead_010", name: "Kavya Reddy", phone: "+91 98450 30412", disease: "Piles",
    source: "Meta Ads", campaign: "Piles — Jayanagar — Aug", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Hot", day: 1, ageHours: 3, calls: 0,
    shows: "Ring now — a Hot lead three hours old that nobody has called. The manager's SLA alert fires on this one.",
  },
  {
    id: "lead_011", name: "Arun Pillai", phone: "+91 99012 88431", disease: "Hernia",
    source: "Google Ads", campaign: "General Surgery — Aug", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Hot", day: 1, ageHours: 0.05, calls: 0,
    shows: "Ring now, still inside the five-minute clock — the only state where the first-call duty is not yet a breach.",
  },
  {
    id: "lead_012", name: "Rekha Joshi", phone: "+91 97411 20654", disease: "Varicose Veins",
    source: "YouTube", campaign: "Explainer — Varicose Veins", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Warm", day: 1, ageHours: 26, calls: 0,
    shows: "Ring now, more than a day late. Worst row on the queue and it sorts to the top.",
  },
  {
    id: "lead_013", name: "Sanjay Gupta", phone: "+91 90360 77128", disease: "Knee Replacement",
    source: "Camp", campaign: "Camp — Kanakapura Road", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Cold", day: 1, ageHours: 8, calls: 0,
    shows: "A Cold lead still owes a first call. Low urgency is not no urgency.",
  },
  {
    id: "lead_014", name: "Meena Rao", phone: "+91 98801 44093", disease: "Thyroid",
    source: "Website", campaign: "Organic — Website", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Hot", day: 5, ageHours: 120, calls: 1,
    objection: ["Interest", "Wants to wait"],
    said: "Wants to finish a family function first, will decide after the 20th.",
    explained: "Explained that thyroid nodules are watched, not rushed, and offered a review date after the function.",
    shows: "Behind — the Hot plan owed three calls by day 5 and one was logged. Two missed touches on a lead that answered the phone.",
  },
  {
    id: "lead_015", name: "Harish Sheikh", phone: "+91 96865 31207", disease: "Gallstones",
    source: "Meta Ads", campaign: "General Surgery — Aug", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Warm", day: 9, ageHours: 216, calls: 1,
    objection: ["Financial", "Insurance unavailable"],
    said: "Has no insurance, asked what the whole thing costs including the stay.",
    explained: "Gave the package range and said the counselor can put an EMI schedule against it.",
    shows: "Behind on a Warm plan, with a live financial objection sitting unanswered. This is the row the escalation desk wants.",
  },
  {
    id: "lead_016", name: "Padma Bhat", phone: "+91 91082 60034", disease: "Circumcision",
    source: "Google Ads", campaign: "Search — Laser Surgery", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Not Connected", day: 3, ageHours: 72, calls: 1,
    outcome: "Not Connected", notConnected: "Switched off",
    shows: "Behind on the five-day Not Connected plan. One attempt logged where the plan owed three — stopping early is how a busy patient becomes a lost lead.",
  },
  {
    id: "lead_017", name: "Vijay Hegde", phone: "+91 98455 90218", disease: "Piles",
    source: "YouTube", campaign: "Explainer — Piles", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Hot", day: 3, ageHours: 72, calls: 2,
    objection: ["Hospital / Doctor", "Doctor confidence issue"],
    said: "Asked how many of these the doctor has actually done, and whether it is laser or open surgery.",
    explained: "Gave the surgeon's case volume and said the profile card would follow on WhatsApp.",
    shows: "Due today, plan fully executed. A trust objection that the doctor-profile template answers.",
  },
  {
    id: "lead_018", name: "Anita Nair", phone: "+91 99640 12786", disease: "Varicose Veins",
    source: "Website", campaign: "Organic — Website", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Warm", day: 5, ageHours: 120, calls: 2,
    objection: ["Financial", "EMI required"],
    said: "Ready to go ahead if it can be split over months, husband handles the money.",
    explained: "Explained the EMI bands and offered to bring the husband onto the next call.",
    shows: "Due today on a Warm plan, with the family decision-maker named — the field §22 says separates converted from non-converted cohorts.",
  },
  {
    id: "lead_019", name: "Prasad Iyer", phone: "+91 90080 55471", disease: "Cataract",
    source: "Meta Ads", campaign: "Cataract — Jayanagar — Aug", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Cold", day: 22, ageHours: 528, calls: 2,
    objection: ["Interest", "No current requirement"],
    said: "Vision is manageable for now, told us to check back after the monsoon.",
    explained: "Agreed a monthly check-in and sent the camp schedule.",
    shows: "Due today at the Cold plan's day-22 decision point — the one call a monthly plan actually insists on.",
  },
  {
    id: "lead_020", name: "Sunita Hegde", phone: "+91 98862 30991", disease: "Hernia",
    source: "Referral", campaign: "Doctor referral", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Hot", day: 4, ageHours: 96, calls: 2,
    appointment: { state: "Suggested", doctor: "Dr. Rohit Sen", consultationType: "In-person", atHours: -48 },
    said: "Happy to come in, asked for a Saturday morning slot.",
    explained: "Offered two Saturday slots and said the card would come on WhatsApp once one is picked.",
    shows: "Waiting — day 4 asks for no call. An appointment is suggested but not booked, so it is still working, not finished.",
  },
  {
    id: "lead_021", name: "Ramesh Naidu", phone: "+91 97400 18265", disease: "Thyroid",
    source: "Google Ads", campaign: "Endocrine — Aug", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Warm", day: 7, ageHours: 168, calls: 2,
    said: "Reports are with the local physician, will collect them this week.",
    explained: "Asked for the reports before the consultation so the doctor can advise in one visit.",
    shows: "Waiting on a Warm plan — a quiet day between two call days, which is most of a Warm plan's life.",
  },
  {
    id: "lead_022", name: "Lalitha Menon", phone: "+91 91480 76320", disease: "Gallstones",
    source: "Website", campaign: "Organic — Website", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Cold", day: 15, ageHours: 360, calls: 1,
    said: "Stones were found on a routine scan, no pain so far.",
    explained: "Explained why an asymptomatic gallstone is still worth a surgical opinion.",
    shows: "Waiting deep inside a monthly plan. The message duty runs, the call duty does not.",
  },
  {
    id: "lead_023", name: "Girish Kamath", phone: "+91 98453 60127", disease: "Knee Replacement",
    source: "Meta Ads", campaign: "Ortho — Whitefield — Aug", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Hot", day: 7, ageHours: 168, calls: 4,
    appointment: { state: "Confirmed", doctor: "Dr. Suhas Deshpande", consultationType: "In-person", atHours: -20, companion: "Son — Anil Kamath" },
    said: "Both knees, walking is limited, son is bringing him in.",
    explained: "Walked through the staged approach and confirmed the slot with the son on the line.",
    shows: "Finished — confirmed appointment. Routine follow-up messaging is suppressed and the reminder sequence takes over.",
  },
  {
    id: "lead_024", name: "Shanti Devi", phone: "+91 99001 42078", disease: "Piles",
    source: "YouTube", campaign: "Explainer — Piles", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Warm", day: 13, ageHours: 312, calls: 4,
    appointment: { state: "Consultation Completed", doctor: "Dr. Anand Kulkarni", consultationType: "In-person", atHours: 48 },
    status: "Converted", stage: 20,
    said: "Came in with her daughter, surgery advised the same day.",
    explained: "Handed over to financial counseling straight after the consultation.",
    shows: "Finished and converted. The stage bar reads done end to end, and no lead template may be sent to a patient.",
  },
  {
    id: "lead_025", name: "Naveen Shetty", phone: "+91 90361 20845", disease: "Cataract",
    source: "Google Ads", campaign: "Search — Laser Surgery", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Warm", day: 15, ageHours: 384, calls: 5,
    said: "Got a quote from another hospital that is thirty thousand lower.",
    explained: "Compared what is inside each package — lens type, follow-ups and the readmission cover.",
    objection: ["Financial", "Treatment cost high"],
    closure: { category: "Financial", reason: "Treatment cost high", detail: "Compared packages, the gap is on the lens grade. Counselor call promised and never made." },
    shows: "Finished and closed for price — and recoverable, because §23 says a price objection with counseling still owed is not a lost patient.",
  },
  {
    id: "lead_026", name: "Bhavani Rao", phone: "+91 97418 30096", disease: "Varicose Veins",
    source: "Camp", campaign: "Camp — Whitefield", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Cold", day: 22, ageHours: 600, calls: 2,
    said: "Already had the procedure done elsewhere last month.",
    explained: "Noted the hospital and closed the file.",
    objection: ["Competition", "Chose another hospital"],
    closure: { category: "Competition", reason: "Chose another hospital", detail: "Treated at a competitor before our day-22 call. Competitor name captured for the ROI review." },
    shows: "Finished and genuinely lost. §19 puts this in Genuine Lost, and §20 refuses it a reactivation campaign.",
  },
  {
    id: "lead_027", name: "Mahesh Kulkarni", phone: "+91 90000 11111", disease: "Hernia",
    source: "Website", campaign: "Organic — Website", branch: "Jayanagar", agent: "Nikhil Rao",
    temperature: "Not Connected", day: 5, ageHours: 144, calls: 5,
    numberValid: false, rcs: false,
    outcome: "Not Connected", notConnected: "Wrong number",
    closure: { category: "Lead Quality", reason: "Wrong number", detail: "Five attempts across five days, all on a number that belongs to somebody else. Lead form quality signal for the source." },
    shows: "Finished on a dead number, with the full five attempts logged first — a wrong number is a lead-form problem, and the source ROI has to hear about it.",
  },

  // ---- Sneha Pillai (sneha123), Whitefield ------------------------------------------------
  {
    id: "lead_028", name: "Geetha Naidu", phone: "+91 98863 71240", disease: "Knee Replacement",
    source: "Meta Ads", campaign: "Ortho — Whitefield — Aug", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Hot", day: 1, ageHours: 4, calls: 0,
    shows: "Ring now — the second agent's queue has to look like a real queue too, or role scoping cannot be demonstrated.",
  },
  {
    id: "lead_029", name: "Imran Qureshi", phone: "+91 99646 20517", disease: "Gallstones",
    source: "Google Ads", campaign: "General Surgery — Aug", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Hot", day: 5, ageHours: 120, calls: 1,
    objection: ["Interest", "Surgery fear"],
    said: "Frightened of general anaesthesia, an uncle had a bad experience.",
    explained: "Offered a call with the anaesthetist and the day-care discharge timeline.",
    shows: "Behind, with a surgery-fear objection. §24 routes this to a doctor, not to another agent call.",
  },
  {
    id: "lead_030", name: "Divya Sharma", phone: "+91 97415 90384", disease: "Thyroid",
    source: "YouTube", campaign: "Doctor interview series", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Warm", day: 9, ageHours: 216, calls: 3,
    said: "Wants a second opinion before deciding, has asked her physician.",
    explained: "Encouraged the second opinion and offered to send the scan report across.",
    shows: "Due today at the Warm plan's day-9 call.",
  },
  {
    id: "lead_031", name: "Kiran Hegde", phone: "+91 90084 61129", disease: "Piles",
    source: "Website", campaign: "Organic — Website", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Warm", day: 11, ageHours: 264, calls: 3,
    appointment: { state: "Confirmation Pending", doctor: "Dr. Rohit Sen", consultationType: "In-person", atHours: -72 },
    said: "Took a slot for Thursday but has not confirmed it.",
    explained: "Sent the appointment card and said we would call the day before.",
    shows: "Finished on the working queue and open on the appointment board — booked and unconfirmed is the strongest predictor of a no-show there is.",
  },
  {
    id: "lead_032", name: "Nirmala Bhat", phone: "+91 98450 77203", disease: "Cataract",
    source: "Referral", campaign: "Doctor referral", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Hot", day: 3, ageHours: 70, calls: 2,
    said: "Referred by her own eye doctor, wants the earliest possible date.",
    explained: "Held a slot and explained what to bring for the pre-operative check.",
    shows: "Due today on a referral — the source that converts best and the one an ad-heavy queue buries.",
  },
  {
    id: "lead_033", name: "Ravi Pillai", phone: "+91 91084 33076", disease: "Varicose Veins",
    source: "Meta Ads", campaign: "General Surgery — Aug", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Warm", day: 9, ageHours: 240, calls: 3,
    appointment: { state: "No-show", doctor: "Dr. Imran Qureshi", consultationType: "In-person", atHours: 24, reason: "Patient did not arrive and did not answer the confirmation call" },
    said: "Confirmed on the phone and then did not come.",
    explained: "Left a message offering a fresh slot the same week.",
    shows: "A no-show that §24 forbids being a dead end — it carries a recovery owner and an open recovery task.",
  },
  {
    id: "lead_034", name: "Sarita Rao", phone: "+91 99005 18462", disease: "Hernia",
    source: "Camp", campaign: "Camp — Whitefield", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Warm", day: 7, ageHours: 180, calls: 2,
    appointment: { state: "Rescheduled", doctor: "Dr. Kavitha Rao", consultationType: "In-person", atHours: -96, reason: "Patient asked to move it past a work deadline" },
    said: "Asked to move the appointment by a week, work deadline.",
    explained: "Moved it and reset the reminder sequence against the new date.",
    shows: "Rescheduled — a state that reads as still working, not as finished, because the patient has not been seen yet.",
  },
  {
    id: "lead_035", name: "Ganesh Murthy", phone: "+91 97404 60218", disease: "Circumcision",
    source: "Google Ads", campaign: "Search — Laser Surgery", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Hot", day: 7, ageHours: 200, calls: 4,
    said: "Wants it done but keeps postponing the date, asked about pain after.",
    explained: "Gave the recovery timeline and the pain-management protocol.",
    objection: ["Interest", "Surgery fear"],
    closure: { category: "Interest", reason: "Surgery fear", detail: "Fear of post-operative pain, never spoke to a doctor about it. Recoverable with a doctor callback." },
    shows: "Closed for fear without ever reaching a doctor — the pool the escalation desk counts, and the argument for that queue existing.",
  },
  {
    id: "lead_036", name: "Latha Krishnan", phone: "+91 90362 11907", disease: "Gallstones",
    source: "Walk-in", campaign: "Front desk walk-in", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Hot", day: 5, ageHours: 130, calls: 3,
    appointment: { state: "Patient Arrived", doctor: "Dr. Kavitha Rao", consultationType: "In-person", atHours: 2 },
    said: "Walked into the front desk with a scan already done.",
    explained: "Booked her straight into the afternoon list.",
    shows: "Patient arrived — the state between an appointment and an outcome, and the one a front desk marks.",
  },

  {
    id: "lead_044", name: "Yasmin Khan", phone: "+91 99647 40318", disease: "Knee Replacement",
    source: "YouTube", campaign: "Doctor interview series", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Warm", day: 13, ageHours: 330, calls: 4,
    said: "Travel from her town is three hours each way, and she cannot do the follow-up visits.",
    explained: "Offered the nearer branch and a video consultation for the follow-ups.",
    objection: ["Hospital / Doctor", "Hospital too far"],
    closure: { category: "Hospital / Doctor", reason: "Hospital too far", detail: "Distance, not price and not doubt. Nearest branch offered and it is still two hours away — a branch-planning signal." },
    shows: "Closed on location. Recoverable by §23, and the kind of closure that only shows up as a pattern once the reason is a list rather than free text.",
  },
  {
    id: "lead_045", name: "Basavaraj Patil", phone: "+91 90362 55014", disease: "Piles",
    source: "Camp", campaign: "Camp — Kanakapura Road", branch: "Whitefield", agent: "Sneha Pillai",
    temperature: "Not Connected", day: 5, ageHours: 150, calls: 5,
    outcome: "Not Connected", notConnected: "Not lifting",
    closure: { category: "Contactability", reason: "Repeatedly unreachable", detail: "Five attempts across five days at three different times. The number rings and nobody answers." },
    shows: "The honest end of the Not Connected plan — five attempts logged, then closed as unreachable rather than as uninterested.",
  },

  // ---- Arjun Verma, so the manager screens hold four agents rather than two ---------------
  {
    id: "lead_037", name: "Suresh Babu", phone: "+91 98866 40129", disease: "Knee Replacement",
    source: "Google Ads", campaign: "Ortho — Whitefield — Aug", branch: "Jayanagar", agent: "Arjun Verma",
    temperature: "Hot", day: 3, ageHours: 74, calls: 2,
    said: "Wants to know if it can wait a year, he is 58.",
    explained: "Explained that delay is a decision too, and what the joint looks like after another year.",
    shows: "A senior caller's high-value lead. The assignment board's rule routes ₹1L+ packages here on purpose.",
  },
  {
    id: "lead_038", name: "Rohini Desai", phone: "+91 91089 20674", disease: "Piles",
    source: "Meta Ads", campaign: "Piles — Jayanagar — Aug", branch: "Jayanagar", agent: "Arjun Verma",
    temperature: "Warm", day: 5, ageHours: 126, calls: 1,
    objection: ["Follow-up Failure", "Follow-up missed"],
    said: "Said she had been waiting for a call back for four days.",
    explained: "Apologised and put the doctor callback on the same day.",
    shows: "Behind, and the patient noticed. §23 records this as a follow-up failure rather than as a patient decision.",
  },
  {
    id: "lead_039", name: "Krishna Rao", phone: "+91 99648 71503", disease: "Thyroid",
    source: "YouTube", campaign: "Doctor interview series", branch: "Jayanagar", agent: "Arjun Verma",
    temperature: "Warm", day: 11, ageHours: 268, calls: 3,
    appointment: { state: "Cancelled", doctor: "Dr. Kavitha Rao", consultationType: "Video", atHours: -30, reason: "Cancelled by the hospital — doctor unavailable" },
    said: "Was told the doctor is not available that day.",
    explained: "Offered the next available video slot and apologised for the change.",
    shows: "Cancelled by the hospital rather than by the patient — §17 requires the two sides to report separately, and only one of them is the patient's fault.",
  },

  {
    id: "lead_043", name: "Ganga Prasad", phone: "+91 98454 21870", disease: "Gallstones",
    source: "Meta Ads", campaign: "General Surgery — Aug", branch: "Jayanagar", agent: "Arjun Verma",
    temperature: "Hot", day: 7, ageHours: 220, calls: 2,
    said: "Said nobody called back after the first conversation, went cold on us.",
    explained: "Apologised for the gap and offered a fresh consultation date.",
    objection: ["Follow-up Failure", "First response delayed"],
    closure: { category: "Follow-up Failure", reason: "First response delayed", detail: "First call went out eleven hours after the enquiry. Patient had already booked elsewhere by the second call." },
    shows: "Closed as a process failure rather than as a patient decision — §23 forbids 'not interested' standing in for 'we were slow'.",
  },

  // ---- Divya Menon, whose queue the team screen shows as uncovered while she is on leave --
  {
    id: "lead_040", name: "Anjali Verma", phone: "+91 97402 33815", disease: "Varicose Veins",
    source: "Website", campaign: "Organic — Website", branch: "Whitefield", agent: "Divya Menon",
    temperature: "Cold", day: 8, ageHours: 200, calls: 1,
    said: "Cosmetic concern more than pain, asking what it costs.",
    explained: "Sent the education message and the price band.",
    shows: "Waiting, and owned by the agent the team screen shows as on leave — one of the leads nobody is working today.",
  },
  {
    id: "lead_041", name: "Manoj Pai", phone: "+91 90087 62240", disease: "Cataract",
    source: "Camp", campaign: "Camp — Kanakapura Road", branch: "Whitefield", agent: "Divya Menon",
    temperature: "Not Connected", day: 2, ageHours: 40, calls: 0,
    shows: "Ring now, and uncovered. A never-called lead behind an absent agent is exactly what the assignment board is for.",
  },
  {
    id: "lead_042", name: "Vandana Nair", phone: "+91 98457 10938", disease: "Hernia",
    source: "Meta Ads", campaign: "General Surgery — Aug", branch: "Whitefield", agent: "Divya Menon",
    temperature: "Warm", day: 5, ageHours: 128, calls: 2,
    appointment: { state: "Patient Considering", doctor: "Dr. Rohit Sen", consultationType: "In-person", atHours: -120 },
    said: "Considering the slot, wants to check with her employer about leave.",
    explained: "Held the slot for forty-eight hours and offered a video consultation instead.",
    shows: "Patient Considering — offered and not accepted. It is not a booking and the plan keeps running.",
  },
];

/** How many calls the protocol had asked for by a given day. Mirrors `callCompliance`. */
const CALL_DAYS = {
  Hot: [1, 3, 5, 7],
  Warm: [1, 5, 9, 13, 15],
  Cold: [1, 22],
  "Not Connected": [1, 2, 3, 4, 5],
};

/**
 * Lead status and stage follow from the state the row is in, rather than being typed per row —
 * two fields that describe the same thing and are set by hand are two fields that drift apart.
 */
function statusFor(row) {
  if (row.status) return { lead_status: row.status, stage: row.stage ?? 20 };
  if (row.closure) return { lead_status: "Closed — reason recorded", stage: 19 };
  if (row.appointment?.state === "Consultation Completed") return { lead_status: "Consultation Completed", stage: 14 };
  if (["Booked", "Confirmation Pending", "Confirmed", "Patient Arrived", "Rescheduled"].includes(row.appointment?.state)) {
    return { lead_status: "Appointment Booked", stage: 11 };
  }
  if (row.calls === 0) return { lead_status: "First Contact Attempted", stage: 4 };
  return { lead_status: "Follow-up Plan Activated", stage: 9 };
}

export function buildExtras(now = new Date()) {
  const leads = [];
  const interactions = [];
  const communications = [];

  for (const row of ROWS) {
    const created = hoursBefore(row.ageHours, now);
    const { lead_status, stage } = statusFor(row);

    const lead = {
      id: row.id,
      patient_name: row.name,
      phone_number: row.phone,
      lead_type: row.source === "Walk-in" ? "Walk-in" : "Inbound",
      disease: row.disease,
      source: row.source,
      campaign: row.campaign,
      lead_status,
      stage,
      agent_name: row.agent,
      branch: row.branch,
      rcs_supported: row.rcs !== false,
      number_valid: row.numberValid !== false,
      created_at: created,
      // `shows` is documentation that travels with the record. It is never rendered — it exists so
      // that whoever next reads this seed knows why the row is here before they change it.
      shows: row.shows,
      plan: {
        temperature: row.temperature,
        day: row.day,
        activated_at: created,
        ...(row.appointment
          ? {
              appointment_booked: ["Booked", "Confirmation Pending", "Confirmed", "Patient Arrived"].includes(
                row.appointment.state
              ),
            }
          : {}),
        ...(row.closure ? { closed: true } : {}),
      },
    };

    if (row.appointment) {
      const at = hoursBefore(row.appointment.atHours, now);
      lead.appointment = {
        state: row.appointment.state,
        doctor: row.appointment.doctor,
        branch: row.branch,
        consultationType: row.appointment.consultationType,
        at,
        companion: row.appointment.companion ?? null,
        reason: row.appointment.reason ?? null,
        updated_at: created,
        updated_by: row.agent,
        history: [{ state: row.appointment.state, at: created, by: row.agent, reason: row.appointment.reason ?? null }],
      };
    }

    // Calls are spread evenly across the days the plan actually asked for one, so the compliance
    // arithmetic on the lead screen matches what the queue says about it.
    const dueDays = (CALL_DAYS[row.temperature] ?? [1]).filter((day) => day <= row.day);
    for (let i = 0; i < row.calls; i++) {
      const onDay = dueDays[i] ?? row.day;
      const hoursAgo = Math.max(0.2, row.ageHours - (onDay - 1) * 24);
      const last = i === row.calls - 1;
      interactions.push({
        id: `${row.id}_call_${i + 1}`,
        lead_id: row.id,
        lead_type: lead.lead_type,
        agent_name: row.agent,
        interaction_date: hoursBefore(hoursAgo, now),
        contact_outcome: row.outcome === "Not Connected" ? "Not Connected" : "Connected",
        ...(row.outcome === "Not Connected"
          ? {
              not_connected_reason: row.notConnected ?? "No answer",
              attempt_number: i + 1,
              double_dial_complete: true,
              feedback: `Attempt ${i + 1} on day ${onDay}. ${row.notConnected ?? "No answer"}.`,
            }
          : {
              patient_response: "Interested",
              // Only the most recent call carries the full remark. Earlier ones read as earlier
              // calls do — shorter, and without the objection that only came up later.
              patient_said: last ? row.said ?? "Asked for more information about the procedure." : "Asked for time to think it over.",
              agent_explained: last
                ? row.explained ?? "Explained the procedure, the stay and what the package covers."
                : "Explained the procedure and the day-care discharge.",
              ...(last && row.objection
                ? { objection_category: row.objection[0], objection_raised: row.objection[1] }
                : {}),
              next_action: last && row.objection?.[0] === "Financial" ? "Financial Counseling" : "Follow-up Call",
              feedback: last ? `Day ${onDay} call. ${row.shows}` : `Day ${onDay} call logged.`,
            }),
      });
    }

    if (row.closure) {
      const evidence = interactions.filter((entry) => entry.lead_id === row.id).slice(-1)[0] ?? null;
      lead.closure = {
        category: row.closure.category,
        reason: row.closure.reason,
        detail: row.closure.detail,
        // The closure cites a record that exists on this lead. A closure whose evidence points at
        // nothing is the thing the A9 guard refuses, so the seed must not ship one.
        evidenceId: evidence?.id ?? null,
        evidence: evidence
          ? { id: evidence.id, kind: "call", label: `Call on ${row.disease}`, when: evidence.interaction_date }
          : null,
        closed_by: row.agent,
        closed_at: hoursBefore(Math.max(0.5, row.ageHours - row.day * 24), now),
      };
    }

    // One acknowledgement message per lead that has been called at least once, so the composer's
    // rotation and 48-hour floor have a history to work against rather than an empty lead.
    if (row.calls > 0 && row.numberValid !== false) {
      communications.push({
        id: `${row.id}_comm_1`,
        lead_id: row.id,
        lead_type: lead.lead_type,
        patient_name: row.name,
        phone_number: row.phone,
        agent_name: row.agent,
        branch: row.branch,
        channel: "WhatsApp",
        template_id: "tpl_ack_wa",
        template_name: "Acknowledgement — enquiry received",
        nurture_step: 1,
        protocol_day: 1,
        body_snapshot: `Hello ${row.name.split(" ")[0]}, this is Sunrise Hospital. We received your enquiry about ${row.disease}...`,
        sent_at: hoursBefore(Math.max(0.5, row.ageHours - 2), now),
        delivered_at: hoursBefore(Math.max(0.4, row.ageHours - 2), now),
        read_at: hoursBefore(Math.max(0.3, row.ageHours - 2), now),
        delivery_status: "Read",
        suppressed: false,
        link_clicked: false,
      });
    }

    leads.push(lead);
  }

  return { leads, interactions, communications };
}
