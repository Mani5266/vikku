# app — React application over the implementation code

A runnable React app for the code in [`../implementation`](../implementation/README.md). The 48-hour
communication engine and the seven-part structured remark are not re-created here — they are imported
from `implementation/` and driven by real screens against seeded data.

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm test         # 12 suites — 268 checks — then 78 server-rendered routes
npm run build    # production bundle in app/dist
```

## Single source of truth

`vite.config.js` aliases the two shipped files to `implementation/`, so the app cannot drift from what
gets pushed to Base44:

| Import in the app | Resolves to |
|-------------------|-------------|
| `@/lib/communicationEngine` | `implementation/src/lib/communicationEngine.js` |
| `@/components/shared/StructuredRemark` | `implementation/src/components/shared/StructuredRemark.jsx` |
| everything else under `@/` | `app/src/` |

`implementation/` has no `node_modules` of its own, so `react` and `lucide-react` are aliased into this
app's install. Both files keep the `@/` import style of the client's `trh-crm` repo — copying them into
the Base44 app stays a copy, not a rewrite.

The two libraries those files import — `followupProtocols.js` and `reasonTaxonomy.js` — exist here as
`app/src/lib/`, mirroring the real ones in the client's app. They are the app's versions, not new
specification; the four protocols come from
[`reference/lifecycle-and-plans.md`](../reference/lifecycle-and-plans.md) and the taxonomy from
[`reference/reason-codes.md`](../reference/reason-codes.md).

## Screens

Grouped as the client asked for them: one screen an agent works in, one a manager monitors from,
one leadership decides from.

**Agent**

| Route | Screen | What it enforces |
|-------|--------|------------------|
| `/` | [A1 My Leads](../screens/01-agent-screens.md#a1-my-leads) | The queue, with `canSendMessage()` already evaluated per row. Call is never gated — Section 8 governs messages only |
| `/tasks` | [A7 Daily Tasks](../screens/01-agent-screens.md#a7-daily-tasks) | The 5-minute first-touch clock, and the protocol's calls as mandatory duties the agent cannot remove from the list |
| `/leads/:id` | [A2 Lead Detail](../screens/01-agent-screens.md#a2-lead-detail-360-view) | Append-only activity history, protocol rail, next-allowed-send rail, suppressions on the lead |
| `/leads/:id/call` | [A3 New Call](../screens/01-agent-screens.md#a3-new-call--call-logging) | Save gated on `isRemarkComplete()`. Not-connected calls take the Section 15 retry path instead |
| `/leads/:id/compose` | [A6 Communication Composer](../screens/01-agent-screens.md#a6-communication-composer) | The 48-hour floor, channel rotation, template reuse, Cold-lead content blocks, the four hard stops, manager exception with audit |

**Manager**

| Route | Screen | What it enforces |
|-------|--------|------------------|
| `/manager` | [M1 Manager Dashboard](../screens/02-manager-screens.md#m1-manager-dashboard) | The funnel by source, campaign, agent, disease, temperature or branch; the touch-time table; follow-up compliance per agent; and the qualification audit — agent temperature against what the transcript supports |
| `/daily` | [M2 Daily Conversion Monitor](../screens/02-manager-screens.md#m2-daily-conversion-monitor) | Eleven metrics against their own trailing 7-day and 30-day averages, and a stage strip toned on the *gap* against normal rather than on the raw share. The reporting day is the last complete one — a part-day looks identical to a collapse, and calling it one every morning is how a dashboard stops being read |
| `/funnel` | [M3 Funnel Dashboard](../screens/02-manager-screens.md#m3-funnel-dashboard) | The eleven §26 transitions with entry population, rate and drop, sliceable by eight dimensions; the three recovery rates; and every drop bucket clickable down to the leads with their reasons |
| `/compliance` | [M4 Follow-up Compliance](../screens/02-manager-screens.md#m4-follow-up-compliance--overdue-queue) | Six severity bands, each lead in exactly one. §28's guard is the screen's spine: touches nobody made and messages the platform failed to deliver are counted separately, on every row and every rollup, and are never added together into one number |
| `/assign` | [M5 Assignment Board](../screens/02-manager-screens.md#m5-unassigned--assignment-board) | Leads that arrived and were never touched, oldest first, each naming the routing rule that should have caught it. Assignment into a full queue is refused, and taking a lead off another agent needs a reason that goes to the audit log |
| `/scorecard` | [M6 Agent Scorecard](../screens/02-manager-screens.md#m6-agent-scorecard) | §28's two columns kept apart — outcome performance, the lead mix each agent was handed, then process compliance including qualification accuracy and remark completeness |
| `/team` | [M7 Team](../screens/02-manager-screens.md#m7-team) | Roster, capacity and coverage, with configuration and measured load labelled apart. Somebody on leave still shows the leads nobody is working, and deactivating a person who holds open leads is refused until they move |
| `/escalations` | [M8 Escalation & Objection Desk](../screens/02-manager-screens.md#m8-escalation--objection-desk) | The six §24 objections with their owner and prescribed action — plus the pool §33 was written about: leads closed for an objection that had a named owner and never reached them |
| `/performance` | [M9 Communication Performance](../screens/02-manager-screens.md#m9-communication-performance) | `communicationStats()` — delivery, read, reply, fatigue by touch count, and the 48-hour compliance rate |
| `/vikku` | **M10 Vikku AI** (not in the original spec — added on request) | Opens on a microphone and nothing else. The manager asks out loud (or types, where a browser has no speech recognition) and the answer arrives in the client's own Excel format. Any question comes back in the client's own Excel format: date-range banner, one block per disease, one row per source, subtotal per disease with the sheet's own green / pink / red cells. Windows accept `last week`, `last 30 days` or an explicit `01-08-2026 to 07-08-2026`; rows switch to agent, campaign or branch on request |

**Leadership**

| Route | Screen | What it enforces |
|-------|--------|------------------|
| `/founder` | [L1 Founder Dashboard](../screens/03-leadership-screens.md#l1-founder-dashboard) | The five questions of [§2](../docs/THESIS.md#2-business-problem-the-crm-must-solve), each answered from the record — plus the "should we buy more leads?" panel, which shows the recoverable pool and the current leak *before* anything about volume, enforcing §35's *No Additional Ad Spend Before Funnel Diagnosis* as screen ordering |
| `/roi` | [L2 Source & Campaign ROI](../screens/03-leadership-screens.md#l2-source--campaign-roi) | Spend, cost per lead, cost per appointment, **cost per surgery** (the default sort), revenue and return, with the seven §5 questions as pre-built views — and the lead-quality-against-execution split that must be read before calling a campaign broken |
| `/cohorts` | [L3 Cohort Comparison](../screens/03-leadership-screens.md#l3-cohort-comparison) | The §22 factor table per treatment category, each rate carrying the population it is computed over, both cohorts' source mixes printed above it, and the two generated pattern narratives with lead counts |
| `/drill` | [L5 Drill-Down Explorer](../screens/03-leadership-screens.md#l5-drill-down-explorer) | The nine §25 levels as a breadcrumb, each rung ranked by how much of the change against the previous period it explains, ending in the §33 conclusion block over the leads in scope |
| `/report` | [L6 15-Day Diagnostic Report](../screens/03-leadership-screens.md#l6-15-day-diagnostic-report) | §32 exactly: Week 1, Week 2, the fifteen-day total, both questions answered per window, and the seven mandatory conclusion fields |
| `/ask` | [L7 Reports Library](../screens/03-leadership-screens.md#l7-reports-library) | One bar, typed or spoken. Returns a plain table that downloads as a spreadsheet, and shows how the question was read |

**Operations**

| Route | Screen | What it enforces |
|-------|--------|------------------|
| `/appointments` | [O1 Appointment & No-show Board](../screens/04-operations-screens.md#o1-appointment-calendar--no-show-board) | The confirmation, no-show and arrival boards, and the number that settles the argument: how many people who did not turn up had never received the reminder sequence. The calendar itself is not here — there is no appointment time in the data model, and inventing slot times is the one thing a front desk catches in thirty seconds |
| `/counseling` | [O2 Financial Counseling Desk](../screens/04-operations-screens.md#o2-financial-counseling-desk) | The §33 guard, refusing in both directions: no price closure on a patient nobody counseled, and no "counseling not completed" on a patient who was. Coverage is reported as process compliance, never as an outcome number |
| `/recovery` | [O4 Recovery & Reactivation Console](../screens/04-operations-screens.md#o4-recovery--reactivation-console) | The four §19 segments with gross recoverable value, the five recovery campaigns, the 90-day pool — and §20's exclusion list enforced rather than described: there is no override control because the library exposes no way to add an excluded lead |

**Administration**

| Route | Screen | What it enforces |
|-------|--------|------------------|
| `/sources` | [S1 Lead Sources & Intake](../screens/05-admin-screens.md#s1-lead-intake--source-configuration) | The seventeen §5 sources, with what the ad platform calls a source folded onto the specification's name. The §3.1 attribution audit is the useful half: two of the five mandatory fields are missing on every lead in the system, which is why leadership can rank a campaign and can never rank a creative |
| `/templates` | [S3 Template Library](../screens/05-admin-screens.md#s3-template-library--approval) | Purpose required to save, approval workflow, the "Are you interested?" lint, price-offer and surgery-push tagging |
| `/audit` | [S5 Audit Log](../screens/05-admin-screens.md#s5-audit-log) | Every cadence override, blocked send and logged call |

## The three requirements the dashboards exist for

The client's objection to their current spreadsheet is not that it lacks columns. It is that a human
fills it in, so an honest number and a wrong one look identical. Three mechanisms answer that:

| Requirement | Where it lives | What it does |
|-------------|----------------|--------------|
| First response inside 5 minutes | [`src/lib/touchTime.js`](src/lib/touchTime.js) | Clock starts when the lead arrives. `touchTimeState()` returns `running`, `breached`, `met` or `late`; a breach raises the alert on both A7 and M1 |
| Scheduled calls are mandatory | [`src/lib/touchTime.js`](src/lib/touchTime.js) | `dutiesFor()` reads the activated protocol and emits the day's call as a duty. Logging *Not Connected* is a valid outcome; forgetting is not one. `callCompliance()` carries missed days forward |
| Qualification is checked, not trusted | [`src/lib/funnel.js`](src/lib/funnel.js) | Each journey carries `temperature` (what the agent typed) next to `ai_temperature` (what the call transcript supports). `temperatureAudit()` reports the disagreement rate and how many leads were graded hotter than the conversation justifies |

The transcript-derived temperature is modelled here, not produced — recording and transcription are the
[AI layer](../docs/AI-LAYER.md), which is not built yet. What is built is the place it lands and every
report that reads it, so wiring Soniox in changes one field's origin and no dashboard.

## The agent screens are written for the agent

The first version of A1 and A7 was written for whoever was reviewing the specification: "Message
guard", "OPTED_OUT", "rotation expects RCS", "Thesis §7, §12–15", "Stage 9", "mandatory". None of
that helps a telecaller making ninety calls a day, and two of the columns changed no decision they
were about to make.

What the agent screens carry now, and what came off them:

| Was | Is |
|-----|-----|
| "Message guard: TOO_SOON, 12h of 48h" | "Message after 36h — calling is fine now, only the message waits" |
| "OPTED_OUT" | "Do not message. Patient asked us to stop." |
| "INVALID_NUMBER" | "Number is wrong. Log it and move to the next lead." |
| "CONVERTED — lead follow-up templates do not apply" | "Already our patient. No lead messages for this one." |
| Thesis section references on A1 and A7 | Nothing. An agent cannot act on a section number |
| Source, campaign, lifecycle stage, "rotation expects RCS" | Removed. An agent picks no campaign, and the stage number decides nothing here |
| Sorted by nothing visible | Sorted by what to do next: never-called first, then calls owed, then Hot |
| Phone number as plain text | A `tel:` link, on the row and on the next-call card |
| No sight of the last conversation | "What the patient said last time", with the worry they raised |
| No personal numbers | Calls logged today, waiting for a first call, calls owed from earlier days, appointments booked |

Three defects surfaced by reading the screen as an agent rather than as a reviewer, all fixed:

- The queue told the agent to cold-call a patient who had already had surgery, because the
  first-touch clock was checked before the closed states. Closed states now come first.
- It told the agent to call a patient who had asked us to stop. Opt-out now reads "Do not contact"
  and drops to the bottom of the queue.
- Daily Tasks told the agent to keep ringing a number the system already knew was invalid. That duty
  is now "Number is wrong — log it once".

Red is reserved for a call the agent owes. A message that is merely due is not an emergency, so it
is no longer printed in the same colour as a breached first call.

## Logging a call at the ninetieth call of the day

The seven-part remark is the right record and typing it ninety times is why agents write "will
come" — which is the failure the client showed us: three identical remarks in a row, copy-pasted,
useless as evidence. A3 keeps the record and removes the typing.

| Pain | What the screen does now |
|------|--------------------------|
| A dial that never connected still cost a dropdown, an attempt number and two checkboxes | Six one-tap buttons — No answer, Busy, Switched off, Cut the call, Wrong number, Number does not exist. One tap saves the attempt, sets the retry plan, and opens the next lead |
| Two long free-text fields, typed, in English, after a Telugu call | Tappable phrases grouped by what patients actually say (money, time, family, fear, elsewhere), a mic on each field with English / తెలుగు / हिंदी, and the textarea still there for anything else |
| "Call duration (seconds)" was a number the agent had to guess and type | A timer runs from the moment the screen opens and is saved with the call |
| The follow-up time was a datetime field | Presets: in 2 hours · this evening · tomorrow morning · day after · in 3 days · next week |
| Temperature — the agent's main judgement — lived on a different screen | It is on the call screen, four cards, each printing what it commits the agent to: "Hot — puts 3 calls and 3 messages on your list over 5 days" |
| Saving dumped the agent on the lead page, and the queue had to be re-found | "Save and call {next patient}" chains straight into the next call; "Save and stay here" is the second option |
| Missing pieces only appeared after pressing Save | Named before the tap, and the button says Ready to save when it is |

A full remark now takes six taps: a patient phrase, an explanation phrase, the objection, the next
action, when, and the temperature. Verified in the browser — six clicks, and the save button
enables with nothing outstanding.

The full seven-part form is still on the screen, collapsed, writing into the same object and
validated by the same `isRemarkComplete()` that ships to Base44. The chips remove typing, never the
requirement.

`test/agent.test.mjs` checks the fast path writes acceptable data: every next-action chip maps to a
value the shipped entity enum accepts (parsed out of the real `StructuredRemark.jsx`, so it moves
when Base44's enum moves), every quick objection exists in the §23 taxonomy and resolves to a
recoverability and an action, every temperature is a protocol the scheduler knows and its promise
matches what that protocol actually schedules, and every phrase clears the remark gate's minimum
length on its own. That test already caught one real bug: the friendly labels — "Book appointment",
"Doctor should call" — were being written into `next_action` verbatim, where the entity enum expects
"Appointment" and "Doctor Callback".

## The one screen that runs on their real numbers

Every other screen in this app computes from `src/store/journeys.js` — 1,500 generated journeys.
**Weekly Sheet Diagnosis** does not. It takes the hospital's own weekly Excel export, pasted
straight out of the sheet, and says what those fifteen columns structurally cannot.

Their real week, 01-08-2026 to 07-08-2026: 282 leads, 270 connected, 60 reached OPD, 24 admitted,
and **222 sitting in a Pending Follow-up column they colour red themselves** — 79% of everything
that came in. The sheet has no reason column and no agent column, and `PERSENTAGE` reads 100% on
every single row, so the widest column on the page carries no information at all.

The screen exists because it is the only artifact that can be shown in a meeting without the words
"this is sample data", and because nobody has to change how they work for it to be useful.

What it does:

- **Parses the sheet as it actually arrives.** Merged disease cells (the name appears once per
  block and the rows below it are blank), thousands separators, percent signs, subtotal rows.
- **Checks itself against their own subtotals.** `test/sheet.test.mjs` asserts the parser's
  per-block totals equal the numbers the hospital typed by hand — 172/49/17/44 leads,
  139/39/13/31 pending. If those ever disagree, one of us is wrong, and it is worth knowing before
  the meeting rather than during it.
- **Reports contradictions rather than correcting them.** Connected greater than leads, admissions
  greater than OPD visits — flagged, never silently fixed. A tool that quietly repairs their
  arithmetic is a tool they stop trusting the moment they notice.
- **Refuses to invent a reason.** The sheet has no reason column, so every "why" comes back as
  unknown. Guessing is the exact failure this whole product exists to remove.
- **Prints no rupee figure until package values are entered by hand.** Guessing a hospital's
  package prices and then showing a total to their MD is how a meeting ends early.

The "what this sheet cannot tell you" list is the argument for the closure screen: five facts about
the columns, each with the one field that would fix it.

## What an agent actually does

The whole job, in the order it happens. If a screen is not in this list, an agent never opens it.

**1. Sign in. Land on Today.** One home, and it is the only one. There used to be two — My Leads and
Daily Tasks — showing the same leads in the same order with different words on them, so the agent's
first decision every morning was *which of my two lists*. That is a decision the software should
make. `/` and `/tasks` now render the same screen.

**2. Read the top card: Start here.** One patient, one instruction, one phone button. An agent
should never have to choose where to begin, and the top of the list is always the lead that costs
the most money to leave alone.

**3. Work down the list.** Grouped by urgency, never by temperature — Hot / Warm / Cold is how a
*manager* slices a pipeline; *who do I ring first* is what an agent needs at 9am. Each group states
its own reason:

| Group | What is in it | Why it is above the next one |
|-------|---------------|------------------------------|
| **Ring now** | Nobody has called them at all | The 5-minute clock is running or already blown. A lead that is never rung reaches the manager's screen as a missed lead, not as a busy day |
| **Behind** | Calls earlier days asked for and nobody logged | They stay until logged. Not answering counts; forgetting does not |
| **Due today** | What the plan asks for today | The plan was chosen by the grade, not by the agent |
| **Waiting** | Inside their plan, nothing due | Visible so the agent can see the whole book, not only the fires |
| **Finished** | Booked, seen, or closed with a reason | Collapsed. Off the working list |

**4. Press the one button on the row.** Every row carries a single action, and it is the same
instruction the lead's own screen shows, so the queue and the lead never disagree. The agent does
not pick a screen — the button opens the right one:

| What the button says | Where it goes | When |
|----------------------|---------------|------|
| Answer the eleven questions | Qualify | The lead has never been graded — nothing can be scheduled until it is |
| Log a call | Log a call | The plan has a call due |
| Send the message | Send a message | Only when the 48-hour floor and the guards allow it. Otherwise the row says why not |
| Log the wrong number | Log a call | The number is dead. Ringing it again wastes the only thing an agent is short of |
| Log the recovery call | Log a call | They did not turn up. A no-show is worth about a day |
| Book the slot | Appointment | A slot was suggested and never booked — a suggestion is not an appointment |
| Update the appointment | Appointment | Something is booked and needs confirming, or what happened needs recording |
| Close this lead | Close a lead | The plan ran out and there is nothing left to try |

**5. That is the entire job.** Qualify, call, log, message when allowed, book, and close with a
reason. Six verbs, one list, one button at a time.

### Where the money is in that loop

Each rule on this screen maps to a number the client already loses:

- **Ring now first** — the five-minute SLA. Leads contacted inside five minutes convert at roughly
  three times the rate of leads contacted after twelve hours, and the funnel screen proves it on
  their own data.
- **Behind never clears itself** — a missed follow-up is the single largest non-conversion category
  in the 90-day set. A backlog that disappears from the screen disappears from the revenue.
- **One button, not a menu** — the agent's scarce resource is call time, not screen time.
- **The remark and the grade are on the call screen** — the fake-remark problem the client opened
  with exists because writing a real one used to cost more than the call did.
- **Nothing closes without a reason and evidence** — a lead closed as "expired" is a lead nobody can
  reactivate, and the recovery console is where the recoverable pool is worth real money.

## The flow a lead moves through

The app was built screen by screen, each correct on its own, and the result read as a pile: screens
labelled `A6` and `M10`, reachable from several places, with nothing on screen saying where a lead
was or what came next. Two things fixed that, and both are enforced rather than described.

**Screen codes are gone from the interface.** `A6` is the specification's name for a thing, not a
step in anybody's day, and rendering it made a product read as a document. The codes stay in the
code, the tests and `screens/` — where they are useful — and `SCREEN_NAMES` in
[`src/lib/rbac.js`](src/lib/rbac.js) maps each one to what a person calls it. The refusal screen now
says *the Manager Dashboard screen is outside that role*, and the render test asserts no code leaks
back in.

**A lead has four stages, and they are on every screen that belongs to a lead.**

```
1 Qualify  →  2 Work the plan  →  3 Appointment  →  4 Outcome
  how interested   the calls and       in front of      they came, or it
  are they?        messages it         the doctor       closes with a reason
                   schedules
