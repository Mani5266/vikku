// Self-check for communicationEngine.js. No framework, no deps.
//   node implementation/test/communicationEngine.test.mjs
//
// The engine imports "@/lib/followupProtocols" (the correct specifier for the
// app). Here that is rewritten to the local stub so the module runs standalone.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/lib/communicationEngine.js"), "utf8");
const tmp = join(here, ".communicationEngine.runtime.mjs");
writeFileSync(tmp, src.replace('"@/lib/followupProtocols"', '"./followupProtocols.stub.js"'));

let E;
try {
  E = await import(pathToFileURL(tmp).href);
} finally {
  try { unlinkSync(tmp); } catch {}
}

const {
  canSendMessage, nextChannel, nextNurtureStep, hoursSinceLastMessage,
  nextAllowedSendAt, plannedMessageForDay, communicationStats, MESSAGE_FLOOR_HOURS,
} = E;

const NOW = new Date("2026-08-16T12:00:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString();
const plan = (o = {}) => ({ temperature: "Hot", ...o });
const approved = (o = {}) => ({ id: "t1", name: "Doctor profile", approval_status: "Approved", ...o });
const msg = (o = {}) => ({ channel: "WhatsApp", sent_at: hoursAgo(72), nurture_step: 1, ...o });

let pass = 0;
const check = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

// --- cadence floor, Section 8 ---
check("first message is always allowed", () => {
  const r = canSendMessage({ plan: plan(), communications: [], now: NOW });
  assert.equal(r.allowed, true);
  assert.equal(r.channel, "WhatsApp");
});

check("blocks inside the 48-hour floor", () => {
  const r = canSendMessage({ plan: plan(), communications: [msg({ sent_at: hoursAgo(20) })], channel: "RCS", now: NOW });
  assert.equal(r.allowed, false);
  assert.equal(r.code, "TOO_SOON");
  assert.equal(r.hoursElapsed, 20);
});

check("allows at exactly 48 hours", () => {
  const r = canSendMessage({ plan: plan(), communications: [msg({ sent_at: hoursAgo(MESSAGE_FLOOR_HOURS) })], now: NOW });
  assert.equal(r.allowed, true, "boundary must be inclusive");
});

check("manager override passes but demands an audit entry", () => {
  const r = canSendMessage({ plan: plan(), communications: [msg({ sent_at: hoursAgo(3) })], now: NOW, managerOverride: true });
  assert.equal(r.allowed, true);
  assert.equal(r.requiresAudit, true);
});

// --- rotation, Section 9 ---
check("rotates WhatsApp then rich, then back", () => {
  assert.equal(nextChannel([]), "WhatsApp");
  assert.equal(nextChannel([msg({ channel: "WhatsApp" })]), "RCS");
  assert.equal(nextChannel([msg({ channel: "RCS", sent_at: hoursAgo(1) }), msg({ channel: "WhatsApp", sent_at: hoursAgo(50) })]), "WhatsApp");
});

check("falls back to MMS where RCS is unsupported", () => {
  assert.equal(nextChannel([msg({ channel: "WhatsApp" })], { rcsSupported: false }), "MMS");
});

check("blocks the same channel twice in a row", () => {
  const r = canSendMessage({ plan: plan(), communications: [msg({ channel: "WhatsApp" })], channel: "WhatsApp", now: NOW });
  assert.equal(r.allowed, false);
  assert.equal(r.code, "CHANNEL_REPEAT");
  assert.equal(r.expectedChannel, "RCS");
});

// --- hard stops outrank the floor ---
check("opt-out reports opt-out, not TOO_SOON", () => {
  const r = canSendMessage({ plan: plan({ opted_out: true }), communications: [msg({ sent_at: hoursAgo(1) })], now: NOW });
  assert.equal(r.code, "OPTED_OUT");
});

check("opt-out cannot be overridden by a manager", () => {
  const r = canSendMessage({ plan: plan({ opted_out: true }), communications: [], now: NOW, managerOverride: true });
  assert.equal(r.allowed, false);
});

check("converted patient is blocked", () => {
  assert.equal(canSendMessage({ plan: plan({ patient_converted: true }), communications: [], now: NOW }).code, "CONVERTED");
});

check("invalid number is blocked", () => {
  assert.equal(canSendMessage({ plan: plan(), lead: { number_valid: false }, communications: [], now: NOW }).code, "INVALID_NUMBER");
});

// --- suppression, Section 12 ---
check("suppresses on any of the seven conditions", () => {
  for (const k of ["patient_responded", "appointment_booked", "requested_later_date",
                   "doctor_took_over", "patient_admitted"]) {
    const r = canSendMessage({ plan: plan({ [k]: true }), communications: [], now: NOW });
    assert.equal(r.allowed, false, `${k} should suppress`);
    assert.equal(r.suppressionKey, k);
  }
});

// --- content rules, Sections 10, 11, 14 ---
check("blocks a template already sent", () => {
  const r = canSendMessage({ plan: plan(), template: approved(), communications: [msg({ template_id: "t1" })], now: NOW });
  assert.equal(r.code, "TEMPLATE_REUSED");
});

check("blocks unapproved templates", () => {
  const r = canSendMessage({ plan: plan(), template: approved({ approval_status: "Draft" }), communications: [], now: NOW });
  assert.equal(r.code, "TEMPLATE_UNAPPROVED");
});

check("blocks price offers to Cold Leads", () => {
  const r = canSendMessage({ plan: plan({ temperature: "Cold" }), template: approved({ is_price_offer: true }), communications: [], now: NOW });
  assert.equal(r.code, "COLD_PRICE_OFFER");
});

check("allows the same price offer to a Hot Lead", () => {
  const r = canSendMessage({ plan: plan({ temperature: "Hot" }), template: approved({ is_price_offer: true }), communications: [], now: NOW });
  assert.equal(r.allowed, true);
});

check("nurture sequence advances and does not repeat", () => {
  assert.deepEqual(nextNurtureStep([]), { step: 1, label: "Acknowledgement" });
  assert.equal(nextNurtureStep([msg({ nurture_step: 1 })]).step, 2);
  const all = [1, 2, 3, 4, 5, 6, 7].map((n) => msg({ nurture_step: n }));
  assert.equal(nextNurtureStep(all).step, null, "exhausted sequence returns null");
});

// --- history handling ---
check("suppressed messages never count as sent", () => {
  const comms = [msg({ sent_at: hoursAgo(1), suppressed: true })];
  assert.equal(hoursSinceLastMessage(comms, NOW), Infinity);
  assert.equal(canSendMessage({ plan: plan(), communications: comms, now: NOW }).allowed, true);
});

check("uses the newest message regardless of array order", () => {
  const comms = [msg({ channel: "WhatsApp", sent_at: hoursAgo(100) }), msg({ channel: "RCS", sent_at: hoursAgo(2) })];
  assert.equal(nextChannel(comms), "WhatsApp");
  assert.equal(canSendMessage({ plan: plan(), communications: comms, now: NOW }).code, "TOO_SOON");
});

check("nextAllowedSendAt is exactly 48h after the last send", () => {
  const at = nextAllowedSendAt([msg({ sent_at: hoursAgo(10) })]);
  assert.equal((at - new Date(hoursAgo(10))) / 3600e3, MESSAGE_FLOOR_HOURS);
  assert.equal(nextAllowedSendAt([]), null);
});

// --- protocol lookup ---
check("planned message matches the protocol day", () => {
  assert.deepEqual(plannedMessageForDay("Hot", 1).channel, "WhatsApp");
  assert.deepEqual(plannedMessageForDay("Hot", 3).channel, "RCS/MMS");
  assert.equal(plannedMessageForDay("Hot", 2), null, "day 2 schedules no routine message");
  assert.equal(plannedMessageForDay("Nonsense", 1), null);
});

// --- stats, Section 27 ---
check("stats compute rates and cadence compliance", () => {
  const s = communicationStats([
    msg({ channel: "WhatsApp", sent_at: hoursAgo(96), delivered_at: hoursAgo(96), read_at: hoursAgo(95) }),
    msg({ channel: "RCS", sent_at: hoursAgo(48), delivered_at: hoursAgo(48), replied_at: hoursAgo(47) }),
    msg({ channel: "WhatsApp", sent_at: hoursAgo(24), delivered_at: hoursAgo(24) }), // 24h gap — breaches
    { channel: "MMS", delivery_status: "Failed" },
  ]);
  assert.equal(s.sent, 3);
  assert.equal(s.delivered, 3);
  assert.equal(s.failed, 1);
  assert.equal(s.replyRate, 33);
  assert.equal(s.cadenceComplianceRate, 67, "one of three gaps breaches the floor");
  assert.equal(s.byChannel.WhatsApp.sent, 2);
  assert.equal(s.byChannel.RCS.replyRate, 100);
});

check("stats on empty input do not divide by zero", () => {
  const s = communicationStats([]);
  assert.equal(s.sent, 0);
  assert.equal(s.replyRate, 0);
  assert.equal(s.cadenceComplianceRate, 0);
});

console.log(process.exitCode ? `\n${pass} passed, some FAILED` : `${pass} checks passed`);
