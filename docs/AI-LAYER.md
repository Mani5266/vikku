# AI Layer — Call Transcription and Analysis

Design for the AI capability that sits under the CRM: **Soniox** for speech-to-text on calls, **OpenAI** for analysis, summary and drafting.

> Status: specification only. No keys have been provided and nothing is wired. See [Open questions](#open-questions) before implementation starts.

## Why this belongs in the thesis

The thesis rests on evidence. [Section 3.2](THESIS.md#32-no-call-without-a-remark) demands that every call produce a seven-part structured remark; [Section 23](THESIS.md#23-mandatory-non-conversion-reason-structure) demands that every closure link to a real activity record; [Section 28](THESIS.md#28-agent-performance-must-be-data-based) scores agents on remark quality.

In practice, structured remarks are the hardest rule in the thesis to enforce, because they compete with call volume. An agent finishing a six-minute call does not want to fill seven fields. The result is either thin remarks or slow agents.

Transcription plus analysis removes that trade-off: the call itself becomes the evidence, and the remark is drafted from it. The agent's job shifts from typing to confirming.

This is the one place where AI earns its position in this system. Everything else it could do here is secondary.

## Architecture

```
Call (telephony / softphone)
  > audio capture + patient consent gate
    > Soniox        transcript, speaker labels, timestamps
      > redaction   strip direct identifiers before egress
        > OpenAI    extraction, classification, summary, drafting
          > CRM     draft remark + signals, presented for agent confirmation
            > audit model, prompt version, accepted or edited
```

Nothing on this path writes to a lead record without a human confirming it.

## Soniox — transcription

| Concern | Decision |
|---------|----------|
| Mode | Batch after call end for the first release; real-time is only needed for live agent assist, which is not in scope yet |
| Speaker separation | Diarization required — the analysis is meaningless if agent and patient speech are merged |
| Language | Indian English with Telugu and Hindi code-switching. This is a Hyderabad hospital; mid-sentence language switching is normal, not an edge case. Verify Soniox handling before committing |
| Output stored | Transcript text, per-utterance speaker label, per-utterance timestamp, confidence |
| Audio retention | Configurable. The transcript is the evidence record; raw audio retention is a policy decision, not a technical one |

Timestamps are not optional. They are what makes an evidence link resolve — [A9](../screens/01-agent-screens.md#a9-non-conversion-reason-capture) requires the evidence source to point at a real record, and "the patient stated their budget at 04:12" is a materially stronger record than a typed claim.

## OpenAI — analysis

Seven jobs, in priority order.

### 1. Draft the seven-part remark

The highest-value job. From the transcript, draft each field of [Section 3.2](THESIS.md#32-no-call-without-a-remark):

whether the call connected · what the patient said · what the agent explained · what objection was raised · what material was shared · what the next action is · when the next action must happen

Presented in [A3](../screens/01-agent-screens.md#a3-new-call--call-logging) as an editable draft. The agent confirms or corrects. Save still requires all seven fields, exactly as before — the AI fills the form, it does not bypass it.

### 2. Extract the objection

Classify against the fixed vocabulary in [`reason-codes.md`](../reference/reason-codes.md) — the seven categories and their sub-reasons. Constrained output only; the model picks from the taxonomy, it does not invent reason codes. An unmatched objection returns "none matched" and the agent picks manually.

### 3. Extract qualification signals

Pull evidence for the eleven [Section 7](THESIS.md#7-lead-quality-classification) scoring factors: symptom severity, duration, treatment urgency, distance, financial readiness, appointment readiness, decision authority, previous treatment, insurance, interest in consultation, interest in surgery.

Feeds [A4](../screens/01-agent-screens.md#a4-qualification--scoring) as suggested values with the supporting quote attached to each. The thesis is explicit that Hot/Warm/Cold must not rest on the telecaller's personal feeling — grounding each factor in a quote is exactly that requirement met.

### 4. Suggest the non-conversion reason

On closure, propose primary reason, secondary reason and recoverability, each with a transcript citation. Populates [A9](../screens/01-agent-screens.md#a9-non-conversion-reason-capture) as a draft.

**The agent must confirm. AI never closes a lead.** A wrongly auto-closed lead is a silently lost patient, and the whole point of Section 23 is that a human took responsibility for the diagnosis.

### 5. Score remark quality

[Section 28](THESIS.md#28-agent-performance-must-be-data-based) scores remarks on structural completeness, not prose. With a transcript available, the score can go further: did the remark actually reflect the call? A remark claiming financial counseling was explained, against a transcript where it never came up, is a process-compliance signal for [M6](../screens/02-manager-screens.md#m6-agent-scorecard).

Handle this carefully. It is the one use here that can read as surveillance, and it should be framed and used as coaching input, not as a disciplinary trigger.

### 6. Summarise the call

Two-line summary for the [A2](../screens/01-agent-screens.md#a2-lead-detail-360-view) timeline, so a manager scanning a lead's history does not read six transcripts.

### 7. Draft report narrative

For [L6](../screens/03-leadership-screens.md#l6-15-day-diagnostic-report), draft the finding, root cause and corrective action prose from **aggregated metrics** — never from raw transcripts. Numbers come from the database; the model writes the sentences around them. The human edits before publishing, and the publish guard requiring evidence links stays in force.

## Guardrails

These are not optional additions. Without them the AI layer breaks the thesis it is meant to serve.

| Guardrail | Rule |
|-----------|------|
| **Draft, never commit** | No AI output writes to a lead record unconfirmed. No AI-set status, no AI-closed lead, no AI-sent message |
| **Constrained vocabulary** | Reason codes, statuses and qualification bands come from the configured taxonomy. The model selects; it does not invent |
| **Citation required** | Every extracted claim carries a transcript timestamp. An extraction with no citation is dropped, not shown |
| **Audited** | Per [Section 29](THESIS.md#29-evidence-and-audit-trail): model, model version, prompt version, input hash, output, and whether the agent accepted, edited or rejected it |
| **Accept rate tracked** | If agents override an extraction most of the time, that extraction is wrong and gets turned off. Measure it from day one |
| **Degrades cleanly** | Transcription or analysis failure leaves the agent with the normal manual form. The CRM never blocks on an AI call |
| **Cost per call bounded** | Transcription plus analysis runs on every call at telecalling volume. Model and token budget per call is a design constraint, not an afterthought |

## Patient data — decide before building

Call recordings of patients discussing symptoms, diagnoses and finances are sensitive health data. Sending them to third-party APIs is a real decision with real obligations, and it needs an explicit answer rather than a default.

Points to settle:

- **Consent.** Patients must be told the call is recorded and processed. This is a change to the call opening script, not only a system change.
- **Redaction before egress.** Strip name, phone, address and identifiers from the transcript before it goes to OpenAI. Analysis works on symptoms, objections and intent — it does not need to know who the patient is. The CRM re-attaches identity locally.
- **Retention.** How long transcripts and audio are held, and who can read them. Transcript access should follow the same role permissions as the lead record, per [S6](../screens/05-admin-screens.md#s6-roles-permissions--user-manual).
- **Data processing terms.** Confirm zero-retention or equivalent terms with both vendors before production traffic.
- **Opt-out.** A patient who declines recording still gets a normal call and a manually written remark.

The thesis already requires consent and opt-out tracking for messaging ([Section 9](THESIS.md#9-alternating-whatsapp-and-mobile-rich-communication)). Recording consent extends the same field, it does not need a parallel system.

## Where it lands in the app

Against the [existing app mapping](../screens/06-existing-app-mapping.md):

| Screen | Change |
|--------|--------|
| [A3](../screens/01-agent-screens.md#a3-new-call--call-logging) Call Logging | Built. Add the transcript panel and the drafted remark |
| [A4](../screens/01-agent-screens.md#a4-qualification--scoring) Qualification | Partial. Suggested factor values with quotes |
| [A9](../screens/01-agent-screens.md#a9-non-conversion-reason-capture) Reason Capture | Partial. Suggested reason with citation |
| [A2](../screens/01-agent-screens.md#a2-lead-detail-360-view) Lead Detail | Built. Call summaries on the timeline; transcript behind a permission |
| [M6](../screens/02-manager-screens.md#m6-agent-scorecard) Scorecard | Built. Remark-versus-transcript fidelity as a process signal |
| [L6](../screens/03-leadership-screens.md#l6-15-day-diagnostic-report) 15-Day Report | New. Narrative drafting |
| [S5](../screens/05-admin-screens.md#s5-audit-log) Audit Log | Partial. Add AI action entries |

The app already has `src/lib/auditLog.js` and `src/lib/reasonTaxonomy.js`, which the audit and constrained-vocabulary guardrails both depend on. Neither needs to be built from scratch.

## Open questions

Answer these before any code is written.

1. **Where does call audio come from?** There is no telephony integration in the app today. Soniox needs an audio source — a softphone, a cloud PBX with recording, or a mobile dialler. This is the actual blocker, and it is a bigger piece of work than either API.
2. **Batch or real-time?** Batch after call end is simpler and covers all seven jobs above. Real-time is only required for live agent prompting.
3. **Which OpenAI model?** Extraction and classification are cheap, high-volume, and run on every call. Narrative drafting is rare and quality-sensitive. These likely want different models rather than one.
4. **Recording consent** — script change, and who approves it.
5. **Redaction scope** — confirm what must be stripped before egress.
6. **Volume and budget** — calls per day, to size cost per call.