```

Each stage reads **Done**, **You are here**, **Later** or **Not yet**, and carries the fact behind
that word — *Graded Hot*, *Hot plan running*, *Nothing booked*, *Closed — Chose another hospital*. A
locked stage says what has to happen first rather than only refusing: a plan before a grade is a
schedule nobody chose.

Sending a message is deliberately **not** a stage. It is something done while working the plan,
which is exactly why it used to appear out of nowhere: it had its own nav-level identity and no
stated relationship to anything. The screen is now called *Send a message*, sits inside stage 2, and
its subtitle says so.

Above the stage bar, every lead screen carries **one instruction** —
[`nextStep()`](src/lib/journey.js) — with one sentence saying what to do, one saying why, and one
button. It is the thing an agent at their ninetieth call actually reads, and it knows the difference
between a lead that needs grading, a plan with a call due, a suggested slot that was never booked, a
no-show worth chasing today, and a closed lead that needs nothing. When a message is blocked it
names the guard: *A message cannot go yet — Patient has opted out of communication.*

## The four screens that stop a number being invented

A1, A3, A6 and A7 make an agent's day workable. These four make the record checkable, and each one
exists to close a specific hole the client already showed us.

### A4 Qualification & Scoring — the temperature stops being a feeling

Eleven §7 factors, three answers each, and the classification falls out of the answers rather than
out of a mood. The screen shows *which* Hot, Warm and Cold indicators matched, not only a total.

Two rules carry the design:

- **Ties break cooler.** Five Hot indicators against five Warm suggests **Warm**. Grading a split
  decision Hot is exactly the over-grading M6's qualification audit already catches, so the
  arithmetic refuses to do it. (This was wrong in the first cut — the tie-break picked the hottest
  band, and `test/screens.test.mjs` caught it before it shipped.)
- **Overriding is allowed, overriding silently is not.** An agent may grade against the answers —
  a patient's tone carries what eleven questions do not — but it costs a written justification and
  is written to the audit log as an override.

Saving activates the matching protocol. No agent hand-builds a schedule.

### A5 Follow-up Update — the whole plan, not just today

A7 answers *what do I do now*. A5 answers *was the plan followed*, which is the question the manager
asks and nothing could previously show. Every scheduled day of the protocol is a row: what was
supposed to happen, what did, and — when a day was moved — why.

A day counts as called when a call was **logged inside that day's window**. Nothing reads the lead's
status, because a status can be typed and a logged call has a timestamp on it. A missed Day 3 still
reads *missed* on Day 5; the follow-ups nobody made are precisely the ones nobody could see.

At the end of a Warm plan the screen forces one of §13's ten outcomes. A lead may not sit in a
generic "follow-up" status — that is how 259 leads end up Pending forever.

### A8 Appointment Booking — the screen every dashboard was already counting

The ten §17 states are enforced as a machine, not offered as a dropdown: only the states reachable
from the current one are enabled, so nobody records a Consultation Completed on a lead that was
never booked. Cancel and no-show cost a reason, because §3.3 applies to closure-adjacent events too.
A no-show raises a recovery call for the next day and puts the lead in the no-show segment rather
than ending it.

Booking suppresses routine follow-up messaging and switches the lead onto the four-step reminder
sequence — confirmation call, appointment card, day-before, morning-of — each shown with its send
time before the tap.

### A9 Non-Conversion Reason Capture — the screen the product is arguing for

"Lead Expired" is an operational status wearing a business reason's clothes: it says the clock ran
out, not why nobody bought. All eight §23 fields are mandatory here, and **one of them cannot be
typed at all**.

`evidence_source` is a picker built from this lead's real calls, messages and appointment record. A
closure that cites nothing is the same unfalsifiable claim as a copy-pasted remark, so:

- citing a record that is not on the lead is refused;
- a lead with no logged activity **cannot be closed** — the screen says there is nothing to cite and
  sends the agent to log the call first, rather than offering a blank dropdown;
- `Recoverable = Yes` requires an action, an owner and a review date in the future;
- `Recoverable = No` sets Genuine Lost and excludes the lead from the 90-day pool — enforced, not
  described;
- a competition loss must name the hospital.

All four are reached from the lead's **What to do with this lead** card, and each is its own screen
code, so an agent role that owns A2 does not automatically own A9 — `screenForPath()` reads the URL
suffix because the lead id sits in the middle of the path.

## Roles and access

Five roles, one screen group each. A role opens its own screens and nothing else — an agent
cannot open the scorecard that ranks them, a manager cannot open the founder's revenue screens,
and leadership does not work a lead queue.

| Role | Username | Password | Screens | Data scope |
|------|----------|----------|---------|------------|
| Agent | `agent123` | `agent123` | A1 · A2 · A3 · A6 · A7 | Own leads only |
| Agent (second seat) | `sneha123` | `sneha123` | A1 · A2 · A3 · A6 · A7 | Own leads only |
| Manager | `manager123` | `manager123` | M1 · M3 · M6 · M9 · M10 | Whole team |
| Leadership | `leadership123` | `leadership123` | L1 · L2 · L3 · L5 · L6 · L7 | Everything |
| Operations | `operations123` | `operations123` | O4 | Whole team |
| Administration | `admin123` | `admin123` | S3 · S5 | Everything |

The second agent seat exists so scoping is demonstrable: sign in as one agent and the other
agent's queue is not there. Signing in lands on that role's own home — `/manager` for the
manager, `/founder` for leadership — never on a locked door.

The sign-in screen is one landing page in two steps. Step one asks **who is signing in** — a card
per role, carrying its description, screen count and how many demo seats it has. Step two shows the
form with **only the picked role's credentials** under it; the other five roles' passwords are never
on screen. Picking a role fills the form, and tapping a credential row refills it, but the typed
values still go through `signIn`, so the path being demonstrated is the real one and a wrong
password is a designed failure branch rather than an alert box.

Showing every account on the landing page was the earlier design. It was wrong twice: a reviewer had
to read six rows to find their one, and every role's password sat on a screen anybody could open —
which is not how the real thing behaves.

Two layers, because one is not enough:

1. **Route access** — [`canOpenScreen()`](src/lib/rbac.js) decides whether a role may open a
   screen at all. The nav renders only the role's own group, and the route guard refuses
   anything else with a designed refusal that names the owning screen and offers a way back.
2. **Data scope** — [`scopeRows()`](src/lib/rbac.js) narrows what a permitted screen may show.
   An agent's queue and daily tasks are their own leads; `canOpenLead()` then refuses another
   agent's lead even though the agent owns the screen. Without this, hiding the manager's
   screens would be theatre: the agent screens would still carry the whole team's pipeline.

Sessions resolve in one order: `?as=<username>` on the URL, then the last signed-in username from
`localStorage`, then nobody — which lands on the sign-in screen. The `?as=` form skips the password
on purpose: it is how a demo link is shared and how the render test signs in.

The access rules are tested as claims rather than asserted in prose. `test/rbac.test.mjs` runs the
whole matrix under plain Node — every credential pair, every role against every screen code, the
scoping, lead ownership, the fact that each role's home is a screen that role can actually open, and
that every role offered on the picker has a working account behind it. The render test adds must-not-contain expectations, so `/?as=sneha123` proves Nikhil's leads
are absent from her queue and each role's nav is checked for the doors it must not show.

**This is an interface boundary, not a security boundary.** Passwords are plain text in
`src/lib/rbac.js` and compared in the browser; every rule here runs in the browser.
Before real patient data reaches this app the same map has to be enforced on the server — a
hidden screen is not a protected screen, and the sign-in screen says so out loud.

## Interface

Light only, and built to one rulebook rather than to taste. The decisions, and the rule each
one answers:

| Decision | What ships |
|----------|-----------|
| Brand colour | One: `#5438FA`, sampled off the reference board's own sidebar fill. It appears on primary actions, links, active states and chart marks, and almost nowhere else |
| Neutrals | Opacity steps of a single hex, `#171725` — 5% subtle surfaces, 12% dividers, 45% placeholders, 60% secondary text, 100% headings. No invented greys |
| Semantic colour | Only where it carries meaning: green a figure that beat its benchmark, red a breach or a fired guard, amber something pending. Status tags stay neutral |
| Reserved accent | `#EFA93E`, available as the `accent` badge for one highlight per screen. Never a button fill — white text on it fails 4.5:1 |
| Surfaces | Two treatments app-wide: white cards and one soft shadow (`y2/blur4`, `y4/blur8` raised), on the reference's lavender-white page base `#F8F7FD`. No strokes on containers |
| Dividers | One value, the 12% step, used only inside data tables — fifteen columns of figures cannot be read without row separation. That is the single exception, and it is the same divider everywhere |
| Type | Inter, and only Inter. The reference board sets tables in the same grotesque as its prose, so figures are Inter with `tabular-nums` rather than a second family. Bundled through `@fontsource` — a hospital network is not something a dashboard should depend on |
| Type scale | 16px base, 140% line height, scale 24 / 20 / 16 / 14 / 12. Nothing below 12px, no step wider than 4px |
| Hierarchy | Two levers per relationship, never three: size plus the 60% opacity step. Placeholders at 45% |
| Spacing | 4pt grid, tiers fixed once at 4 / 8 / 16 / 24 / 48, with the section gap always the largest number on the screen. 16px screen padding, 56px nav bar |
| Controls | 48px tall, 8px radius, one pressed state (the darker brand step). Cards 12px radius, chips fully rounded. Disabled looks disabled |
| Selection | One pattern everywhere — brand tint background with brand-coloured bold text. Nav, filter chips and tabs all use it |
| Icons | One set, 24×24 boxes, 1.5px stroke, and every meaning-carrying icon has a text label beside it |
| Figures | Thousands separated (`1,500`, `₹1,33,61,500`) and tabular so columns align and a changing number does not reflow its row. Standalone values — stat tiles — use proportional figures, because `tabular-nums` makes a lone `121` look gappy at 24px |
| Empty states | Designed, with the next move attached — never bare grey text |
| Vikku AI's sheet | Deliberately outside all of the above. It keeps the client's own grid, borders and three subtotal fills, because it is a replication of their spreadsheet rather than a view of it |

