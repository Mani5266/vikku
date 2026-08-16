// Communication engine — Thesis §8, §9, §10, §11, §12, §14.
//
// The 48-hour alternating model, enforced. FOLLOWUP_PROTOCOLS already encodes
// which channel each protocol day expects; this module is the guard that checks
// a proposed send against real history before it goes out.
//
// Pure functions only — no SDK calls, no React. Callers own I/O.
// Self-check: node communicationEngine.test.js

import { FOLLOWUP_PROTOCOLS, checkSuppression } from "@/lib/followupProtocols";

export const MESSAGE_FLOOR_HOURS = 48;

// Section 9: WhatsApp -> RCS/MMS -> WhatsApp -> RCS/MMS
export const CHANNEL_ROTATION = ["WhatsApp", "RCS"];

export const NURTURE_SEQUENCE = [
  "Acknowledgement",
  "Education",
  "Trust",
  "Treatment Understanding",
  "Social Proof",
  "Financial Support",
  "Action",
];

const HOUR_MS = 60 * 60 * 1000;

/** Communications that actually reached the patient, newest first. */
function sentHistory(communications = []) {
  return communications
    .filter((c) => c.sent_at && !c.suppressed)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
}

export function lastSent(communications = []) {
  return sentHistory(communications)[0] || null;
}

export function hoursSinceLastMessage(communications = [], now = new Date()) {
  const last = lastSent(communications);
  if (!last) return Infinity;
  return (new Date(now) - new Date(last.sent_at)) / HOUR_MS;
}

/**
 * Section 9 — rotation is system-driven, never left to the agent's memory.
 * RCS and MMS are the same rung; MMS is the fallback where RCS is unsupported.
 */
export function nextChannel(communications = [], { rcsSupported = true } = {}) {
  const last = lastSent(communications);
  const rich = rcsSupported ? "RCS" : "MMS";
  if (!last) return CHANNEL_ROTATION[0];
  return last.channel === "WhatsApp" ? rich : "WhatsApp";
}

/** Section 11 — content must advance, not just the channel. */
export function nextNurtureStep(communications = []) {
  const used = new Set(
    sentHistory(communications)
      .map((c) => c.nurture_step)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= NURTURE_SEQUENCE.length)
  );
  for (let step = 1; step <= NURTURE_SEQUENCE.length; step++) {
    if (!used.has(step)) return { step, label: NURTURE_SEQUENCE[step - 1] };
  }
  return { step: null, label: null }; // sequence exhausted
}

export function nextAllowedSendAt(communications = []) {
  const last = lastSent(communications);
  if (!last) return null;
  return new Date(new Date(last.sent_at).getTime() + MESSAGE_FLOOR_HOURS * HOUR_MS);
}

/**
 * The guard. Returns { allowed, code, reason, ... } — never throws.
 *
 * Order matters: hard stops (opt-out, invalid number, converted) are checked
 * before the cadence floor, so the reason surfaced to the agent is the real one.
 *
 * NOTE: governs MESSAGES only. Section 8 is explicit that an urgent Hot Lead
 * may still be called inside 48 hours. Calls must not route through here.
 */
