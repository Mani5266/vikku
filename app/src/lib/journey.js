// Where a lead is, and what happens to it next.
//
// The app grew screen by screen, each one correct on its own, and the result was a pile: an agent
// opening the composer had no way of knowing why it existed or when it applied, because nothing on
// screen said a lead moves through stages at all. The screen codes made it worse — "A6" is the
// specification's name for a thing, not a step in anybody's day.
//
// So the lead has four stages, they are always on screen, and each one says done / now / later /
// not yet. Messaging is not a stage: it is something you do while working the plan, which is why it
// used to appear out of nowhere.
//
//   1  Qualify        decide how interested they are        (A4)
//   2  Work the plan  the calls and messages it schedules   (A5, with A3 and A6 inside it)
//   3  Appointment    get them in front of the doctor       (A8)
//   4  Outcome        they came, or they closed with a reason (A9)

const BOOKED_STATES = ["Booked", "Confirmation Pending", "Confirmed", "Rescheduled", "Patient Arrived"];

/** Has this lead been through qualification, by any route? */
export function isQualified(lead) {
  return Boolean(lead?.qualification || lead?.plan?.temperature);
}

export function isClosed(lead) {
  return Boolean(lead?.closure);
}

export function isConverted(lead) {
  return lead?.appointment?.state === "Consultation Completed" || lead?.lead_status === "Converted";
}

/**
 * The four stages with a state each.
 *
 * `done` — it happened · `now` — this is where the lead is · `later` — it is reachable but not the
 * next thing · `locked` — it cannot happen yet, and the step says what has to happen first.
 */
export function leadStages(lead) {
  const qualified = isQualified(lead);
  const appointment = lead?.appointment?.state ?? null;
  const booked = BOOKED_STATES.includes(appointment);
  const closed = isClosed(lead);
  const converted = isConverted(lead);

  const stages = [
    {
      key: "qualify",
      label: "Qualify",
      plain: "How interested are they?",
      to: `/leads/${lead?.id}/qualify`,
      state: qualified ? "done" : "now",
      detail: qualified ? `Graded ${lead.plan?.temperature ?? lead.qualification?.chosen}` : "Not graded yet",
    },
    {
      key: "plan",
      label: "Work the plan",
      plain: "The calls and messages it schedules",
      to: `/leads/${lead?.id}/plan`,
      state: !qualified ? "locked" : closed || converted ? "done" : booked ? "later" : "now",
      detail: !qualified
        ? "Qualify first — the grade decides the plan"
        : lead.plan?.temperature
          ? `${lead.plan.temperature} plan running`
          : "No plan running",
    },
    {
      key: "appointment",
      label: "Appointment",
      plain: "Get them in front of the doctor",
      to: `/leads/${lead?.id}/appointment`,
      state: !qualified ? "locked" : converted ? "done" : booked ? "now" : closed ? "later" : "later",
      detail: !qualified ? "Qualify first" : appointment ? appointment : "Nothing booked",
    },
    {
      key: "outcome",
      label: "Outcome",
      plain: "They came, or it closes with a reason",
      to: `/leads/${lead?.id}/close`,
      state: converted ? "done" : closed ? "done" : "later",
      detail: converted
        ? "Consultation completed"
        : closed
          ? `Closed — ${lead.closure.reason}`
          : "Still open",
    },
  ];

  return stages;
}

/**
 * The single next thing to do, in the agent's words.
 *
 * One sentence and one button. Everything else on the screen is reference; this is the instruction,
 * and it is the thing an agent at their ninetieth call of the day actually reads.
 */
export function nextStep(lead, { messageAllowed = false, messageReason = null } = {}) {
  if (!lead) return null;

  if (isConverted(lead)) {
    return {
      label: "Nothing — they saw the doctor",
      why: "The consultation is done. Anything after this belongs to the clinical team.",
      to: null,
      action: null,
    };
  }

  if (isClosed(lead)) {
    return {
      label: "Nothing — this lead is closed",
      why: `Closed as ${lead.closure.category} / ${lead.closure.reason}. Reopen it only if the patient comes back.`,
      to: null,
      action: null,
    };
  }

  // A dead number is not a call to make. Telling an agent to keep ringing it wastes the only thing
  // they are short of, and the lead comes back tomorrow unless the fact is written down once.
  if (lead.number_valid === false) {
    return {
      label: "Write down that the number is wrong",
      why: "Nobody can be reached on this number. Log it once and this lead stops coming back to you every day.",
      to: `/leads/${lead.id}/call`,
      action: "Log the wrong number",
    };
  }

  if (!isQualified(lead)) {
    return {
      label: "Qualify this lead",
      why: "Nothing can be scheduled until you know how interested they are — the grade picks the follow-up plan.",
      to: `/leads/${lead.id}/qualify`,
      action: "Answer the eleven questions",
    };
  }

  const appointment = lead.appointment?.state ?? null;

  if (appointment === "No-show") {
    return {
      label: "Call about the missed appointment",
      why: "They did not come. A no-show is recoverable for about a day — after that it goes cold.",
      to: `/leads/${lead.id}/call`,
      action: "Log the recovery call",
    };
  }

  if (BOOKED_STATES.includes(appointment)) {
    return {
      label: "Move the appointment forward",
      why: `The appointment is at ${appointment}. Confirm it, or record what actually happened.`,
      to: `/leads/${lead.id}/appointment`,
      action: "Update the appointment",
    };
  }

  if (appointment === "Suggested" || appointment === "Patient Considering") {
    return {
      label: "Get the slot booked",
      why: "A suggested slot is not an appointment. Book it while they are still on the phone.",
      to: `/leads/${lead.id}/appointment`,
      action: "Book the slot",
    };
  }

  if (messageAllowed) {
    return {
      label: "Call them, or send the message that is due",
      why: "The plan has a call due, and a message is allowed right now.",
      to: `/leads/${lead.id}/call`,
      action: "Log a call",
      alternative: { label: "Send the message", to: `/leads/${lead.id}/compose` },
    };
  }

  return {
    label: "Call them",
    why: messageReason
      ? `The plan has a call due. A message cannot go yet — ${messageReason}`
      : "The plan has a call due.",
    to: `/leads/${lead.id}/call`,
    action: "Log a call",
  };
}
