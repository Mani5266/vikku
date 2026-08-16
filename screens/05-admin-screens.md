# Administration Screens

Six screens. These configure the rules the rest of the system enforces, and hold the audit trail that [Section 29](../docs/THESIS.md#29-evidence-and-audit-trail) requires.

---

## S1. Lead Intake & Source Configuration

**Purpose** — No lead enters without a complete source (Section 3.1).

**Users** — Admin, Marketing

**Thesis** — [5](../docs/THESIS.md#5-lead-intake-and-source-configuration), [30.1](../docs/THESIS.md#301-lead-capture-module)

**Data shown**

**Source registry** — the seventeen sources of Section 5: Facebook · Instagram · Google Ads · Google Organic · YouTube · Website · WhatsApp · Direct Call · Existing Patient · Patient Referral · Doctor Referral · Hospital Campaign · Health Camp · Offline Marketing · Telecalling Database · Partner Channel · Other.

**Campaign hierarchy** — source → campaign → ad set → creative → landing page → disease, with the Section 5 worked example as the reference shape:

```
Source        Facebook
Campaign      Piles Laser Hyderabad July
Ad Set        Men, Age 30–55, Hyderabad
Creative      Bleeding Piles Video 02
Landing Page  Piles Consultation Page
Disease       Piles
```

**Integrations** — lead-form webhooks, ad platform connections, website forms, IVR and call-tracking numbers, manual entry, CSV import. Per integration: status, last lead received, error count, field mapping.

**Duplicate detection** — matching rules on phone, alternate phone and name-plus-disease within a configurable window; merge behaviour; which record wins.

**Manual entry form** — the same mandatory attribution fields, no exceptions.

**Actions** — Add or edit a source · Build a campaign hierarchy · Map integration fields · Test an integration · Set duplicate rules · Set the intake SLA · Configure required intake fields.

**Guards**

- A lead cannot be created through any path — integration, import or manual — without source, campaign, platform, landing page or form, and date and time of generation. Section 3.1 is enforced at the write layer, not at the UI layer.
- Attribution fields become read-only after creation; changes require admin rights and are audited.

**Exit** — L2, S2.

---

## S2. Assignment Rules

**Purpose** — Route every lead to the right owner automatically.

**Users** — Admin, Manager

**Thesis** — [30.2](../docs/THESIS.md#302-lead-assignment-module)

**Data shown** — ordered rule list, each rule matching on source, campaign, disease, branch, location, language or lead score, and assigning by named agent, skill group, round robin, or load balance. Per rule: priority, match count over the last period, and the fallback when no agent qualifies.

Also: capacity caps per agent, working-hours routing, out-of-hours queue, and the escalation path for leads unassigned beyond the intake SLA.

**Actions** — Create, reorder, enable or disable a rule · Simulate a rule against recent leads before enabling · Set capacity · Set the unassigned escalation.

**Guards** — Every rule change is audited. A rule cannot be saved if it leaves any lead category without a fallback owner.

**Exit** — M5.

---

## S3. Template Library & Approval

**Purpose** — Only approved, purposeful content reaches a patient.

**Users** — Admin, Marketing, Manager

**Thesis** — [9](../docs/THESIS.md#9-alternating-whatsapp-and-mobile-rich-communication), [11](../docs/THESIS.md#11-communication-content-must-follow-a-nurturing-sequence), [30.11](../docs/THESIS.md#3011-administration-module)

**Data shown**

Templates indexed by channel (WhatsApp, RCS, MMS), by nurture step (the seven Section 11 communications: Acknowledgement, Education, Trust, Treatment Understanding, Social Proof, Financial Support, Action), by disease, and by lead quality band.

Rich content library per Section 9: doctor image · hospital image · treatment information card · procedure benefit card · patient education poster · appointment reminder creative · testimonial image · insurance information · financial counseling information · location card · recovery timeline image · before-visit checklist · call-back request card.

Per template: purpose statement, channel, nurture step, approval state, approver, version history, platform approval status where the channel requires it, and live performance pulled from M9 — sent, delivered, read, replies, appointments, conversions.

**Actions** — Create · Edit · Submit for approval · Approve or reject with comments · Version · Retire · Preview per channel · Duplicate for another disease.

**Guards**

- A template cannot be saved without a stated purpose. Section 11: each communication must have a defined purpose, and messages must not repeatedly ask "Are you interested?" — a lint rule flags exactly that phrasing.
- Only approved templates appear in the agent's composer.
- Price-offer and aggressive-surgery templates are tagged and blocked from Cold Lead plans (Section 14).
- Retiring a template does not delete its history; sent records keep pointing at the retired version.

**Exit** — M9, A6.

---

## S4. Status, Reason Code & SLA Configuration

**Purpose** — Define the vocabulary the whole system must use.

**Users** — Admin

**Thesis** — [3.3](../docs/THESIS.md#33-no-final-closure-without-a-reason), [23](../docs/THESIS.md#23-mandatory-non-conversion-reason-structure), [30.11](../docs/THESIS.md#3011-administration-module)

**Data shown**

**Statuses** — the 20 lifecycle stages, the exit statuses, and the 10 appointment states, each with allowed transitions, who may set them, and whether a reason is mandatory.

**Reason codes** — the seven Section 23 categories with their sub-reasons: Financial · Interest · Follow-up Failure · Hospital or Doctor · Competition · Lead Quality · Contactability. Each sub-reason carries a default recoverability, a default corrective action, and a default review interval.

**Follow-up plans** — the Hot 5–7 day, Warm 15-day, Cold monthly and Not Connected 5-day patterns, each editable as a day-by-day grid of call and message activity, with the 48-hour message floor as a locked global.

**SLAs** — first response time, confirmation lead time, escalation thresholds, overdue definitions, unassigned-lead limits, counseling turnaround.

**Actions** — Add or edit a status, reason or plan · Set transition rules · Set mandatory-reason flags · Edit a follow-up plan · Set SLAs · Simulate the effect of an SLA change.

**Guards**

- Closure statuses cannot have their mandatory-reason flag turned off. Section 3.3 is not configurable.
- The 48-hour message floor is a system constant; individual sends can only bypass it through an audited manager exception (Section 8).
- Retiring a reason code preserves it on historical leads.

**Exit** — A9, S5.

---

## S5. Audit Log

**Purpose** — Prove what happened, who did it, and when.

**Users** — Admin, Manager, Leadership (read-only)

**Thesis** — [29](../docs/THESIS.md#29-evidence-and-audit-trail)

**Data shown** — every entry carries the twelve Section 29 fields where applicable:

who changed the status · previous status · new status · date and time · reason for change · remark added · next follow-up changed · lead reassigned · appointment changed · discount requested · discount approved · final amount changed.

Filterable by user, lead, date range, entity type and action type. Views for the high-risk actions: discount approvals, attribution edits, bulk reassignments, manual status overrides, 48-hour exception sends, template approvals, permission changes.

**Actions** — Search · Filter · Open the affected record · Export for a dispute or a review.

**Guards**

- The log is append-only and has no delete path in any role, including admin. Section 29: no user may modify historical activity silently.
- The master record shows the latest status; the activity history preserves every past action. Both are visible from A2.
- Failed and blocked actions are logged too — a blocked send is evidence that the guard worked.

**Exit** — A2, M8.

---

## S6. Roles, Permissions & User Manual

**Purpose** — Who can see and do what, and how the system is meant to be used.

**Users** — Admin; the manual is readable by all

**Thesis** — [30.11](../docs/THESIS.md#3011-administration-module)

**Data shown**

**Roles** — Agent · Senior Agent · Team Lead · Manager · Financial Counselor · Doctor · IPD Coordinator · Front Desk · Marketing · Leadership · Admin. Per role: screen access, field-level visibility (phone masking, revenue and cost figures), action permissions, approval limits such as maximum discount, and data scope by branch or team.

**User manual** — role-specific, in-product: the operating philosophy, how to write a compliant remark, how to qualify a lead, how the 48-hour rotation works and why, how to close a lead properly, how to read the scorecard, and the escalation paths.

**Actions** — Create or edit a role · Assign users · Set approval limits · Set data scope · Edit manual content · Track manual acknowledgement per user.

**Guards**

- Revenue, cost and discount data are visible only to roles explicitly granted them.
- Permission changes are audited.
- No role can be granted the ability to delete activity history or audit entries — that capability does not exist in the system.

**Exit** — M7, S5.