The full system, including the composition taken from the reference board in `design/`, is written
down in [`design/design.md`](../../design/design.md) — including the deviations from that board and
why each one was made.

### Composition

Every dashboard is the same four bands, in this order, and they stack in this order on a phone:

1. **Greeting** — the screen greets the signed-in user by first name and states what it is for.
   Interior screens (drill-down, composer, audit) keep the compact header; a greeting there is noise.
2. **Stat row** — four tiles. Label, value, a delta that names its window, then the detail the value
   is made of. The delta's colour is direction × whether up is good, which is why a rising
   cost-per-surgery is red and a falling missed-follow-up count is green.
3. **Chart band** — two thirds and one third.
4. **Tables** — every number in the band above appears in a table below it, downloadable. A picture
   is never the only copy of a figure on this product.

### Charts

Four forms, no charting dependency, all server-renderable
([`src/components/shared/charts.jsx`](src/components/shared/charts.jsx)):

| Form | The job it does | Where |
|------|-----------------|-------|
| Area line | change over time, one series | leads and admissions per day |
| Donut | share of a whole, six slices at most | lead source distribution |
| Bar list | magnitude across names | the transitions losing the most leads |
| Funnel | an ordered sequence that only shrinks | lead → connected → quality → OPD → admitted |

The palette is a single ordinal ramp of the brand hue, six steps
([`src/lib/chartPalette.js`](src/lib/chartPalette.js)), validated with the dataviz validator rather
than eyeballed — monotone lightness, adjacent ΔL ≥ 0.06, light end at 2.07:1 on white, hue spread 16°.
A slice's step is fixed to its **name**, not its rank, so filtering a board never repaints the slices
that survived, and a seventh category folds into "Other" rather than inventing a colour.

