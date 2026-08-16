# Implementation — drop-in code for the Base44 app

Ready-to-apply code for steps 1 and 2 of the [build order](../reference/base44-data-model.md#build-order). Written against the real conventions of `gvikram157-debug/trh-crm` — same import style, same `@/` aliases, same shadcn primitives, reusing the existing libs rather than duplicating them.

**Nothing here has been pushed to the client's app.** Pushing to `trh-crm` syncs into the Base44 Builder, so that stays your call. Paths below mirror that repo exactly, so applying is a copy.

## What is here

```
base44/entities/Communication.jsonc              new entity
base44/entities/Template.jsonc                   new entity
base44/entities/LeadInteraction.additions.jsonc  properties to merge into the existing entity
src/lib/communicationEngine.js                   the 48-hour guard
src/components/shared/StructuredRemark.jsx       the seven-part remark form
test/communicationEngine.test.mjs                self-check, no framework
test/followupProtocols.stub.js                   stub so the test runs outside the app
```

## Run the check

```bash
node implementation/test/communicationEngine.test.mjs
# 23 checks passed
```

No dependencies, no test framework — the app has none installed and this does not add one. The engine imports `"@/lib/followupProtocols"`, which is correct inside the app; the test rewrites that specifier to a local stub so it runs standalone.

Verified to actually fail on regression: changing the floor from 48h to 24h, or removing the same-channel-twice check, each break the suite.

## What it reuses

The follow-up engine is the strongest part of the existing build and is extended, not replaced.

| Reused | From |
|--------|------|
| `FOLLOWUP_PROTOCOLS` | `src/lib/followupProtocols.js` — already encodes `messageChannel` per protocol day |
| `checkSuppression` | same file — the seven Section 12 conditions are already implemented |
| `NON_CONVERSION_CATEGORIES`, `getReasonsForCategory` | `src/lib/reasonTaxonomy.js` — already thesis-grounded |
| `contact_outcome`, `patient_response` | existing `LeadInteraction` enums — two of the seven remark parts already exist |
| shadcn primitives, lucide icons | `src/components/ui/` — 49 components already there |

`communicationEngine.js` deliberately adds no new protocol data. The schedule already exists; what was missing was the guard that checks a proposed send against real history.

## 1. Communication and Template entities

Unblocks [A6](../screens/01-agent-screens.md#a6-communication-composer), [S3](../screens/05-admin-screens.md#s3-template-library--approval) and [M9](../screens/02-manager-screens.md#m9-communication-performance).

The 48-hour model could not be enforced before because nothing stored which channel was used last and when. `Communication` is that record; `Template` gives content a home and makes `purpose` a required field, which is how *No Message Without a Purpose* stops being advice.

Suppressed sends are written as rows with `suppressed: true` and a reason, never dropped — a suppression is evidence that a guard fired.

## 2. communicationEngine.js

`canSendMessage()` returns `{ allowed, code, reason }` and never throws. Check order is deliberate: hard stops resolve before the cadence floor, so an opted-out patient reports `OPTED_OUT` rather than a misleading `TOO_SOON`.

| Code | Rule |
|------|------|
| `OPTED_OUT`, `DO_NOT_CONTACT`, `INVALID_NUMBER`, `CONVERTED` | Hard stops. No manager override |
| `SUPPRESSED` | Any of the seven Section 12 conditions, via the existing helper |
| `COLD_PRICE_OFFER`, `COLD_SURGERY_PUSH` | Section 14 — Cold Leads never get these |
| `TEMPLATE_REUSED`, `TEMPLATE_UNAPPROVED` | Section 10 |
| `CHANNEL_REPEAT` | Section 9 — rotation is system-driven |
| `TOO_SOON` | Section 8 — the 48-hour floor, overridable by a manager with an audit entry |

**Messages only.** Section 8 is explicit that an urgent Hot Lead may still be called inside 48 hours. Do not route calls through this function.

Also exported: `nextChannel`, `nextNurtureStep`, `nextAllowedSendAt`, `plannedMessageForDay`, and `communicationStats` for M9.

## 3. StructuredRemark.jsx

Closes the [verified gap](../screens/06-existing-app-mapping.md#verified-enforcement-gaps) where `NewCall.jsx` validates two free-text fields as non-empty.

Wire it by gating save on the exported guard:

```jsx
import StructuredRemark, { isRemarkComplete, missingRemarkParts } from "@/components/shared/StructuredRemark";

if (!isRemarkComplete(remark, { connected })) {
  toast({ title: `Remark incomplete: ${missingRemarkParts(remark).join(", ")}`, variant: "destructive" });
  return;
}
```

Not-connected calls are exempt — they follow the Section 15 retry path, not the seven-part remark.

The `suggested` prop is where the [AI layer](../docs/AI-LAYER.md) lands: the model drafts these fields, the agent confirms. The completeness gate stays in force either way, which is the point — AI fills the form, it never bypasses it.

## Applying it

1. Copy the three files under `base44/entities/` into the app. Merge `LeadInteraction.additions.jsonc` into the existing `LeadInteraction.jsonc` — it is a patch, not a replacement.
2. Copy `src/lib/communicationEngine.js` and `src/components/shared/StructuredRemark.jsx`.
3. Wire the save gate in `src/pages/NewCall.jsx` as above.
4. Push to `trh-crm`, which syncs to the Base44 Builder.

Step 4 is the irreversible one. Confirm before running it.

## Not built here

Steps 3 to 6 of the build order — campaign hierarchy, the `Appointment` entity, consultation outcomes, and `evidence_ref` on `AuditLog`. Those are specified in [`base44-data-model.md`](../reference/base44-data-model.md) but not yet written.
