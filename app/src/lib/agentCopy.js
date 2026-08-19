// Agent-facing wording and ordering.
//
// The rest of the app talks to a manager auditing a specification. This file talks to the person
// making ninety calls a day, in the words they use: "call now", "wait for the message", "number
// is wrong". Nothing here says protocol, cadence, guard, suppression or §12 — an agent cannot act
// on a section number.
//
// It also decides the order of the queue, because "what do I do next" is the only question the
// screen has to answer. Priority: an untouched lead, then a call the plan owes today, then the
// hottest lead, then everything else.

import { TOUCH_SLA_MINUTES, callCompliance, formatMinutes, touchTimeState } from "@/lib/touchTime";
import { stepForDay } from "@/lib/followupProtocols";

/** Plain-language version of what the message engine decided. */
export function messageAdvice(verdict) {
  if (!verdict) return { label: "—", tone: "secondary", hint: null };
  if (verdict.allowed) {
    return {
      label: `Send ${verdict.channel} now`,
      tone: "success",
      hint: null,
    };
  }
  switch (verdict.code) {
    case "TOO_SOON": {
      const hoursLeft = Math.max(1, Math.ceil(48 - (verdict.hoursElapsed ?? 0)));
      return {
        label: `Message after ${hoursLeft}h`,
        tone: "warning",
        hint: "Calling is fine now. Only the message has to wait.",
      };
    }
    case "OPTED_OUT":
      return { label: "Do not message", tone: "destructive", hint: "Patient asked us to stop." };
    case "INVALID_NUMBER":
      return { label: "Number is wrong", tone: "destructive", hint: "Log it and move to the next lead." };
    case "CONVERTED":
      return { label: "Already our patient", tone: "secondary", hint: "No lead messages for this one." };
    case "SUPPRESSED":
      return {
        label: "No message needed",
        tone: "secondary",
        hint: verdict.reason || "The patient has already replied or booked.",
      };
    default:
      return { label: verdict.reason || "Cannot message", tone: "destructive", hint: null };
  }
}

/**
 * The one line that tells the agent what this lead needs, and how late it already is.
 * `weight` sorts the queue; `tone` decides whether it reads as overdue.
 */
export function nextStepFor(lead, interactions, now = new Date()) {
  const touch = touchTimeState(lead, interactions, now);
  const compliance = callCompliance(lead, interactions);
  const day = lead.plan?.day ?? 1;
  const step = stepForDay(lead.plan?.temperature, day);
  const temperature = lead.plan?.temperature;

  // Closed states come before the clock. A converted patient with no logged call would otherwise
  // read as "call now — never contacted", which is how an agent ends up ringing someone who has
  // already had their surgery.
  if (lead.plan?.patient_converted) {
    return { label: "Already treated", detail: "Nothing pending on this one", tone: "good", weight: 4 };
  }
  if (lead.plan?.opted_out || lead.opted_out) {
    return {
      label: "Do not contact",
      detail: "Patient asked us to stop. Calling again is a complaint waiting to happen.",
      tone: "default",
      weight: 2,
    };
  }
  if (lead.number_valid === false) {
    return {
      label: "Number is wrong",
      detail: "Log it once so it stops coming back to you",
      tone: "default",
      weight: 45,
    };
  }
  if (lead.plan?.appointment_booked) {
    return { label: "Appointment booked", detail: "Confirm it the day before", tone: "good", weight: 35 };
  }

  if (touch.state === "breached") {
    return {
      label: "Call now — never contacted",
      detail: `Waiting ${formatMinutes(touch.minutes)}`,
      tone: "bad",
      weight: 100,
    };
  }
  if (touch.state === "running") {
    return {
      label: "Call now — new lead",
      detail: `${formatMinutes(Math.max(0, touch.remaining))} left of the ${TOUCH_SLA_MINUTES} minutes`,
      tone: "bad",
      weight: 95,
    };
  }
  if (compliance.missed > 0) {
    return {
      label: `Call now — ${compliance.missed} call${compliance.missed > 1 ? "s" : ""} missed`,
      detail: `Plan asked for ${compliance.required} by today, ${compliance.done} done`,
      tone: "bad",
      weight: 90 - (temperature === "Hot" ? 0 : 5),
    };
  }
  if (step?.callRequired) {
    return {
      label: "Call today",
      detail: step.doubleDial ? "Try twice, at two different times" : step.callActivity,
      tone: temperature === "Hot" ? "warn" : "default",
      weight: temperature === "Hot" ? 80 : temperature === "Not Connected" ? 70 : 60,
    };
  }
  return {
    label: "No call due today",
    detail: step?.messageRequired ? "A message is planned for today" : "Next call is on a later day",
    tone: "default",
    weight: 20,
  };
}

/** The last thing the patient actually said, so the agent opens the call knowing it. */
export function lastWord(interactions) {
  const latest = [...interactions].sort(
    (a, b) => new Date(b.interaction_date) - new Date(a.interaction_date)
  )[0];
  if (!latest) return { said: "Not called yet", objection: null, next: null };
  if (latest.contact_outcome !== "Connected") {
    return {
      said: latest.not_connected_reason ? `Did not answer — ${latest.not_connected_reason}` : "Did not answer",
      objection: null,
      next: latest.feedback || null,
    };
  }
  return {
    said: latest.patient_said || latest.feedback || "Spoke, no remark written",
    objection: latest.objection_raised || null,
    next: latest.next_action || null,
  };
}

/** The agent's own numbers for today. Their work, not the team's. */
export function myDay(leads, interactionsFor, now = new Date()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  let callsToday = 0;
  let callsDue = 0;
  let callsMissed = 0;
  let waitingFirstCall = 0;
  let appointments = 0;

  for (const lead of leads) {
    const interactions = interactionsFor(lead.id);
    callsToday += interactions.filter((i) => new Date(i.interaction_date) >= startOfDay).length;

    const compliance = callCompliance(lead, interactions);
    callsMissed += compliance.missed;

    const step = stepForDay(lead.plan?.temperature, lead.plan?.day ?? 1);
    if (step?.callRequired) callsDue++;

    const touch = touchTimeState(lead, interactions, now);
    if (touch.state === "running" || touch.state === "breached") waitingFirstCall++;

    if (lead.plan?.appointment_booked || lead.lead_status === "Appointment Booked") appointments++;
  }

  return { leads: leads.length, callsToday, callsDue, callsMissed, waitingFirstCall, appointments };
}

/** A `tel:` href, so the number on screen is a call and not a thing to copy out by hand. */
export function telHref(phone) {
  return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
}