Skeleton loaders are not built: every screen computes from an in-memory dataset, so there is
no fetch to cover. They become necessary the moment the store is a real API.

## Reports

Every table on the manager and leadership screens is the same component,
[`DataTable`](src/components/shared/DataTable.jsx): plain rules, no fills, no colour coding, and a
**Download** button that writes the columns and rows being rendered to CSV with a UTF-8 BOM so Excel
opens it correctly. The screen and the file cannot disagree, because they are the same array.

`/ask` parses questions with a keyword grammar in [`src/lib/queryEngine.js`](src/lib/queryEngine.js) —
deliberately not a model call. It prints how it read the question (report type, grouping, date window,
every filter) above the answer, so a wrong table is visibly a misread question rather than a black box.
Six report types are reachable: funnel by any dimension, non-conversion reasons, touch-time bands, the
qualification audit, agent scorecards, and a lead-level export. When the AI layer is wired up it
replaces `parseQuestion` and nothing else; `runQuery` and the metric library stay, so the numbers cannot
move when the parser changes.

## Seed data

The store ships **45 leads**: the nine in [`src/store/seed.js`](src/store/seed.js), each of which
exists to make one communication guard reachable, and thirty-six in
[`src/store/seedExtra.js`](src/store/seedExtra.js) that make the product demonstrable.

