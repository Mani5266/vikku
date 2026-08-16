# Mapping to the Existing Client-Approved App

The client has an existing working CRM the client already reviewed and approved: the Base44 React app in the private repo `gvikram157-debug/trh-crm` (Base44 app name **VIKKU**, last pushed 2026-08-11).

This document records what that app already covers against the 35 screens specified here, so the approved UI is extended rather than replaced.

**No code from that app is copied into this repository.** This repository is specification only — 14 files, all Markdown plus the source PDF. The app remains the single home of the implementation.

## The existing stack

| Aspect | Value |
|--------|-------|
| Framework | React 18 + Vite 6, JavaScript (not TypeScript) |
| Routing | react-router-dom 6, 21 routes |
| Backend | Base44 SDK (`@base44/sdk`), `src/api/base44Client.js` |
| UI primitives | shadcn/ui on Radix — 49 components in `src/components/ui/` |
| Styling | Tailwind 3 + `tailwindcss-animate`, `next-themes` |
| Icons | lucide-react |
| Charts | recharts |
| Forms | react-hook-form + zod |
| Data | @tanstack/react-query |
| Other | framer-motion, date-fns, xlsx, jspdf, react-leaflet |

Any new screen should be built on these same primitives — shadcn/Radix, Tailwind, recharts, lucide — so it is visually indistinguishable from the screens the client already signed off.

## Existing domain logic worth reusing

The app already carries the thesis logic in `src/lib/`, which several of the specified screens depend on:

| File | Covers |
|------|--------|
| `followupProtocols.js` | The Hot / Warm / Cold / Not Connected day plans, WhatsApp and RCS references |
| `protocolEngine.js` | Plan execution |
| `followUpScheduler.js` | Scheduling |
| `reasonTaxonomy.js` | Closure reason codes, escalation, counseling, reactivation |
| `auditLog.js` | Audit trail |
| `roleConfig.js` | Roles and permissions |
| `temperatureUtils.jsx` | Hot / Warm / Cold handling |
| `ipdAutoTransfer.js` | IPD handoff |

## Screen-by-screen status

Legend — **Built**: a route exists and covers the spec. **Partial**: exists as a component or a subsection, not as the specified screen. **New**: nothing in the app corresponds to it.

### Agent screens

| Spec | Existing route / file | Status |
|------|----------------------|--------|
| A1 My Leads | `/my-leads` — `MyLeads.jsx` | Built |
| A2 Lead Detail | `/lead/:id` — `LeadDetail.jsx`, `LeadTimeline`, `LeadInteractionHistory`, `LeadSummaryCard` | Built |
| A3 Call Logging | `/new-call` — `NewCall.jsx` | Built |
| A4 Qualification & Scoring | `TemperatureSelector.jsx`, `temperatureUtils.jsx` | Partial — no dedicated scoring screen with the 11 factors |
| A5 Follow-up Update | `/followup-update/:id`, `/followup-protocols`, `ProtocolDayChecklist`, `SuppressionPanel`, `EndPeriodRouter`, `PlanGenerator` | Built |
| A6 Communication Composer | `ProtocolConversationLog.jsx` logs touches | Partial — logging exists, composing and the 48-hour send guard do not |
| A7 Daily Tasks | `/tasks` — `DailyTasks.jsx`, `TaskCard`, `TaskSection` | Built |
| A8 Appointment Booking | `OpdBookingDialog.jsx` | Partial — dialog only, no booking screen |
| A9 Non-Conversion Reason Capture | `NonConversionReasonPicker.jsx`, `reasonTaxonomy.js`, `ArchiveLeadDialog` | Partial — picker exists; the eight mandatory fields and the evidence link are not enforced |

### Manager screens

| Spec | Existing route / file | Status |
|------|----------------------|--------|
| M1 Manager Dashboard | `/dashboard` — `ManagerDashboard.jsx` | Built |
| M2 Daily Conversion Monitor | `/daily-conversion` — `DailyConversionMonitor.jsx` | Built |
| M3 Funnel Dashboard | `/funnel` — `FunnelDashboard.jsx` | Built |
| M4 Follow-up Compliance | `FollowUpPendingReport.jsx` | Partial — a report, not the overdue queue |
| M5 Assignment Board | `TeamAssignmentConsole.jsx` inside ManagerDashboard | Partial |
| M6 Agent Scorecard | `/scorecard` — `Scorecard.jsx` | Built — verify the outcome / process split of Section 28 |
| M7 Team | `/team` — `Team.jsx` | Built |
| M8 Escalation & Objection Desk | — | **New** |
| M9 Communication Performance | — | **New** |

