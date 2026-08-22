// A call transcript in, a drafted §3.2 remark out.
//
// This is the point of the whole feature. §3.2 says no call without a remark, and the remark is
// seven parts. An agent on their ninetieth call of the day writes seven honest parts on the first
// twenty and something shorter every hour after that, which is not laziness — it is what typing
// costs when you have been talking since nine.
//
// So the model drafts and the agent confirms. Three rules make that safe rather than merely fast:
//
// **It quotes, it does not summarise.** `patientSaid` must be the patient's own words from the
// transcript. A remark that paraphrases is a remark nobody can audit, and the whole reason §3.2
// exists is that the record has to survive the agent who wrote it leaving.
//
// **It leaves gaps as gaps.** A field with nothing behind it in the transcript comes back empty
// rather than filled with something plausible. An invented objection is worse than a blank one,
// because a blank prompts a question and an invention ends it.
//
// **It never saves.** The response is a draft. `isRemarkComplete()` still gates the save, exactly
// as it did when the agent typed every word — the AI layer drafts these fields, it does not bypass
// them. That sentence is a comment in the shipped StructuredRemark component and it stays true.

import { config, fail, readPost, require } from "./_lib/config.mjs";
import { requireSession } from "./_lib/auth.mjs";

// Kept in step with implementation/src/components/shared/StructuredRemark.jsx and
// app/src/lib/reasonTaxonomy.js. The enums are closed so a draft cannot introduce a next action or
// an objection category the rest of the product has never heard of.
const NEXT_ACTIONS = [
  "Call", "WhatsApp", "RCS/MMS", "Appointment",
  "Doctor Callback", "Financial Counseling", "Escalate", "Close",
];

const OBJECTION_CATEGORIES = ["Financial", "Clinical", "Logistics", "Trust", "Timing", "Competition"];

const TEMPERATURES = ["Hot", "Warm", "Cold"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "patientSaid",
    "agentExplained",
    "objectionCategory",
    "objectionRaised",
    "materialShared",
    "nextAction",
    "temperature",
    "confidence",
    "notes",
  ],
  properties: {
    patientSaid: {
      type: "string",
      description:
        "What the patient actually said, in their own words, close to verbatim. Empty string if the patient barely spoke.",
    },
    agentExplained: {
      type: "string",
      description: "What the agent told them. Plain summary of the agent's side, not a transcript.",
    },
    objectionCategory: {
      type: ["string", "null"],
      enum: [...OBJECTION_CATEGORIES, null],
      description: "The one barrier in the way, if the patient named one. Null if they did not.",
    },
    objectionRaised: {
      type: "string",
      description: "The objection in the patient's own words. Empty string if there was none.",
    },
    materialShared: {
      type: "string",
      description:
        "Anything the agent said they would send or did send — a package price, a brochure, a doctor's profile. Empty string if nothing.",
    },
    nextAction: {
      type: ["string", "null"],
      enum: [...NEXT_ACTIONS, null],
      description: "What was actually agreed at the end of the call. Null if nothing was agreed.",
    },
    temperature: {
      type: ["string", "null"],
      enum: [...TEMPERATURES, null],
      description:
        "How ready they sound. Hot: wants it, asking about dates or money. Warm: real need, one barrier. Cold: no clear need. Null if the call was too short to tell.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "How well the transcript supported this. Low when the audio was fragmentary or the call was very short.",
    },
    notes: {
      type: "string",
      description:
        "One short sentence for the agent about anything the draft could not fill in and why. Empty string if the draft is complete.",
    },
  },
};

const SYSTEM_PROMPT = `You draft call remarks for a hospital telecalling team. A human reads every
draft and corrects it before it is saved, so your job is accuracy, not completeness.

You will be given a transcript of a call between an agent and a patient about a surgical
consultation. It comes from live speech recognition in a busy room, so it will contain
mis-hearings, missing words and no punctuation in places. Speaker labels may be wrong.

RULES
- patientSaid must be the patient's own words, as close to verbatim as the transcript allows. Do
  not tidy their grammar and do not translate. If they spoke Kannada, Telugu or Hindi, quote it in
  the language they used.
- Never invent. If the transcript does not support a field, return an empty string or null for it.
  A blank field makes the agent look; a plausible invention stops them looking.
- objectionCategory is the ONE thing standing between this patient and going ahead. If they raised
  three, pick the one they said with the most weight. If nothing is in the way, return null.
- nextAction is what was actually agreed out loud, not what should have been agreed.
- Judge temperature from what they said, not from how polite they were. "Send me the details" with
  nothing behind it is Cold, however warmly it was said.
- Set confidence to low if the call was under about thirty seconds, or if the transcript is too
  broken to read. Say why in notes.
- notes is for the agent, in one sentence, in plain English. Not a summary of the call.`;

/** The transcript is a live one, so it can be long and repetitive. Keep the request bounded. */
const MAX_TRANSCRIPT_CHARS = 24000;

export default async function handler(request, response) {
  const body = readPost(request, response);
  if (body === null) return;

  // Before anything that costs money.
  const session = requireSession(request, response);
  if (!session) return;

  const transcript = String(body.transcript ?? "").trim();
  if (transcript.length < 40) {
    // Not an error. A call too short to have said anything gets an honest empty draft rather than
    // a model's best guess at what a hospital call usually contains.
    return response.status(200).json({
      ok: true,
      draft: null,
      reason: "The call was too short to draft anything from.",
    });
  }

  try {
    require("openaiApiKey");
  } catch (error) {
    return fail(response, 503, error.message);
  }

  const context = body.lead
    ? `The patient is ${body.lead.patient_name ?? "unnamed"}, enquiring about ${
        body.lead.disease ?? "an unspecified condition"
      }.`
    : "";

  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.extractionModel,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${context}\n\n<transcript>\n${transcript.slice(
              -MAX_TRANSCRIPT_CHARS
            )}\n</transcript>`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "call_remark", strict: true, schema: SCHEMA },
        },
      }),
    });

    if (!completion.ok) {
      const detail = await completion.text();
      return fail(response, 502, "The drafting model refused the request.", detail.slice(0, 300));
    }

    const payload = await completion.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return fail(response, 502, "The drafting model returned nothing.");

    const draft = JSON.parse(content);

    // Belt and braces on the closed sets. Strict schema mode should make this impossible, and a
    // value the rest of the product has never heard of would silently break a dropdown.
    if (draft.nextAction && !NEXT_ACTIONS.includes(draft.nextAction)) draft.nextAction = null;
    if (draft.objectionCategory && !OBJECTION_CATEGORIES.includes(draft.objectionCategory)) {
      draft.objectionCategory = null;
    }
    if (draft.temperature && !TEMPERATURES.includes(draft.temperature)) draft.temperature = null;

    return response.status(200).json({ ok: true, draft, model: config.extractionModel });
  } catch (error) {
    return fail(response, 502, "Could not reach the drafting model.", String(error?.message || error));
  }
}