The split matters. The original nine were a good fixture and a poor demonstration — signing in as
an agent showed five leads, four of them edge cases, and nothing resembling a day's work. The desk
now opens on 23 leads for `agent123` and 15 for `sneha123`, spread across all five Today buckets:

| Bucket | `agent123` | What it demonstrates |
|--------|-----------:|----------------------|
| Ring now | 6 | Including one lead still inside the five-minute clock and one 12 days past it |
| Behind | 5 | Missed touches on leads that answered the phone — the number M4 counts |
| Due today | 3 | Plan fully executed, today's call outstanding |
| Waiting | 3 | Quiet days inside a plan, where only the message duty runs |
| Finished | 6 | Booked, seen, or closed with a reason |

Every row carries a `shows` field saying why it is there, and `test/seed.test.mjs` asserts the
coverage rather than trusting the comment: all nine appointment states this file owns, all seven
§23 closure categories with real cited evidence on each, all eight diseases, all seven sources,
both branches, four agents, and every follow-up protocol running somewhere. It also pins the
original nine in place, because a renumbered fixture fails the engine tests in a way that reads as
an engine bug.

Two properties hold throughout: nothing is random, and a lead is never older than the plan day it
claims to be on — a lead created four hours ago cannot be showing a nine-day backlog.



`src/store/seed.js` exists to make each guard reachable from the UI:

