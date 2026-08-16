# Base44 Data Model — What Exists, What Is Missing

The specification in this repository is implemented against a real application: the Base44 React app in `gvikram157-debug/trh-crm` (Base44 app **VIKKU**). This document records that app's actual entities and fields, so every screen spec can be built against real names rather than invented ones.

Entity schemas live in the repo at `base44/entities/*.jsonc`. Field names below are copied from those files, not paraphrased.

## Conventions to follow

New code should match what is already there.

```js
// Data access — @tanstack/react-query over the Base44 SDK
import { base44 } from "@/api/base44Client";
const { data: inbound = [] } = useQuery({
  queryKey: ["myleads-inbound", user?.id],
  queryFn: () => base44.entities.InboundLead.filter(teamFilter, "-date", 500),
});

// Audit — always via the existing helper, never a direct AuditLog.create
import { logAudit } from "@/lib/auditLog";
await logAudit({ entityType, entityId, action, oldValue, newValue, user, reason });

// Roles — always via the existing predicates, never a string compare
import { isAgent, isManager, isAdmin, canSeeAllBranches } from "@/lib/roleConfig";
```

Ten roles are already defined in `src/lib/roleConfig.js`: `super_admin`, `admin`, `branch_manager`, `team_lead_inbound`, `team_lead_outbound`, `team_lead_ipd`, `agent_inbound`, `agent_outbound`, `agent_inbound_outbound`, `agent_ipd`. Route permission lives in `ROLE_ALLOWED_PATHS` in the same file. The screen specs' "Users" field maps onto these, not onto new role names.

## Existing entities

Sixteen entities. Seven carry real thesis weight.