### Leadership screens

| Spec | Existing route / file | Status |
|------|----------------------|--------|
| L1 Founder Dashboard | `/founder` — `FounderDashboard.jsx` | Built |
| L2 Source & Campaign ROI | `/source-roi` — `SourceROI.jsx` | Built — verify default sort is cost per surgery |
| L3 Cohort Comparison | `/cohort` — `CohortConversion.jsx` | Built |
| L4 90-Day Trend | `/conversion-90day` — `Conversion90Day.jsx` | Built |
| L5 Drill-Down Explorer | — | **New** — no drill-down code anywhere in the app |
| L6 15-Day Diagnostic Report | `ConversionTrend15Day.jsx` | Partial — a trend chart, not the diagnostic report |
| L7 Reports Library | `/reports` — `Reports.jsx`, `ReportDownload.jsx` | Built |

### Operations screens

| Spec | Existing route / file | Status |
|------|----------------------|--------|
| O1 Appointment Calendar & No-show Board | `OpdBookingDialog.jsx` | Partial — no calendar, no no-show board |
| O2 Financial Counseling Desk | reason codes reference counseling | **New** |
| O3 IPD / Admission Management | `/ipd` — `IPDManagement.jsx`, `AgingBadge`, `ipdAutoTransfer.js` | Built |
| O4 Recovery & Reactivation Console | reactivation flags in `LeadSummaryCard`, `NonConversionReasonPicker` | Partial — flags exist, no console or campaigns |

### Admin screens

| Spec | Existing route / file | Status |
|------|----------------------|--------|
| S1 Lead Intake & Source Configuration | `DataManagement.jsx`, `PhoneDuplicateCheck.jsx` | Partial — duplicate check exists, campaign hierarchy does not |
| S2 Assignment Rules | — | **New** |
| S3 Template Library & Approval | — | **New** — no template code anywhere in the app |
| S4 Status / Reason / SLA Configuration | `/admin` — `AdminControls.jsx`, `DropdownWithAdd.jsx`, `reasonTaxonomy.js` | Partial |
| S5 Audit Log | `auditLog.js` writes entries | Partial — logging exists, no viewer screen |
| S6 Roles, Permissions & User Manual | `/user-manual` — `UserManual.jsx`, `UserManagement.jsx`, `roleConfig.js` | Built |

## Summary

| Status | Count | Screens |
|--------|-------|---------|
| Built | 17 | A1, A2, A3, A5, A7, M1, M2, M3, M6, M7, L1, L2, L3, L4, L7, O3, S6 |
| Partial | 12 | A4, A6, A8, A9, M4, M5, L6, O1, O4, S1, S4, S5 |
| New | 6 | M8, M9, L5, O2, S2, S3 |

49% of the specification is already live in the approved UI, 34% exists in some partial form, and 17% is genuinely new. S6 is counted as built, though its user manual content needs updating to match this specification.

## Biggest gaps against the thesis

The six new screens are not evenly important. Ranked by what the thesis leans on hardest:

1. **A6 Communication Composer plus S3 Template Library** — the 48-hour alternating model of Sections 8 to 11 is the centrepiece of the revised thesis, and the app currently has no template system and no send-time guard at all. Touches are logged after the fact rather than orchestrated.
2. **L5 Drill-Down Explorer** — Section 25's nine-level drill is how every management conclusion is meant to be reached. There is no drill-down code in the app.
3. **O2 Financial Counseling Desk** — Section 33's worked example turns on four of seven price objectors never receiving counseling. Nothing currently tracks counseling coverage.
4. **M9 Communication Performance** — without it there is no way to prove the 48-hour model works.
5. **L6 15-Day Diagnostic Report** — the recurring management document the thesis exists to produce.
6. **M8 Escalation Desk, O4 Recovery Console, S2 Assignment Rules, S5 Audit Log viewer** — supporting infrastructure; the underlying data is largely already being captured.