| Lead | Demonstrates |
|------|--------------|
| Priya Sharma | Clear to send — last touch 60h ago on WhatsApp, rotation offers RCS |
| Ramesh Kumar | `TOO_SOON` at 12h of 48h, with the manager exception path available |
| Anita Desai | Cold lead — price-offer and surgery-push templates are blocked; RCS unsupported, so MMS is the fallback rung |
| Suresh Reddy | `SUPPRESSED` — appointment booked mid-plan, with the suppressed row kept as evidence |
| Mohan Rao | `OPTED_OUT` hard stop, no override |
| Fatima Sheikh | No history yet — first touch is WhatsApp |
| Vikram Nair | `CONVERTED` — lead follow-up templates no longer apply |
| Lakshmi Iyer | A full compliant sequence plus one failed send, which is what M9 reports on |
| Gopal Menon | `INVALID_NUMBER` hard stop |

State lives in memory and persists to `localStorage`. **Reset demo data** in the sidebar restores the
seed, which also re-bases the timestamps on the current time.

## Store

`src/store/store.jsx` stands in for the Base44 SDK. Entity shapes match
`implementation/base44/entities/*.jsonc`, so replacing it with `import { Communication } from "@/api/entities"`
is a per-call change rather than a restructure. Blocked sends are written as `suppressed: true` rows with a
reason — a suppression is evidence that a guard fired, not a dropped message.

## Tests

```bash
npm run test:engine    # implementation/test/communicationEngine.test.mjs — 23 checks
npm run test:rbac      # test/rbac.test.mjs — 15 access checks over the whole role matrix
npm run test:agent     # test/agent.test.mjs — 12 checks that the call fast path writes valid data
npm run test:screens   # test/screens.test.mjs — 36 checks on qualification, plans, appointments, closure and the stage flow
npm run test:ops       # test/operations.test.mjs — 57 checks on the eight manager, operations and admin screens
npm run test:seed      # test/seed.test.mjs — 24 checks on what the demo desk claims to cover
npm run test:treatment # test/treatment.test.mjs — 20 checks on the half of the funnel after the consultation
npm run test:intake    # test/intake.test.mjs — 26 checks on the mouth of the funnel and the §3.1 write guard
npm run test:xlsx      # test/xlsx.test.mjs — 17 checks on the spreadsheet reader, against real .xlsx archives
npm run test:transcript # test/transcript.test.mjs — 12 checks on the live-transcript token and audio handling
npm run test:sheet     # test/sheet.test.mjs — 14 checks against the hospital's real weekly export
npm run test:design    # test/design.test.mjs — 12 checks on the chart palette and trend arithmetic
npm run test:render    # server-renders all 78 routes and asserts on their content
```

`test:design` enforces the claims `design/design.md` makes: the ramp stays at six steps, a slice
keeps its colour when the board is filtered, a percentage change against an empty previous window
comes back `null` rather than "+100%", and no hand-written CSS class collides with a Tailwind
colour utility. That last one is a scar — `.text-secondary` was defined as the 60% ink step, but
Tailwind generates `text-secondary` from the `secondary` colour token and utilities sort after
components, so the chart legend was painting near-white text on a white card and the percentages
were invisible on screen while being present in the DOM.

The render test builds an SSR bundle of the real pages and asserts that, for example, the composer for
Ramesh Kumar shows `TOO SOON` and offers the manager exception, that Mohan Rao's shows the opt-out hard
stop, that A7 raises the SLA breach for Fatima Sheikh, that the §25 ladder starts at level 1, and that `/ask`
prints the interpretation of its default question. A change that breaks a guard path fails there rather than in the browser. No test
framework is installed, and neither test adds one.

## Analytics data

`src/store/journeys.js` generates 1,500 finished journeys across 90 days — around 500 leads a month
against the client's stated 2,500 to 3,000. It is a seeded LCG, so the dataset is identical on every
build: a figure on the founder dashboard traces to a row in the drill-down, and the render test can
assert on it.

Each journey is carried through the whole of §4 and §17 — contact, qualification, follow-up execution,
appointment, confirmations, no-show, visit, consultation, surgery advice, financial counseling,
insurance, quoted package, booking, admission, revenue — and then through §18–20: closure reason,
segment, review date, reactivation eligibility and recovery outcome. That is what lets the funnel be
eleven transitions rather than five, and lets a lost lead carry a value.

A lead settles when its own protocol runs out, not on a flat calendar rule: a Hot plan is seven days and
a Not Connected plan five, so those close inside a fortnight, which is what gives the §32 fifteen-day
report something to diagnose. A Cold plan runs a month and legitimately stays open longer.

