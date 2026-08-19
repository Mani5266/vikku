// Closed lead journeys — the analytics dataset every manager, leadership and recovery
// screen reads.
//
// The nine leads in seed.js exist to make each communication guard reachable from the
// UI; they are far too few to answer the five questions in §2. This file generates 1,500
// finished journeys over 90 days — around 500 leads a month, against the client's stated
// 2,500 to 3,000 — carried
// all the way through the twenty-stage lifecycle of §4 and the appointment and
// conversion stages of §17, so the funnel metrics of §26, the cohort comparison of §22,
// the cost metrics behind §5 and the recovery pools of §19–20 are all computed from
// records rather than written as copy.
//
// The generator is a seeded LCG, so every build produces the same dataset: a number on
// the founder dashboard traces to a row in the drill-down, and the render smoke test
// can assert on it.
//
// Field names match the Lead / LeadInteraction shapes in
// implementation/base44/entities, plus two the AI layer (docs/AI-LAYER.md) will own:
// `ai_temperature`, the temperature the call transcript supports, held next to the one
// the agent typed so §26's qualification accuracy can be measured; and `remark_complete`,
// whether the seven §3.2 parts were actually filled in.

import { FOLLOWUP_PROTOCOLS } from "@/lib/followupProtocols";
import { reasonDefaults } from "@/lib/reasonTaxonomy";

const DAY = 24 * 60 * 60 * 1000;

