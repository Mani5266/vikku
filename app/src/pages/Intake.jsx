import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardPaste, FileSpreadsheet, UserPlus, X } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { useToast } from "@/components/ui/toast";
import { CANONICAL_SOURCES } from "@/lib/sourceRegistry";
import { rosterLoad } from "@/lib/assignment";
import {
  BULK_COLUMNS,
  INTAKE_PATHS,
  assignmentFor,
  buildLead,
  findDuplicates,
  intakeProblems,
  pathByKey,
  parseBulk,
  parseRows,
  platformFor,
} from "@/lib/intake";

// Where a lead comes from.
//
// Everything else in this product assumed a lead was already there. There was no form, no import
// and no `addLead` on the store — leads existed because the seed invented them. A telecaller taking
// an enquiry on the phone had nowhere to put it.
//
// Two things this screen refuses to do. It will not accept a lead without the attribution §3.1
// makes mandatory, because a lead with no source is a lead the MD can never trace back to the money
// he spent getting it. And it will not quietly create a second record for a patient already in the
// system, because two agents ringing the same person about the same condition is how a hospital
// loses a lead it had already won.

const BRANCHES = ["Jayanagar", "Whitefield"];

const FIELD = "space-y-1.5";

export default function Intake() {
  const navigate = useNavigate();
  const { leads, addLeads } = useStore();
  const { user } = useSession();
  const { toast } = useToast();

  const [path, setPath] = useState("manual");
  const [draft, setDraft] = useState({});
  const [bulkText, setBulkText] = useState("");
  // A chosen file produces rows directly. Text and rows are kept apart rather than turning the
  // file back into a pasteable string: a name with a comma in it survives as a cell and would not
  // survive the round trip.
  const [fileRows, setFileRows] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [touched, setTouched] = useState(false);

  const roster = useMemo(() => rosterLoad(leads), [leads]);
  const problems = useMemo(() => intakeProblems(draft, { path }), [draft, path]);
  const duplicates = useMemo(() => findDuplicates(draft, leads), [draft, leads]);
  const assignment = useMemo(() => assignmentFor(draft, roster), [draft, roster]);
  // One guard, whichever door the leads came through.
  const parsed = useMemo(
    () => (fileRows ? parseRows(fileRows) : parseBulk(bulkText)),
    [fileRows, bulkText]
  );

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const chosen = pathByKey(path);
  const ready = problems.length === 0 && !duplicates.blocking;

  const saveOne = () => {
    setTouched(true);
    if (!ready) return;
    const [created] = addLeads(buildLead(draft, { path, assignment }));
    toast({
      title: `${created.patient_name} is in the queue`,
      description: `${assignment.agent_name ?? "Nobody"} has five minutes to make the first call.`,
    });
    navigate(`/leads/${created.id}`);
  };

  const clearFile = () => {
    setFileRows(null);
    setFileName(null);
    setFileError(null);
  };

  const chooseFile = async (file) => {
    if (!file) return;
    clearFile();
    try {
      // The reader is loaded only when somebody actually picks a file. It is dead weight on the
      // first paint of every other screen, and this app is opened on hospital mobile data.
      const reader = await import("@/lib/xlsx.js");
      const rows = reader.isSpreadsheet(file.name)
        ? await reader.readWorkbook(file)
        : reader.readDelimited(await file.text());
      if (!rows.length) {
        setFileError("There are no rows in that file.");
        return;
      }
      setFileRows(rows);
      setFileName(file.name);
    } catch (error) {
      // Named, not swallowed. A file that will not open and says nothing is a file somebody
      // tries three more times.
      setFileError(error?.message || "That file could not be read.");
    }
  };

  const saveBulk = () => {
    if (!parsed.rows.length) return;
    const records = parsed.rows.map((row) => buildLead(row, { path: "bulk", assignment: assignmentFor(row, roster) }));
    addLeads(records);
    toast({ title: `${records.length} leads added`, description: "They are at the top of the queue, uncalled." });
    setBulkText("");
    clearFile();
    navigate("/");
  };

  return (
    <>
      <PageHeader
        screen="A0"
        title="Add a lead"
        subtitle="An enquiry that has not been written down anywhere is one nobody will call."
        thesis="§3.1, §5, §30.1"
      />

      <div className="space-y-4 p-4">
        <SectionCard title="How did this one reach us?" caption="The path decides which attribution is true for it. A walk-in has no landing page, and demanding one would teach the front desk to type something false into the field the MD reports on.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {INTAKE_PATHS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                disabled={!entry.built}
                onClick={() => setPath(entry.key)}
                className={
                  !entry.built
                    ? "cursor-not-allowed rounded-md border-2 border-transparent bg-secondary/60 p-3 text-left opacity-70"
                    : entry.key === path
                      ? "rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                      : "rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{entry.label}</span>
                  {!entry.built && <StatusPill status="Not built" tone="bad" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        {path !== "bulk" && (
          <>
            <SectionCard title="Who is it?" caption={chosen?.detail}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={FIELD}>
                  <label htmlFor="in-name" className="text-sm font-medium">Name</label>
                  <Input id="in-name" value={draft.patient_name ?? ""} onChange={(e) => set({ patient_name: e.target.value })} placeholder="As they gave it" />
                </div>
                <div className={FIELD}>
                  <label htmlFor="in-phone" className="text-sm font-medium">Mobile number</label>
                  <Input id="in-phone" inputMode="tel" value={draft.phone_number ?? ""} onChange={(e) => set({ phone_number: e.target.value })} placeholder="9845011223" />
                </div>
                <div className={FIELD}>
                  <label htmlFor="in-disease" className="text-sm font-medium">What are they asking about?</label>
                  <Input id="in-disease" value={draft.disease ?? ""} onChange={(e) => set({ disease: e.target.value })} placeholder="Piles, Hernia, Knee Replacement…" />
                </div>
                <div className={FIELD}>
                  <span className="text-sm font-medium">Branch</span>
                  <div className="flex flex-wrap gap-2">
                    {BRANCHES.map((branch) => (
                      <Button key={branch} size="sm" variant={draft.branch === branch ? "default" : "outline"} onClick={() => set({ branch })}>
                        {branch}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {path !== "walk-in" && (
              <SectionCard
                title="Where did they come from?"
                caption="The MD pays for these. A lead with no source is a lead nobody can trace back to the money that bought it — which is the whole reason campaign spend cannot be judged today."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={FIELD}>
                    <span className="text-sm font-medium">Source</span>
                    <div className="flex flex-wrap gap-2">
                      {CANONICAL_SOURCES.slice(0, 8).map((source) => (
                        <Button key={source.name} size="sm" variant={draft.source === source.name ? "default" : "outline"} onClick={() => set({ source: source.name })}>
                          {source.name}
                        </Button>
                      ))}
                    </div>
                    {draft.source && (
                      <p className="text-xs text-muted-foreground">{`Platform: ${platformFor(draft.source)} — filled in from the source, not asked for twice.`}</p>
                    )}
                  </div>
                  <div className={FIELD}>
                    <label htmlFor="in-campaign" className="text-sm font-medium">Campaign</label>
                    <Input id="in-campaign" value={draft.campaign ?? ""} onChange={(e) => set({ campaign: e.target.value })} placeholder="Piles — Jayanagar — Aug" />
                  </div>
                  <div className={FIELD}>
                    <label htmlFor="in-landing" className="text-sm font-medium">Landing page or form</label>
                    <Input id="in-landing" value={draft.landing_page ?? ""} onChange={(e) => set({ landing_page: e.target.value })} placeholder="/piles-consultation" />
                  </div>
                </div>
              </SectionCard>
            )}

            {duplicates.strong.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-semibold">That number is already in the system</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {duplicates.strong.map((lead) => (
                      <li key={lead.id}>
                        <button type="button" className="text-primary underline" onClick={() => navigate(`/leads/${lead.id}`)}>
                          {`${lead.patient_name} · ${lead.disease} · with ${lead.agent_name ?? "nobody"}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Open the one that exists and add to it. A second record means two agents ring the
                    same patient about the same thing, which is how a hospital loses a lead it had
                    already won.
                  </p>
                </div>
              </div>
            )}

            {duplicates.weak.length > 0 && !duplicates.blocking && (
              <p className="text-xs text-muted-foreground">
                {`${duplicates.weak.length} lead(s) share this name and condition on a different number. Worth a look, not a block — in a hospital this size that is a Tuesday.`}
              </p>
            )}

            <SectionCard title="Who gets it" caption="The same routing rules the assignment board uses, so a lead lands where the board would have sent it.">
              <p className="text-sm font-semibold">{assignment.agent_name ?? "Nobody available"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{assignment.because}</p>
            </SectionCard>

            {touched && problems.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>· {problem}</li>
                ))}
              </ul>
            )}

            <div className="card-surface flex flex-wrap items-center gap-3 p-4">
              <Button onClick={saveOne} disabled={!ready}>
                <UserPlus className="h-5 w-5" />
                Add and open the lead
              </Button>
              <p className="text-xs text-muted-foreground">
                {ready
                  ? "The five-minute first-call clock starts the moment this is saved."
                  : `${problems.length + (duplicates.blocking ? 1 : 0)} thing(s) outstanding.`}
              </p>
            </div>
          </>
        )}

        {path === "bulk" && (
          <>
            <SectionCard
              title="Choose the sheet"
              caption="An .xlsx straight from Excel, or a .csv. The first sheet is read. Nothing is uploaded anywhere — the file is opened in this browser."
              control={
                fileName && (
                  <Button size="sm" variant="outline" onClick={clearFile}>
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                )
              }
            >
              <label className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-md bg-card px-4 text-sm font-semibold shadow-card active:bg-secondary">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                {fileName ?? `Choose an .xlsx or .csv file`}
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.tsv,.txt"
                  className="sr-only"
                  onChange={(e) => {
                    chooseFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {fileError && (
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  {fileError}
                </p>
              )}
              {fileRows && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {`${fileRows.length} row(s) read from the sheet. Columns are read in order: ${BULK_COLUMNS.join(" · ")}.`}
                </p>
              )}
            </SectionCard>

            <SectionCard
              title={fileRows ? "Or paste instead" : "Or paste the list"}
              caption={`Columns, in order: ${BULK_COLUMNS.join(" · ")}. Tabs or commas. A header row is skipped. Every row goes through the same guard as a typed lead.`}
              control={
                bulkText && (
                  <Button size="sm" variant="outline" onClick={() => setBulkText("")}>
                    Clear
                  </Button>
                )
              }
            >
              <Textarea
                rows={8}
                disabled={Boolean(fileRows)}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Ravi Kumar\t9845011225\tPiles\tMeta Ads\tPiles — Jayanagar — Aug\tJayanagar`}
              />
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ClipboardPaste className="h-4 w-4" />
                {`${parsed.rows.length} row(s) ready · ${parsed.rejected.length} refused`}
              </p>
            </SectionCard>

            {parsed.rejected.length > 0 && (
              <SectionCard
                title="Refused, and why"
                caption="Listed rather than dropped. A row that vanishes silently is a patient nobody ever calls, and nobody ever knows."
              >
                <ul className="space-y-2">
                  {parsed.rejected.map((row) => (
                    <li key={`${row.line}-${row.text}`} className="text-xs">
                      <span className="num font-semibold">{`Line ${row.line}`}</span>
                      <span className="text-muted-foreground">{` — ${row.why}`}</span>
                      <p className="text-placeholder">{row.text}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {parsed.rows.length > 0 && (
              <>
                <DataTable
                  title="Ready to add"
                  caption="Each one already routed by the same rules the assignment board uses."
                  columns={[
                    { key: "patient_name", label: "Name" },
                    { key: "phone_number", label: "Phone" },
                    { key: "disease", label: "Condition" },
                    { key: "source", label: "Source" },
                    { key: "branch", label: "Branch" },
                    { key: "owner", label: "Goes to" },
                    { key: "duplicate", label: "Already here?" },
                  ]}
                  rows={parsed.rows.map((row) => ({
                    ...row,
                    owner: assignmentFor(row, roster).agent_name ?? "—",
                    duplicate: findDuplicates(row, leads).blocking ? "Yes — same number" : "No",
                  }))}
                />
                <div className="card-surface flex flex-wrap items-center gap-3 p-4">
                  <Button onClick={saveBulk}>
                    <UserPlus className="h-5 w-5" />
                    {`Add ${parsed.rows.length} lead(s)`}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    They land at the top of the queue, uncalled, with the clock running on each.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
