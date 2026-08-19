import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import LeadJourney from "@/components/shared/LeadJourney";
import NoAccess from "@/components/shared/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import {
  APPOINTMENT_STATES,
  CANCEL_REASONS,
  CONSULTATION_TYPES,
  PREPARATION_NOTES,
  REASON_REQUIRED,
  bookingProblems,
  nextStates,
  recoveryTaskFor,
  reminderPlan,
} from "@/lib/appointments";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// A8. Appointment Booking — the screen every dashboard was already counting.
//
// The ten §17 states are enforced as a machine: only the states that may follow the current one are
// offered, so nobody records a Consultation Completed on a lead that was never booked. Cancel and
// no-show cost a reason, because §3.3 applies to closure-adjacent events. A no-show raises its own
// recovery task instead of ending the lead.

const DOCTORS = ["Dr. Ananya Rao", "Dr. Suresh Menon", "Dr. Kavya Iyer", "Dr. Rahul Bhat"];
const BRANCHES = ["Jayanagar", "Whitefield", "Indiranagar", "Hebbal"];

/** The next round hour, as the default slot — nobody wants to type a date from scratch. */
function defaultSlot() {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(11, 0, 0, 0);
  // datetime-local wants a local ISO string without the zone.
  const pad = (n) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(
    at.getMinutes()
  )}`;
}

export default function AppointmentBooking() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { leadById, updateLead, audit } = useStore();
  const { user } = useSession();

  const lead = leadById(leadId);
  const current = lead?.appointment ?? null;

  const [state, setState] = useState(null);
  const [doctor, setDoctor] = useState(current?.doctor ?? DOCTORS[0]);
  const [branch, setBranch] = useState(current?.branch ?? lead?.branch ?? BRANCHES[0]);
  const [consultationType, setConsultationType] = useState(current?.consultationType ?? "In-person");
  const [at, setAt] = useState(current?.at ? current.at.slice(0, 16) : defaultSlot());
  const [reason, setReason] = useState(null);
  const [companion, setCompanion] = useState(current?.companion ?? "");
  const [touched, setTouched] = useState(false);

  const allowed = nextStates(current?.state);
  const problems = useMemo(
    () => bookingProblems({ state, doctor, branch, at, consultationType, reason }),
    [state, doctor, branch, at, consultationType, reason]
  );
  const reminders = useMemo(() => reminderPlan(at ? new Date(at).toISOString() : null), [at]);

  if (!lead) return <NoAccess screen="A8" />;
  if (!canOpenLead(user, lead)) return <NoAccess screen="A8" />;

  const needsReason = REASON_REQUIRED.includes(state);
  const travel = CONSULTATION_TYPES.find((type) => type.value === consultationType)?.travel;

  const save = () => {
    setTouched(true);
    if (problems.length) return;

    const record = {
      ...current,
      state,
      doctor: needsReason ? current?.doctor : doctor,
      branch: needsReason ? current?.branch : branch,
      consultationType: needsReason ? current?.consultationType : consultationType,
      at: needsReason ? current?.at : new Date(at).toISOString(),
      companion: needsReason ? current?.companion : companion || null,
      reason: needsReason ? reason : null,
      updated_at: new Date().toISOString(),
      updated_by: user?.name ?? null,
      history: [
        ...(current?.history ?? []),
        { state, at: new Date().toISOString(), by: user?.name ?? null, reason: needsReason ? reason : null },
      ],
    };

    const task = recoveryTaskFor(record);

    updateLead(lead.id, {
      appointment: record,
      lead_status: state === "Consultation Completed" ? "Consultation Completed" : lead.lead_status,
      // Booking suppresses routine follow-up messaging and switches to the reminder sequence (§12).
      plan: {
        appointment_booked: ["Booked", "Confirmation Pending", "Confirmed", "Patient Arrived"].includes(state),
        ...(task ? { no_show_recovery: task } : {}),
      },
    });

    audit?.({
      action: "appointment_state",
      lead_id: lead.id,
      actor: user?.name,
      detail: `${current?.state ?? "New"} → ${state}${reason ? ` (${reason})` : ""}`,
    });

    navigate(`/leads/${lead.id}`);
  };

  return (
    <>
      <PageHeader
        screen="A8"
        title={`Appointment — ${lead.patient_name}`}
        subtitle="Book, confirm and protect the visit. Only the states that may follow this one are offered."
        thesis="§17, §30.6"
        back={{ to: `/leads/${lead.id}`, label: lead.patient_name }}
      />

      <LeadJourney lead={lead} current="appointment" />

      <div className="space-y-6 p-4">
        <SectionCard
          title="Where this appointment stands"
          caption={
            current
              ? `${current.state} · ${current.doctor ?? "no doctor"} · ${formatDateTime(current.at)}`
              : "Nothing booked yet. The first move is to suggest a slot."
          }
        >
          <div className="flex flex-wrap gap-1">
            {APPOINTMENT_STATES.map((option) => {
              const isAllowed = allowed.includes(option.value);
              const isCurrent = current?.state === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={!isAllowed}
                  onClick={() => {
                    setState(option.value);
                    setReason(null);
                    setTouched(false);
                  }}
                  title={isAllowed ? option.plain : `Cannot go from ${current?.state ?? "nothing"} to ${option.value}`}
                  className={cn(
                    "rounded-md px-4 py-2 text-left text-sm",
                    state === option.value && "bg-primary text-primary-foreground",
                    state !== option.value && isCurrent && "bg-primary-tint text-primary",
                    state !== option.value && !isCurrent && isAllowed && "bg-secondary text-muted-foreground",
                    !isAllowed && "bg-secondary/50 text-placeholder"
                  )}
                >
                  <span className="block font-semibold">{option.value}</span>
                  <span className="block text-xs opacity-80">{option.plain}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Greyed states are not reachable from here. An appointment that skips a rung is a record
            nobody can audit.
          </p>
        </SectionCard>

        {needsReason && (
          <SectionCard
            title={`Why was it ${state === "Cancelled" ? "cancelled" : "missed"}?`}
            caption="§3.3 applies here too — a cancellation without a reason is the same unfalsifiable record as a copy-pasted remark."
          >
            <div className="flex flex-wrap gap-1">
              {CANCEL_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(option)}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm",
                    reason === option ? "bg-primary-tint font-semibold text-primary" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            {state === "No-show" && (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-warning/10 p-4">
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-muted-foreground">
                  A no-show raises a recovery call for tomorrow and puts this lead in the no-show
                  recovery segment. It does not close the lead.
                </p>
              </div>
            )}
          </SectionCard>
        )}

        {state && !needsReason && (
          <>
            <SectionCard title="The visit">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Doctor</p>
                  <div className="flex flex-wrap gap-1">
                    {DOCTORS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setDoctor(name)}
                        className={cn(
                          "rounded-md px-4 py-2 text-sm",
                          doctor === name ? "bg-primary-tint font-semibold text-primary" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Branch</p>
                  <div className="flex flex-wrap gap-1">
                    {BRANCHES.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setBranch(name)}
                        className={cn(
                          "rounded-md px-4 py-2 text-sm",
                          branch === name ? "bg-primary-tint font-semibold text-primary" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">How they will be seen</p>
                  <div className="flex flex-wrap gap-1">
                    {CONSULTATION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setConsultationType(type.value)}
                        className={cn(
                          "rounded-md px-4 py-2 text-sm",
                          consultationType === type.value
                            ? "bg-primary-tint font-semibold text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="slot" className="block text-sm font-semibold">
                    Date and time
                  </label>
                  <Input
                    id="slot"
                    type="datetime-local"
                    value={at}
                    onChange={(event) => setAt(event.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="companion" className="block text-sm font-semibold">
                    Who is coming with them
                  </label>
                  <Input
                    id="companion"
                    value={companion}
                    placeholder="Son, daughter, spouse — or leave blank"
                    onChange={(event) => setCompanion(event.target.value)}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="What the patient gets sent"
              caption="Booking holds the routine follow-up messages and switches to these four. §12."
            >
              <ul className="space-y-2">
                {reminders.map((reminder) => (
                  <li key={reminder.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span>{reminder.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {reminder.channel} · {formatDateTime(reminder.when)}
                    </span>
                  </li>
                ))}
              </ul>
              {travel && (
                <div className="mt-4 rounded-md bg-secondary p-4">
                  <p className="text-xs font-semibold">Told to the patient before they travel</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {PREPARATION_NOTES.map((note) => (
                      <li key={note}>· {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          </>
        )}

        <div className="space-y-2">
          {touched && problems.length > 0 && (
            <p className="text-sm text-destructive">Still needed: {problems.join(" · ")}</p>
          )}
          <Button className="w-full" onClick={save} disabled={problems.length > 0}>
            <CalendarCheck className="h-6 w-6" />
            {state ? `Record: ${state}` : "Pick what happened"}
          </Button>
        </div>

        {current?.history?.length > 0 && (
          <SectionCard title="What happened to this appointment">
            <ol className="space-y-2">
              {[...current.history].reverse().map((entry, index) => (
                <li key={`${entry.state}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{entry.state}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at)} · {entry.by ?? "—"}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </SectionCard>
        )}
      </div>
    </>
  );
}
