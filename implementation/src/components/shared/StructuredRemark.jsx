import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NON_CONVERSION_CATEGORIES, getReasonsForCategory } from "@/lib/reasonTaxonomy";
import { Phone, MessageSquare, ShieldQuestion, Paperclip, ArrowRight, CalendarClock } from "lucide-react";

// Structured call remark (Thesis §3.2 — "No Call Without a Remark")
// value: { patientSaid, agentExplained, objectionCategory, objectionRaised,
//          materialShared, nextAction, nextActionAt }
//
// Two of the seven parts are captured elsewhere on the call form and passed in:
//   connected        -> contact_outcome  (existing LeadInteraction enum)
//   patient response -> patient_response (existing LeadInteraction enum)
//
// Save must be gated on isRemarkComplete() — the AI layer drafts these fields,
// it does not bypass them.

export const NEXT_ACTIONS = [
  "Call", "WhatsApp", "RCS/MMS", "Appointment",
  "Doctor Callback", "Financial Counseling", "Escalate", "Close",
];

const MIN_LEN = 10;

export function isRemarkComplete(v = {}, { connected = true } = {}) {
  if (!connected) return true; // not-connected calls follow the retry path, not the 7-part remark
  return Boolean(
    (v.patientSaid || "").trim().length >= MIN_LEN &&
    (v.agentExplained || "").trim().length >= MIN_LEN &&
    v.nextAction &&
    v.nextActionAt
  );
}

export function missingRemarkParts(v = {}) {
  const missing = [];
  if ((v.patientSaid || "").trim().length < MIN_LEN) missing.push("What the patient said");
  if ((v.agentExplained || "").trim().length < MIN_LEN) missing.push("What you explained");
  if (!v.nextAction) missing.push("Next action");
  if (!v.nextActionAt) missing.push("When it must happen");
  return missing;
}

function Field({ icon: Icon, label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function StructuredRemark({ value = {}, onChange, connected = true, suggested = null }) {
  const {
    patientSaid = "", agentExplained = "", objectionCategory = "",
    objectionRaised = "", materialShared = "", nextAction = "", nextActionAt = "",
  } = value;

  const update = (patch) => onChange({ ...value, ...patch });
  const objections = useMemo(() => getReasonsForCategory(objectionCategory), [objectionCategory]);

  if (!connected) {
    return (
      <p className="text-sm text-muted-foreground">
        Call did not connect. Retry details are captured above — a structured remark is not required.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {suggested && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Drafted from the call transcript. Check each field before saving — you are confirming it, not the system.
        </div>
      )}

      <Field icon={MessageSquare} label="What the patient said" hint="In their words, not a summary.">
        <Textarea
          rows={2}
          value={patientSaid}
          onChange={(e) => update({ patientSaid: e.target.value })}
          placeholder="Wants surgery but needs to arrange money first, asked about EMI..."
        />
      </Field>

      <Field icon={Phone} label="What you explained">
        <Textarea
          rows={2}
          value={agentExplained}
          onChange={(e) => update({ agentExplained: e.target.value })}
          placeholder="Explained the laser procedure, day-care discharge, insurance coverage..."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field icon={ShieldQuestion} label="Objection raised">
          <Select value={objectionCategory} onValueChange={(v) => update({ objectionCategory: v, objectionRaised: "" })}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="None">None</SelectItem>
              {NON_CONVERSION_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {objections.length > 0 && (
          <Field icon={ShieldQuestion} label="Specifically">
            <Select value={objectionRaised} onValueChange={(v) => update({ objectionRaised: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {objections.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Field icon={Paperclip} label="Material shared" hint="Leave blank if nothing was sent.">
        <Input
          value={materialShared}
          onChange={(e) => update({ materialShared: e.target.value })}
          placeholder="Doctor profile card, package comparison..."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field icon={ArrowRight} label="Next action">
          <Select value={nextAction} onValueChange={(v) => update({ nextAction: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {NEXT_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field icon={CalendarClock} label="When">
          <Input
            type="datetime-local"
            value={nextActionAt}
            onChange={(e) => update({ nextActionAt: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