export function canSendMessage({
  plan,
  lead = {},
  template = null,
  communications = [],
  channel = null,
  now = new Date(),
  managerOverride = false,
}) {
  const deny = (code, reason, extra = {}) => ({ allowed: false, code, reason, ...extra });

  // --- Hard stops: no override, ever ---
  if (lead.opted_out || plan?.opted_out) {
    return deny("OPTED_OUT", "Patient has opted out of communication");
  }
  if (lead.do_not_contact) {
    return deny("DO_NOT_CONTACT", "Number is marked do-not-contact");
  }
  if (lead.number_valid === false) {
    return deny("INVALID_NUMBER", "Number is invalid");
  }
  if (plan?.patient_converted || lead.lead_status === "Converted") {
    return deny("CONVERTED", "Patient has converted — lead follow-up templates do not apply");
  }

  // --- Section 12 suppression: reuse the existing helper, don't restate it ---
  if (plan) {
    const s = checkSuppression(plan);
    if (s.active) return deny("SUPPRESSED", s.reason, { suppressionKey: s.key });
  }

  // --- Section 14: Cold Leads never get price offers or surgery pushes ---
  if (plan?.temperature === "Cold" && template) {
    if (template.is_price_offer) {
      return deny("COLD_PRICE_OFFER", "Price offers are not sent to Cold Leads");
    }
    if (template.is_surgery_push) {
      return deny("COLD_SURGERY_PUSH", "Aggressive surgery messages are not sent to Cold Leads");
    }
  }

  // --- Section 10: content must not repeat ---
  if (template?.id && sentHistory(communications).some((c) => c.template_id === template.id)) {
    return deny("TEMPLATE_REUSED", `"${template.name}" has already been sent to this patient`);
  }
  if (template && template.approval_status !== "Approved") {
    return deny("TEMPLATE_UNAPPROVED", "Only approved templates can be sent");
  }

  const last = lastSent(communications);
  const expected = nextChannel(communications, { rcsSupported: lead.rcs_supported !== false });
  const proposed = channel || expected;

  // --- Section 9: no same channel twice in a row ---
  if (last && proposed === last.channel) {
    return deny(
      "CHANNEL_REPEAT",
      `Last message went by ${last.channel}. Rotation expects ${expected}.`,
      { expectedChannel: expected }
    );
  }

  // --- Section 8: the 48-hour floor ---
  const elapsed = hoursSinceLastMessage(communications, now);
  if (elapsed < MESSAGE_FLOOR_HOURS) {
    if (!managerOverride) {
      return deny(
        "TOO_SOON",
        `${Math.floor(elapsed)}h since the last message. The planned cadence is ${MESSAGE_FLOOR_HOURS}h.`,
        { nextAllowedAt: nextAllowedSendAt(communications), hoursElapsed: elapsed, expectedChannel: expected }
      );
    }
    return {
      allowed: true,
      code: "OVERRIDE",
      reason: "Manager exception to the 48-hour cadence — recorded in the audit log",
      channel: proposed,
      requiresAudit: true,
      ...nextNurtureStep(communications),
    };
  }

  return {
    allowed: true,
    code: "OK",
    reason: null,
    channel: proposed,
    requiresAudit: false,
    ...nextNurtureStep(communications),
  };
}

/**
 * What the protocol expects on a given day, per FOLLOWUP_PROTOCOLS.
 * Returns null on a day the protocol schedules no routine message.
 */
export function plannedMessageForDay(temperature, day) {
  const protocol = FOLLOWUP_PROTOCOLS[temperature];
  if (!protocol) return null;
  const step = protocol.steps.find((s) => s.day === day);
  if (!step || !step.messageRequired || step.messageChannel === "None") return null;
  return { day, channel: step.messageChannel, activity: step.messageActivity };
}

/** Section 27 — inputs for the Communication Performance screen. */
export function communicationStats(communications = []) {
  const sent = sentHistory(communications);
  const suppressed = communications.filter((c) => c.suppressed);
  const rate = (n) => (sent.length ? Math.round((n / sent.length) * 100) : 0);
  const delivered = sent.filter((c) => c.delivered_at).length;
  const read = sent.filter((c) => c.read_at).length;
  const replied = sent.filter((c) => c.replied_at).length;

  const compliant = sent.filter((c, i) => {
    const prev = sent[i + 1]; // sent is newest-first
    if (!prev) return true;
    return (new Date(c.sent_at) - new Date(prev.sent_at)) / HOUR_MS >= MESSAGE_FLOOR_HOURS;
  }).length;

  return {
    scheduled: communications.filter((c) => c.delivery_status === "Scheduled").length,
    sent: sent.length,
    delivered,
    failed: communications.filter((c) => c.delivery_status === "Failed").length,
    read,
    replied,
    linkClicks: sent.filter((c) => c.link_clicked).length,
    suppressed: suppressed.length,
    deliveryRate: rate(delivered),
    readRate: rate(read),
    replyRate: rate(replied),
    cadenceComplianceRate: rate(compliant),
    byChannel: ["WhatsApp", "RCS", "MMS"].reduce((acc, ch) => {
      const inCh = sent.filter((c) => c.channel === ch);
      acc[ch] = {
        sent: inCh.length,
        replied: inCh.filter((c) => c.replied_at).length,
        replyRate: inCh.length
          ? Math.round((inCh.filter((c) => c.replied_at).length / inCh.length) * 100)
          : 0,
      };
      return acc;
    }, {}),
  };
}