/** Linear congruential generator — deterministic, and enough for shaping a dataset. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Draws from [[value, weight], ...]. Weights need not sum to 1. */
function weighted(random, pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

const SOURCES = [
  ["Meta Ads", 34],
  ["Google Ads", 24],
  ["YouTube", 14],
  ["Website", 12],
  ["Referral", 8],
  ["Camp", 5],
  ["Walk-in", 3],
];

// Package price band per disease, in rupees. The band matters because §22 compares the
// average quoted package between the converted and non-converted cohorts, and because
// cost per surgery in §5 is meaningless without the revenue beside it.
const DISEASES = [
  ["Circumcision", 18, 35000],
  ["Piles", 16, 65000],
  ["Hernia", 14, 85000],
  ["Gallstones", 12, 95000],
  ["Varicose Veins", 12, 110000],
  ["Knee Replacement", 11, 240000],
  ["Cataract", 9, 45000],
  ["Thyroid", 8, 90000],
];

const DISEASE_WEIGHTS = DISEASES.map(([name, weight]) => [name, weight]);
const PACKAGE_BY_DISEASE = Object.fromEntries(DISEASES.map(([name, , price]) => [name, price]));

const AGENTS = [
  ["Nikhil Rao", 28],
  ["Sneha Pillai", 26],
  ["Arjun Verma", 24],
  ["Divya Menon", 22],
];

const BRANCHES = [
  ["Jayanagar", 55],
  ["Whitefield", 45],
];

const DOCTORS = {
  Piles: ["Dr. Anand Kulkarni", "Dr. Rohit Sen"],
  Circumcision: ["Dr. Anand Kulkarni", "Dr. Rohit Sen"],
  Hernia: ["Dr. Rohit Sen", "Dr. Kavitha Rao"],
  Gallstones: ["Dr. Kavitha Rao", "Dr. Rohit Sen"],
  "Varicose Veins": ["Dr. Imran Qureshi"],
  "Knee Replacement": ["Dr. Suhas Deshpande"],
  Cataract: ["Dr. Leela Krishnan"],
  Thyroid: ["Dr. Kavitha Rao"],
};

// Minutes from lead arrival to the first contact attempt. The shape is the client's
// own complaint made measurable: a fifth of leads are worked inside the SLA and the
// rest drift into the next working block. §7 calls this the touch time.
const TOUCH_TIME_BUCKETS = [
  [[1, 5], 22], // inside the 5-minute SLA
  [[6, 60], 18],
  [[61, 240], 24],
  [[241, 720], 20],
  [[721, 2880], 12],
  [null, 4], // never contacted at all
];

const CAMPAIGN_BY_SOURCE = {
  "Meta Ads": ["General Surgery — Aug", "Piles — Jayanagar — Aug", "Ortho — Whitefield — Aug"],
  "Google Ads": ["Endocrine — Aug", "Ortho — Whitefield — Aug", "Search — Laser Surgery"],
  YouTube: ["Explainer — Piles", "Explainer — Varicose Veins", "Doctor interview series"],
  Website: ["Organic — Website"],
  Referral: ["Doctor referral"],
  Camp: ["Camp — Kanakapura Road", "Camp — Whitefield"],
  "Walk-in": ["Front desk walk-in"],
};

/**
 * Media spend for the 90 days, per source, in rupees. Organic and referral channels
 * carry no media cost. Editable here because it is a configuration value, not a
 * measurement — §5's cost per surgery is only as honest as this table.
 */
export const SOURCE_SPEND = {
  "Meta Ads": 1_450_000,
  "Google Ads": 1_180_000,
  YouTube: 460_000,
  Website: 0,
  Referral: 0,
  Camp: 320_000,
  "Walk-in": 0,
};

const FIRST_NAMES =
  "Priya Ramesh Anita Suresh Mohan Fatima Vikram Lakshmi Gopal Kavya Rahul Sunita Deepak Meena Arun Shanti Vijay Radha Kiran Ananya Naveen Geetha Prasad Bhavani Ravi Sushma Manoj Padma Sanjay Latha Harish Rekha Ajay Nirmala Girish Swathi Mahesh Usha Srinivas Vandana".split(
    " "
  );
const LAST_NAMES =
  "Sharma Kumar Desai Reddy Rao Sheikh Nair Iyer Menon Patil Gupta Naidu Verma Bhat Shetty Prabhu Murthy Joshi Pillai Hegde".split(
    " "
  );

/** Probability a call connects at all, by how late the first attempt was. §7. */
function connectProbability(touchMinutes) {
  if (touchMinutes === null) return 0;
  if (touchMinutes <= 5) return 0.88;
  if (touchMinutes <= 60) return 0.79;
  if (touchMinutes <= 240) return 0.66;
  if (touchMinutes <= 720) return 0.52;
  return 0.38;
}

/**
 * How much a late first touch costs after the call connects. Speed does not only
 * decide whether the phone is answered — a patient who waited half a day has already
 * called somewhere else, which is why the factor applies to the booking step too.
 * §7, §22.
 */
function speedFactor(touchMinutes) {
  if (touchMinutes === null) return 0;
  if (touchMinutes <= 5) return 1.25;
  if (touchMinutes <= 60) return 1.1;
  if (touchMinutes <= 240) return 0.9;
  if (touchMinutes <= 720) return 0.75;
  return 0.6;
}

// Probability of an appointment being booked at all, by qualified temperature, before
// speed and follow-up completion are applied. §12–14.
const BOOKING_BASE = { Hot: 0.82, Warm: 0.53, Cold: 0.12, "Not Connected": 0 };

// Probability the doctor advises surgery once the patient has been consulted. §17.
const SURGERY_ADVICE_RATE = {
  Piles: 0.72,
  Circumcision: 0.8,
  Hernia: 0.78,
  Gallstones: 0.74,
  "Varicose Veins": 0.6,
  "Knee Replacement": 0.55,
  Cataract: 0.82,
  Thyroid: 0.48,
};

// Loss reasons per drop stage. Tying the reason to the stage the lead died at is what
// makes M3's drop buckets explainable lead by lead — §25 level 5 into level 6.
const REASONS_BY_STAGE = {
  "Never contacted": [
    [["Follow-up Failure", "First response delayed"], 6],
    [["Contactability", "Not lifting"], 3],
  ],
  "Not connected": [
    [["Contactability", "Not lifting"], 8],
    [["Contactability", "Switched off"], 3],
    [["Contactability", "Call rejected"], 2],
    [["Contactability", "Repeatedly unreachable"], 4],
    [["Lead Quality", "Wrong number"], 3],
    [["Lead Quality", "Out of location"], 2],
  ],
  "No appointment booked": [
    [["Interest", "Not interested"], 7],
    [["Hospital / Doctor", "Doctor confidence issue"], 3],
    [["Interest", "Wants to wait"], 6],
    [["Interest", "General enquiry"], 4],
    [["Financial", "Treatment cost high"], 6],
    [["Follow-up Failure", "Follow-up missed"], 6],
    [["Follow-up Failure", "Insufficient calls"], 4],
    [["Hospital / Doctor", "Hospital too far"], 4],
    [["Competition", "Chose another hospital"], 4],
    [["Interest", "Surgery fear"], 3],
  ],
  "Appointment no-show": [
    [["Follow-up Failure", "Follow-up missed"], 5],
    [["Hospital / Doctor", "Appointment timing unsuitable"], 4],
    [["Interest", "Wants to wait"], 3],
    [["Financial", "Budget insufficient"], 3],
    [["Competition", "Chose another hospital"], 2],
  ],
  "Lost after consultation": [
    [["Financial", "Treatment cost high"], 8],
    [["Financial", "Financial counseling not completed"], 6],
    [["Financial", "EMI required"], 4],
    [["Financial", "Insurance unavailable"], 3],
    [["Interest", "Surgery fear"], 5],
    [["Hospital / Doctor", "Doctor confidence issue"], 4],
    [["Competition", "Lower competitor price"], 4],
    [["Interest", "Wants to wait"], 3],
  ],
  "Surgery advised, not booked": [
    [["Financial", "Treatment cost high"], 9],
    [["Financial", "Financial counseling not completed"], 7],
    [["Financial", "EMI required"], 5],
    [["Financial", "Discount requested"], 4],
    [["Interest", "Surgery fear"], 5],
    [["Competition", "Lower competitor price"], 4],
    [["Hospital / Doctor", "Requested another doctor"], 2],
  ],
  "Booked, not admitted": [
    [["Financial", "Insurance unavailable"], 4],
    [["Interest", "Wants to wait"], 4],
    [["Hospital / Doctor", "Waiting time issue"], 2],
    [["Competition", "Chose another hospital"], 2],
  ],
};

// §20 — reasons that make a closed lead eligible for the 90-day reactivation pool, and
// reasons that permanently exclude it. Enforced, not advisory: the recovery console
// refuses to build a campaign from an excluded lead.
export const REACTIVATION_EXCLUDED_REASONS = [
  "Not interested",
  "Wrong number",
  "Invalid number",
  "Fake lead",
  "Duplicate",
  "Already treated",
  "Repeatedly unreachable",
  "Unrelated enquiry",
];

/** Reactivation content mapped to the reason the lead was closed for. §20. */
export const REACTIVATION_CONTENT = {
  Financial: "Financial counseling update — EMI and insurance options",
  Interest: "Treatment education and health-check reminder",
  "Follow-up Failure": "Doctor availability and a fresh consultation offer",
  "Hospital / Doctor": "New branch, doctor profile and video consultation",
  Competition: "Relevant patient testimonial and package comparison",
  Contactability: "WhatsApp re-introduction with a call-back request",
  "Lead Quality": null, // nothing to send
};

/** The §4 lifecycle stage a journey reached, 1–20. */
function stageReached(j) {
  if (j.surgery_completed) return 20;
  if (j.admitted) return 18;
  if (j.surgery_booked) return 17;
  if (j.financial_counseling_completed) return 16;
  if (j.surgery_advised) return 15;
  if (j.consultation_completed) return 14;
  if (j.visited) return 13;
  if (j.appointment_confirmed) return 12;
  if (j.appointment_booked) return 11;
  if (j.appointment_suggested) return 10;
  if (j.temperature && j.temperature !== "Not Connected") return 9;
  if (j.connected) return 6;
  if (j.first_touch_minutes !== null) return 4;
  return 3;
}

export function buildJourneys(now = new Date(), count = 1500, seed = 20250817) {
  const random = rng(seed);
  const end = new Date(now).getTime();
  const journeys = [];

  for (let i = 0; i < count; i++) {
    const source = weighted(random, SOURCES);
    const disease = weighted(random, DISEASE_WEIGHTS);
    const agent_name = weighted(random, AGENTS);
    const branch = weighted(random, BRANCHES);
    const campaigns = CAMPAIGN_BY_SOURCE[source];
    const campaign = campaigns[Math.floor(random() * campaigns.length)];
    const doctors = DOCTORS[disease];
    const doctor_name = doctors[Math.floor(random() * doctors.length)];

    const ageDays = 1 + Math.floor(random() * 89);
    const created_at = new Date(end - ageDays * DAY - Math.floor(random() * DAY)).toISOString();

    const bucket = weighted(random, TOUCH_TIME_BUCKETS);
    const first_touch_minutes =
      bucket === null ? null : bucket[0] + Math.floor(random() * (bucket[1] - bucket[0] + 1));

    const initially_not_connected = first_touch_minutes !== null && random() > connectProbability(first_touch_minutes);
    // §6 — a lead that failed to connect on the first attempt may still be recovered by
    // the Not Connected protocol. That recovery rate is a metric, so it is modelled.
    const later_connected = initially_not_connected && random() < 0.31;
    const connected = first_touch_minutes !== null && (!initially_not_connected || later_connected);

    // The temperature the agent typed. A connected call still yields junk sometimes.
    const temperature = connected
      ? weighted(random, [
          ["Hot", 24],
          ["Warm", 30],
          ["Cold", 34],
          ["Not Connected", 12], // agent parked a connected call as Not Connected
        ])
      : "Not Connected";

    // The temperature the transcript supports. Disagreement is skewed towards the
    // agent having marked a lead hotter than the conversation justifies — the exact
    // failure the client cannot currently detect.
    const ai_temperature = (() => {
      if (!connected) return "Not Connected";
      if (random() < 0.82) return temperature;
      if (temperature === "Hot") return random() < 0.7 ? "Warm" : "Cold";
      if (temperature === "Warm") return random() < 0.55 ? "Cold" : "Hot";
      if (temperature === "Cold") return random() < 0.7 ? "Warm" : "Hot";
      return "Cold";
    })();

    const protocol = FOLLOWUP_PROTOCOLS[temperature] || FOLLOWUP_PROTOCOLS["Not Connected"];
    const followups_required = protocol.steps.filter((s) => s.callRequired).length;
    // Compliance is a coin the agent loses about a third of the time — §17's premise.
    const compliant = random() < 0.68;
    const followups_done = compliant
      ? followups_required
      : Math.max(0, followups_required - 1 - Math.floor(random() * followups_required));

    // Communication activity. §27 counts these; §22 compares them across cohorts.
    const calls_attempted = followups_done + (first_touch_minutes !== null ? 1 : 0) + (temperature === "Hot" ? 1 : 0);
    const planned_messages = protocol.steps.filter((s) => s.messageRequired).length;
    const messages_sent = Math.min(planned_messages, followups_done + (compliant ? 1 : 0));
    const whatsapp_sent = Math.ceil(messages_sent / 2);
    const rcs_sent = messages_sent - whatsapp_sent;
    const messages_delivered = Math.max(0, messages_sent - (random() < 0.12 ? 1 : 0));
    const replies = connected ? Math.min(messages_delivered, random() < 0.34 ? 1 : 0) : 0;
    // §3.2 — the seven-part remark. Structural completeness, not prose quality.
    const remark_complete = connected && random() < (compliant ? 0.82 : 0.51);
    // §11 — the doctor-credibility touch the converted cohort in §22 tends to have had.
    const doctor_profile_sent = connected && random() < (compliant ? 0.62 : 0.31);

    const speed = speedFactor(first_touch_minutes);

    // ---- appointment ------------------------------------------------------------
    const appointment_suggested = connected && temperature !== "Not Connected";
    const appointment_booked =
      appointment_suggested &&
      random() < BOOKING_BASE[temperature] * (compliant ? 1 : 0.5) * speed;

    // §O1 — confirmations are the lever on no-shows, so they are counted, and the
    // no-show probability is derived from them rather than drawn independently.
    const confirmations_count = appointment_booked
      ? weighted(random, [
          [0, compliant ? 12 : 34],
          [1, 44],
          [2, compliant ? 44 : 22],
        ])
      : 0;
    const appointment_confirmed = confirmations_count > 0;
    const noShowChance = [0.5, 0.25, 0.1][confirmations_count] ?? 0.25;
    const no_show = appointment_booked && random() < noShowChance;
    const no_show_recovered = no_show && random() < 0.34;
    const rescheduled = appointment_booked && !no_show && random() < 0.18;

    const visited = appointment_booked && (!no_show || no_show_recovered);
    const consultation_completed = visited && random() < 0.97;

    // ---- consultation outcome ---------------------------------------------------
    const surgery_advised = consultation_completed && random() < SURGERY_ADVICE_RATE[disease];
    const tests_advised = consultation_completed && !surgery_advised && random() < 0.55;
    const medical_management = consultation_completed && !surgery_advised && !tests_advised;

    // ---- financial counseling ---------------------------------------------------
    const financial_counseling_required = surgery_advised;
    const financial_counseling_completed =
      financial_counseling_required && random() < (compliant ? 0.78 : 0.52);
    const insurance_available = surgery_advised && random() < 0.42;
    const insurance_approved = insurance_available && random() < 0.79;
    const discount_requested = surgery_advised && random() < 0.36;
    const quoted_package = surgery_advised
      ? Math.round((PACKAGE_BY_DISEASE[disease] * (0.85 + random() * 0.3)) / 500) * 500
      : null;
    const doctor_interaction = consultation_completed || (connected && random() < 0.14);

    // ---- conversion -------------------------------------------------------------
    const bookingChance =
      (financial_counseling_completed ? 0.79 : 0.38) *
      (insurance_approved ? 1.18 : 1) *
      (doctor_profile_sent ? 1.06 : 1);
    const surgery_booked = surgery_advised && random() < Math.min(0.95, bookingChance);
    const admitted = surgery_booked && random() < 0.94;
    const surgery_completed = admitted && random() < 0.98;
    const revenue = surgery_completed
      ? Math.round((quoted_package * (discount_requested ? 0.93 : 1)) / 500) * 500
      : 0;

    // ---- where the lead died ----------------------------------------------------
    // A lead settles when its own protocol has run out, not on a flat calendar rule.
    // A Hot plan is seven days and a Not Connected plan five, so those close inside a
    // fortnight — which is what makes the §32 fifteen-day report have anything to
    // diagnose. A Cold plan runs a month and legitimately stays open longer.
    const GRACE_DAYS = { hot_7day: 3, warm_15day: 3, cold_monthly: 5, not_connected_5day: 2 };
    const settled = ageDays > protocol.durationDays + (GRACE_DAYS[protocol.protocolType] ?? 3);
    let drop_stage = null;
    if (!surgery_completed) {
      if (first_touch_minutes === null) drop_stage = "Never contacted";
      else if (!connected) drop_stage = "Not connected";
      else if (!appointment_booked) drop_stage = "No appointment booked";
      else if (!visited) drop_stage = "Appointment no-show";
      else if (!surgery_advised) drop_stage = "Lost after consultation";
      else if (!surgery_booked) drop_stage = "Surgery advised, not booked";
      else drop_stage = "Booked, not admitted";
    }

    let status;
    if (surgery_completed) status = "Converted";
    else if (!settled) status = "Pending";
    else if (!connected) status = "Not Connected";
    else status = "Lost";

    let loss_category = null;
    let loss_reason = null;
    let recoverable = false;
    let recommended_action = null;
    let segment = null;

    if (status === "Lost" || status === "Not Connected") {
      // A lead that never got its scheduled calls is a process failure and is recorded
      // as one — §23 forbids "expired" standing in for a reason. Otherwise the reason
      // is drawn from the pool that belongs to the stage the lead actually died at.
      const pair =
        !compliant && drop_stage !== "Not connected" && random() < 0.45
          ? ["Follow-up Failure", followups_done === 0 ? "First response delayed" : "Follow-up missed"]
          : weighted(random, REASONS_BY_STAGE[drop_stage] || REASONS_BY_STAGE["No appointment booked"]);
      [loss_category, loss_reason] = pair;
      const defaults = reasonDefaults(loss_category, loss_reason) || {};
      recoverable = Boolean(defaults.recoverable);
      recommended_action = defaults.action || null;
      segment = defaults.segment || null;
    }

    // ---- expiry and reactivation (§18–20) ---------------------------------------
    const expired = status === "Lost" || status === "Not Connected";
    const reactivation_eligible = expired && !REACTIVATION_EXCLUDED_REASONS.includes(loss_reason || "");
    const days_since_closure = expired ? Math.max(1, ageDays - 15) : null;
    const review_date = expired ? new Date(new Date(created_at).getTime() + (ageDays + 30) * DAY).toISOString() : null;
    const reactivation_due = reactivation_eligible && days_since_closure >= 30;
    const reactivated = reactivation_due && random() < 0.44;
    const reactivation_replied = reactivated && random() < 0.33;
    const reactivation_converted = reactivation_replied && random() < 0.30;
    const recovery_revenue = reactivation_converted
      ? Math.round((PACKAGE_BY_DISEASE[disease] * 0.95) / 500) * 500
      : 0;

    const journey = {
      id: `jrn_${String(i + 1).padStart(3, "0")}`,
      patient_name: `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${
        LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]
      }`,
      phone_number: `+91 9${String(1000000000 + Math.floor(random() * 899999999)).slice(0, 9)}`,
      disease,
      source,
      campaign,
      branch,
      agent_name,
      doctor_name,
      created_at,
      age_days: ageDays,

      // contact
      first_touch_minutes,
      initially_not_connected,
      later_connected,
      connected,

      // qualification
      temperature,
      ai_temperature,
      temperature_mismatch: temperature !== ai_temperature,

      // follow-up execution
      followups_required,
      followups_done,
      followup_compliant: followups_done >= followups_required,
      calls_attempted,
      messages_sent,
      whatsapp_sent,
      rcs_sent,
      messages_delivered,
      replies,
      remark_complete,
      doctor_profile_sent,

      // appointment (§17)
      appointment_suggested,
      appointment_booked,
      appointment_confirmed,
      confirmations_count,
      rescheduled,
      no_show,
      no_show_recovered,
      visited,
      consultation_completed,

      // consultation outcome (§17)
      surgery_advised,
      tests_advised,
      medical_management,
      doctor_interaction,

      // financial counseling (§17, §24)
      financial_counseling_required,
      financial_counseling_completed,
      insurance_available,
      insurance_approved,
      discount_requested,
      quoted_package,

      // conversion (§17, §26)
      surgery_booked,
      admitted,
      surgery_completed,
      revenue,

      // outcome and diagnosis
      drop_stage,
      status,
      loss_category,
      loss_reason,
      recoverable,
      recommended_action,
      segment,

      // expiry and recovery (§18–20)
      expired,
      reactivation_eligible,
      reactivation_due,
      reactivated,
      reactivation_replied,
      reactivation_converted,
      recovery_revenue,
      days_since_closure,
      review_date,

      // Aliases kept for the screens written against the first version of this file:
      // an OPD visit is a visit, and an IP admission is a completed surgery.
      op_visit: visited,
      ip_admit: surgery_completed,
    };

    journey.lifecycle_stage = stageReached(journey);
    journeys.push(journey);
  }

  return journeys;
}

/** The dataset every analytics screen reads. Built once, so all screens agree. */
export const JOURNEYS = buildJourneys();