The shape is the client's own account of their funnel made measurable, not flattering:

| Figure | Value | Why it is that number |
|--------|-------|----------------------|
| Leads worked inside the 5-minute SLA | ~22% | the client's own complaint, quantified |
| Follow-up compliance | ~81% | a third of plans lose a scheduled call somewhere |
| Qualification mismatch | ~18% | agents grade hotter than the transcript supports |
| Admissions per 100 leads | ~10 | against the 12 quoted in the requirement conversation |
| Not Connected recovery | ~32% | §6's second chance, partly taken |
| No-show rate | ~20% of booked | falls with each appointment confirmation |

The gap against 12 is the point. [`recommendedActions()`](src/lib/funnel.js) ranks corrective actions by
how many leads sit behind each one, and L1's "should we buy more leads?" panel refuses to discuss volume
until that pool has been read — §35's *No Additional Ad Spend Before Funnel Diagnosis*.

Media spend is separate, in `SOURCE_SPEND` in the same file, because it is configuration rather than
measurement. Every cost-per-surgery figure on L2 is only as honest as that table, so it sits one edit
away instead of buried inside a calculation.

Replacing all of this with real data is a swap of one import. Nothing in the metric libraries knows
where rows came from.

## Metric libraries

Screens hold no arithmetic. Each library takes rows and returns numbers, which is why two screens cannot
disagree about the same fact:

| Library | Owns | Thesis |
|---------|------|--------|
| [`funnel.js`](src/lib/funnel.js) | The eleven stage transitions, touch-time bands, follow-up compliance, qualification audit, loss breakdown, recovery rates, revenue, ranked corrective actions | §7, §16, §17, §19, §24, §26 |
| [`touchTime.js`](src/lib/touchTime.js) | The 5-minute clock, protocol duties, missed-call backlog, the day's task queue | §7, §12–15, §17 |
| [`roi.js`](src/lib/roi.js) | Spend apportionment, cost per lead / connected / appointment / surgery, junk rate, return on spend, the seven §5 views, the quality-against-execution split | §5, §26 |
| [`cohorts.js`](src/lib/cohorts.js) | The §22 factor table with a declared base per factor, source-mix reporting, the two pattern narratives | §21, §22 |
| [`agents.js`](src/lib/agents.js) | Outcome and process compliance as separate groups, lead mix, expected-surgeries normalisation | §28 |
| [`recovery.js`](src/lib/recovery.js) | The four §19 segments with gross value, §20 eligibility as a guard, the recovery campaigns, reason-wise results | §18–20, §30.9 |
| [`diagnosis.js`](src/lib/diagnosis.js) | The nine §25 levels, period comparison, drop attribution, the §33 conclusion, the §32 fifteen-day report | §25, §32, §33 |
| [`queryEngine.js`](src/lib/queryEngine.js) | The keyword grammar behind `/ask` and its six report types | §25, §31 |
| [`vikku.js`](src/lib/vikku.js) | Vikku AI's question parser and the disease-block sheet it always answers in, with the client's own column formulas | §26, §31 |

## The Stitch screen designs, and what was taken from them

Forty-three generated screen designs arrived in four folders — HTML mockups with a rendered PNG
each, plus a shared `DESIGN.md`. They were produced from the same specification this repository
holds, which is why the useful ones are useful: the financial counseling mockup carries a
governance banner reading *"System configuration prevents lead closure for 'Price' without recorded
counseling evidence"*, which is O2's guard, verbatim, from a designer who had read §33.

They were reviewed screen by screen against what already exists here. The verdict split three ways.

**Adopted — the eight screens nobody had built.** M2, M4, M5, M7, M8, O1, O2 and S1 were on this
README's *not started at all* list. The mockups gave each of them a credible composition — the
objection-type strip that doubles as a filter on M8, the agent-then-drill-down structure on M4, the
KPI-and-queue split on O2 — and every one of them is now in the app, computed from the same journey
dataset as the rest, with 57 checks under `test:ops` and eight route assertions under `test:render`.

**Rejected — the agent screens.** The generated agent workspace is a pipeline table beside a
separate task list, which is exactly the shape this app was moved *away* from after the flow was
found to be unreadable: two lists of the same leads in a different order, and choosing between them
was the agent's first decision every morning. `/` is one urgency-ordered list with one button per
row, and taking the mockup would have undone that. The same applies to the auth screens: sign-in is
already a two-step role picker that shows no password until a role is chosen, and the generated
login, OTP and splash screens are all less than that.

**Rejected — the palette.** The Stitch system is a blue one (`#004ac6`) whose written rules
explicitly forbid purple. This app runs the violet system in [`design/design.md`](../../design/design.md),
chosen deliberately from a reference board, with a chart ramp validated for monotone lightness,
adjacent ΔL and light-end contrast. Two design systems cannot both be the design system. The one
thing taken from theirs is confirmation that Inter was the right type choice — both arrived at it
independently.

**Not taken, and worth saying why: the data.** Every mockup is populated with US clinical
placeholders — BlueCross and Medicare, dollar package prices, Cardiology and Oncology, Dr. Jane Doe
listed as a telecaller. This hospital's blocks are Circumcision, Piles, Gynaecology and Varicose
Veins, its packages are in rupees, and its agents are telecallers rather than doctors. The
compositions were reusable; not one figure on them was.

## Not built here