| Entity | Thesis role |
|--------|-------------|
| `InboundLead` | The lead record — attribution, qualification, closure, appointment |
| `OutboundLead` | Same shape, outbound campaigns |
| `LeadInteraction` | Every call and touch — [Section 3.2](../docs/THESIS.md#32-no-call-without-a-remark) |
| `LeadFollowupPlan` | The active follow-up plan — [Sections 12–15](../docs/THESIS.md#12-revised-hot-lead-follow-up) |
| `FollowUpSchedule` | Individual scheduled touches — [Section 30.5](../docs/THESIS.md#305-follow-up-scheduler) |
| `AuditLog` | [Section 29](../docs/THESIS.md#29-evidence-and-audit-trail) |
| `AgentScorecard` | [Section 28](../docs/THESIS.md#28-agent-performance-must-be-data-based) |
| `SourceROI` | [Section 5](../docs/THESIS.md#5-lead-intake-and-source-configuration), [26](../docs/THESIS.md#26-crm-funnel-metrics) |
| `IPDRecord` | Admission and treatment — [Section 17](../docs/THESIS.md#17-appointment-and-conversion-management) |
| `DropdownOption` | Configurable vocabularies — [S4](../screens/05-admin-screens.md#s4-status-reason-code--sla-configuration) |
| `CumulativeConversion`, `RevenueConfig`, `RedFlagAlert`, `Notification`, `AppUser`, `User` | Supporting |

Also present: Base44 functions `detectNoShows`, `syncToSheets`, `createUser`, `customLogin`, `updateUserPassword`; a Google Sheets connector; and an agent config `vikku_assistant.jsonc`.

### LeadFollowupPlan — the strongest part of the build

This entity is faithful to the thesis and should be extended, never replaced. `protocol_type` matches the four plans exactly:

```
hot_7day · warm_15day · cold_monthly · notconnected_5day
```

And all seven [Section 12](../docs/THESIS.md#12-revised-hot-lead-follow-up) suppression conditions exist as real boolean fields:

```
patient_responded · appointment_booked · requested_later_date · opted_out
doctor_took_over · patient_admitted · patient_converted
```

with `suppression_active` and `suppression_reason` alongside. The engine driving it is `src/lib/protocolEngine.js`, `src/lib/followupProtocols.js` and `src/lib/followUpScheduler.js`, surfaced by `SuppressionPanel.jsx`, `ProtocolDayChecklist.jsx` and `EndPeriodRouter.jsx`.

Suppression logic in [A5](../screens/01-agent-screens.md#a5-follow-up-update) is therefore already built. It needs no new schema.

### Closure fields — six of the eight required

`InboundLead` and `LeadInteraction` both carry:

```
non_conversion_category   enum, exactly the 7 Section 23 categories
non_conversion_reason     string
recoverable               boolean
expiry_category           enum: Recoverable | Long-term Nurture | Genuine Lost | Invalid
recovery_action           string
reactivation_date         date
```

`non_conversion_category` matches [Section 23](../docs/THESIS.md#23-mandatory-non-conversion-reason-structure) exactly — Financial, Interest, Follow-up Failure, Hospital / Doctor, Competition, Lead Quality, Contactability — and `expiry_category` matches the four [Section 19](../docs/THESIS.md#19-expired-lead-segmentation) segments exactly. `src/lib/reasonTaxonomy.js` opens with `// Thesis §23, §24, §19` and encodes the sub-reasons and recommended actions.

Missing from the eight mandatory fields: **secondary reason** (there is one flat `non_conversion_reason` string, not a primary/secondary pair), **evidence source**, and **responsible person**. `reactivation_date` covers review date for recoverable leads.

### SourceROI — already thesis-correct

Carries `cost_per_lead`, `cost_per_opd`, `cost_per_surgery`, `ad_spend`, `roi_percentage`, plus the funnel counts. [L2](../screens/03-leadership-screens.md#l2-source--campaign-roi)'s requirement to sort by cost per surgery is supported by the schema today.

## The five gaps

These are schema gaps, not screen gaps — which is why the screens above them cannot simply be built.

### 1. No campaign hierarchy — blocks [Section 3.1](../docs/THESIS.md#31-no-lead-without-a-source)

`InboundLead.source` is a single flat string, populated from `DropdownOption` where `category` is `source` or `source_category`. There is no campaign, ad set, creative, landing page, or lead-generation timestamp.

*No Lead Without a Source* cannot be enforced as written, and the [Section 5](../docs/THESIS.md#5-lead-intake-and-source-configuration) worked example — Facebook / Piles Laser Hyderabad July / Men 30–55 Hyderabad / Bleeding Piles Video 02 — has nowhere to live. `SourceROI` aggregates by `source` only, so "which creative generates Hot Leads" is unanswerable.

Fix: add `campaign`, `ad_set`, `creative`, `landing_page`, `lead_generated_at` to `InboundLead`, and a `Campaign` entity for the hierarchy. Widen `SourceROI` to aggregate at campaign and creative level.

### 2. No Communication entity — blocks Sections [8–11](../docs/THESIS.md#8-revised-communication-thesis-48-hour-messaging-pattern) and [27](../docs/THESIS.md#27-communication-performance-metrics)

`FollowUpSchedule.action_type` has a `Message` value and `LeadInteraction.interaction_type` has `Message`, but neither stores channel, template, content, delivery status, read status, reply status or link clicks. Scattered flat fields exist — `message_status`, `message_channel`, `message_time`, `whatsapp_exists`, `rcs_supported` — but there is no per-message record.

Consequence: the 48-hour alternation cannot be enforced because there is nothing to check "what channel was used last and when". [A6](../screens/01-agent-screens.md#a6-communication-composer) and [M9](../screens/02-manager-screens.md#m9-communication-performance) are both blocked on this.

Fix: a `Communication` entity — `lead_id`, `channel` (WhatsApp / RCS / MMS), `template_id`, `nurture_step` 1–7, `scheduled_at`, `sent_at`, `delivered_at`, `read_at`, `replied_at`, `link_clicked`, `agent_id`, `suppressed`, `suppression_reason`.

### 3. No Template entity — blocks [Section 11](../docs/THESIS.md#11-communication-content-must-follow-a-nurturing-sequence) and [S3](../screens/05-admin-screens.md#s3-template-library--approval)

There is no template code anywhere in `src/`. The seven-step nurture sequence and the rich content library have no store, and *No Message Without a Purpose* has nothing to enforce against.

Fix: a `Template` entity — `name`, `channel`, `nurture_step`, `disease`, `purpose` (required), `body`, `media_url`, `approval_status`, `approved_by`, `version`, `retired`.

### 4. Appointments are four flat fields — blocks [Section 17](../docs/THESIS.md#17-appointment-and-conversion-management)

```
opd_date · opd_time_slot (Morning|Afternoon|Evening) · opd_booked_by
opd_status (Booked | Showed Up | No Show | Cancelled | Rescheduled)
```

Five states, where Section 17 specifies ten: Suggested, Patient Considering, Booked, Confirmation Pending, Confirmed, Rescheduled, Cancelled, No-show, Patient Arrived, Consultation Completed. There is no confirmation tracking and no reminder record, so a no-show cannot be attributed to a missing reminder — which is exactly the [Section 24](../docs/THESIS.md#24-reason-based-corrective-action) corrective action.

The `detectNoShows` function exists and should be kept.

Fix: an `Appointment` entity with the ten-state enum, `doctor`, `branch`, `slot`, `confirmed_at`, `confirmation_attempts`, `reminders_sent`, `no_show_reason`, `rescheduled_from`.

### 5. No post-consultation states — blocks [O2](../screens/04-operations-screens.md#o2-financial-counseling-desk)

`InboundLead.final_outcome` is `OP Done | IP Done | IP Pending | Medication | Not Converted`. Section 17 specifies ten post-consultation states including Surgery Advised, Financial Counseling Pending, Financial Counseling Completed, Insurance Approval Pending and Lost After Consultation.

Nothing tracks whether financial counseling happened. The thesis's own worked example in [Section 33](../docs/THESIS.md#33-sample-management-conclusion) turns on four of seven price objectors never receiving counseling — that failure is invisible in the current schema.

Fix: extend `IPDRecord` or add a `ConsultationOutcome` entity — `surgery_advised`, `quoted_package`, `patient_budget`, `counseling_status`, `counseled_by`, `counseled_at`, `insurance_status`, `emi_offered`, `discount_requested`, `discount_approved_by`, `final_amount`, `variance_reason`.

## Two field-level enforcement gaps

Schema exists; the constraint does not.

**The seven-part remark is not enforced.** `InboundLead.required` is `["patient_name", "phone_number", "feedback", "remarks"]` and `LeadInteraction.required` is `["lead_id", "lead_type", "feedback", "interaction_date"]`. Both `feedback` and `remarks` are free-text strings. `src/pages/NewCall.jsx` validates only that they are non-empty:

```js
toast({ title: "Feedback is required", variant: "destructive" });
toast({ title: "Remarks are required", variant: "destructive" });
```

[Section 3.2](../docs/THESIS.md#32-no-call-without-a-remark) requires seven distinct parts. `LeadInteraction` already has good structured enums in `contact_outcome` and `patient_response`; the remaining five parts need fields — `patient_said`, `agent_explained`, `objection_raised`, `material_shared`, `next_action`, `next_action_at`.

**AuditLog cannot carry evidence or AI provenance.** Current fields are `user_id`, `user_name`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `reason`, `timestamp`. That satisfies most of [Section 29](../docs/THESIS.md#29-evidence-and-audit-trail). It cannot record an evidence link, and it has nowhere to put the model, prompt version and accept-or-edit outcome the [AI layer](../docs/AI-LAYER.md) requires.

Fix: add `evidence_ref`, and for AI entries `ai_model`, `ai_prompt_version`, `ai_accepted`.

## Build order

Schema first, because the screens depend on it.

| Order | Work | Unblocks |
|-------|------|----------|
| 1 | `Communication` + `Template` entities | A6, S3, M9 — the 48-hour model, the centrepiece of the thesis |
| 2 | Seven-part remark fields on `LeadInteraction` | A3 — the most-violated rule, and the AI layer's target |
| 3 | Campaign hierarchy on `InboundLead` + `Campaign` | S1, L2 — source attribution, cost per surgery by creative |
| 4 | `Appointment` entity | A8, O1 — confirmation and no-show attribution |
| 5 | Consultation outcome fields | O2 — counseling coverage |
| 6 | `evidence_ref` on `AuditLog`, plus AI fields | A9, S5, L5 — evidence links, drill-down conclusions |

Screens M8, O4, S2, L5 and L6 are mostly presentation over data that already exists, and can proceed in parallel.