The communication guards cover steps 1 and 2 of the
[build order](../reference/base44-data-model.md#build-order), which is what `implementation/` contains.
Campaign hierarchy, the `Appointment` entity, consultation outcomes and `evidence_ref` on `AuditLog` are
specified in the data model but not implemented there — the journey dataset models those fields so the
reports can be built and checked, which is not the same as the entities existing in Base44.

Twenty-three of the 35 specified screens are here, plus Vikku AI and Weekly Sheet Diagnosis, neither of which is in the specification —
it was asked for directly. Each is **partial against its spec**. What is missing per screen, stated
rather than implied:

| Screen | Built | Specified but not built |
|--------|-------|-------------------------|
| [A7 Daily Tasks](../screens/01-agent-screens.md#a7-daily-tasks) | First-response SLA clock and alert, protocol-scheduled calls as mandatory duties, missed calls rolled forward, message duty with suppression | Sectioned worklist by task type, mark-complete, reschedule-with-reason, escalate, appointment confirmations, doctor callbacks, counseling handoffs |
| [M1 Manager Dashboard](../screens/02-manager-screens.md#m1-manager-dashboard) | Funnel by six dimensions, touch-time table, per-agent compliance, qualification audit, live SLA alerts | The Morning / During the Day / End of Day rhythm of §31, assignment and reassignment, the end-of-day report send, undismissable action acceptance |
| [M3 Funnel Dashboard](../screens/02-manager-screens.md#m3-funnel-dashboard) | Eleven §26 transitions, eight slicing dimensions, the three recovery rates, drop buckets down to leads with their reasons | Two-period and two-segment comparison, and the location / communication-channel dimensions |
| [M6 Agent Scorecard](../screens/02-manager-screens.md#m6-agent-scorecard) | All twenty §28 metrics in two labelled groups, lead mix, expected-surgeries normalisation, team-relative flags | Period comparison, opening the underlying leads per metric, coaching notes |
| [L1 Founder Dashboard](../screens/03-leadership-screens.md#l1-founder-dashboard) | The five questions, the header band with revenue and cost per surgery, the speed-against-compliance cohorts, the buy-more-leads guard, ranked actions | The 20-stage live distribution, period comparison, accept/decline per action with owner and date, board-pack export |
| [L2 Source & Campaign ROI](../screens/03-leadership-screens.md#l2-source--campaign-roi) | Source and campaign rows, the full cost chain, the seven §5 views, cost-per-surgery default sort, the quality-against-execution split | Ad set, creative and landing-page levels, real per-campaign spend, flagging a campaign for correction, export for the ad platform |
| [L3 Cohort Comparison](../screens/03-leadership-screens.md#l3-cohort-comparison) | The §22 factors with declared bases, both cohorts' source mixes, both pattern narratives with counts | Statistical significance, turning a pattern into a process rule (routes to S4), period change |
| [L5 Drill-Down Explorer](../screens/03-leadership-screens.md#l5-drill-down-explorer) | The nine-level ladder with breadcrumb, drop attribution against the previous period, the stage funnel at every rung, the §33 conclusion | Pivoting to another dimension at the same level, saving a conclusion into L6, assigning the corrective action, the evidence-link publish guard |
| [L6 15-Day Diagnostic Report](../screens/03-leadership-screens.md#l6-15-day-diagnostic-report) | The three windows, both §32 questions per window, the seven conclusion fields in §33 format | Editing the narrative, attaching conclusions from L5, publishing, PDF export, and scoring the previous period's expected results against actuals |
| [L7 Reports Library](../screens/03-leadership-screens.md#l7-reports-library) | Six report types over any filter combination, spoken or typed questions, CSV export, printed interpretation of the question | Saved and scheduled reports, subscriptions, a report catalogue |
| M10 Vikku AI | The mic-first opening state, `?q=` deep links, the sheet replicated column for column including its `PERSENTAGE` spelling and two-decimal Op column, keyword parsing of window / dimension / filters, CSV download | A real language model behind `parseAsk` (it is a keyword grammar today), follow-up questions that refer to the previous answer, and saved or scheduled sends |
| [O4 Recovery & Reactivation](../screens/04-operations-screens.md#o4-recovery--reactivation-console) | Four segments with gross value, five campaigns, the 90-day pool, §20 exclusions enforced with every refusal listed | Actually scheduling and launching a campaign, assigning a recovery agent, re-entering a responding lead into A4, retiring a lead with a reason |

Not started at all: L4, O3, S2, S4, S6 — the full inventory is in
[`screens/README.md`](../screens/README.md).

M2, M4, M5, M7, M8, O1, O2 and S1 were in that list until the Stitch screen designs were reviewed
against it. What each of those eight is missing against its own spec, stated rather than implied:

| Screen | Built | Specified but not built |
|--------|-------|-------------------------|
| M2 Daily Conversion Monitor | The eleven §31 metrics against trailing 7-day and 30-day averages, the stage-drop strip against the thirty days behind it, the day's closure reasons, and the part-day guard | Filtering by branch, disease, source and agent, and flagging a metric into the 15-day report |
| M4 Follow-up Compliance | Six severity bands worst-first with each lead in exactly one, the execution-versus-delivery split on every row and every rollup, completion by agent, disease, source and branch | All five queue actions — escalate, reassign, auto-reschedule, coach, bulk-notify — and the missed-touch heatmap by hour and day |
| M5 Assignment Board | The never-touched pool with age, the routing rule that should have matched, escalating SLA bands, agent capacity with a refusal at the cap, and the audit record a reassignment writes | Bulk assign by rule, workload rebalancing, and overriding a routing rule. Assignments are held in the page for the session and are not persisted |
| M7 Team | The roster with configuration and measured load labelled apart, coverage gaps where open leads are actually sitting, and the deactivation guard with cover candidates | Adding or deactivating a user for real, editing skills and routing tags, setting capacity caps, and shift management. There is no user store behind it |
| M8 Escalation & Objection Desk | All six §24 objections with owner and prescribed action, live queues where the data supports one, and the closed-without-the-action pool with its recoverable count and quoted value | Claiming an escalation, opening the matching tool, and the writes behind resolution. Three of the six objections have no live detector because an open lead's objection lives in the call remark, which is the AI layer |
| O1 Appointments & No-shows | The confirmation, no-show and arrival boards, the §17 reminder sequence per appointment, no-show attribution between the hospital and the patient, and reminder count against kept rate | The calendar itself — there is no appointment date or time in the data model, so no slot, no doctor's day and no double-booking check. Cancellations, both sides. Marking somebody arrived |
| O2 Financial Counseling Desk | The six §17 post-consultation states, counseling coverage as process compliance, conversion with and without counseling, insurance and discount effects, and the §33 closure guard in both directions | Logging a session, sending the package comparison, checking insurance, raising a discount request, and booking surgery. The patient's stated budget is not captured anywhere, so the gap cannot be measured |
| S1 Lead Sources & Intake | The seventeen §5 sources with platform aliases folded together, the §3.1 attribution audit with what each missing field blocks, the hierarchy as deep as the data goes, and duplicate detection on both rules | Integrations and their field mapping, editing the registry, the manual entry form, and merging duplicates. Editing the registry and merging duplicates. The §3.1 write-layer guard is now called by every intake path — a typed lead, a pasted block and a chosen spreadsheet all go through it |

A4, A5, A8 and A9 were in that list until the agent group was completed. What is still missing on
them, stated rather than implied: A4 does not route an override to a manager for review; A5 cannot
extend or end a plan from the screen, and reschedules are recorded but do not move the underlying
schedule; A8 has no real slot availability behind it, so a double-booked doctor is possible, and it
does not hand off to O1 or O2; A9 has no draft state and no manager-review queue, and the closure is
written to the lead rather than to its own entity.

Recording, transcription and the model-driven parts of the qualification audit and the ask bar are the
[AI layer](../docs/AI-LAYER.md) and are not built. What exists is the field each one writes into and
every report that reads it, so wiring Soniox in changes one field's origin and no dashboard.
