# Metric Catalogue

Every metric the system must calculate, with its formula and the screen that owns it. From [Section 6](../docs/THESIS.md#6-connected-and-not-connected-mechanism), [26](../docs/THESIS.md#26-crm-funnel-metrics), [27](../docs/THESIS.md#27-communication-performance-metrics) and [28](../docs/THESIS.md#28-agent-performance-must-be-data-based).

## Contact metrics — Section 6

| Metric | Formula | Owner screen |
|--------|---------|--------------|
| Connected Rate | Connected Leads ÷ Total Leads × 100 | [M3](../screens/02-manager-screens.md#m3-funnel-dashboard) |
| Not Connected Rate | Not Connected Leads ÷ Total Leads × 100 | M3 |
| Not Connected Recovery Rate | Not Connected Leads Later Connected ÷ Total Initially Not Connected × 100 | M3 |

## Funnel metrics — Section 26

| Metric | Owner screen |
|--------|--------------|
| Lead-to-Connected Rate | M3 |
| Connected-to-Qualified Rate | M3 |
| Qualified-to-Hot Rate | M3 |
| Hot-to-Appointment Rate | M3 |
| Appointment-to-Visit Rate | M3 |
| Visit-to-Consultation Rate | M3 |
| Consultation-to-Surgery-Advice Rate | M3 |
| Surgery-Advice-to-Booking Rate | M3 |
| Booking-to-Completion Rate | M3 |
| Overall Lead-to-Conversion Rate | M3, [L1](../screens/03-leadership-screens.md#l1-founder-dashboard) |
| Lead-to-Revenue Rate | M3, [L2](../screens/03-leadership-screens.md#l2-source--campaign-roi) |
| Not Connected Recovery Rate | M3 |
| Expired Lead Recovery Rate | M3, [O4](../screens/04-operations-screens.md#o4-recovery--reactivation-console) |
| No-show Recovery Rate | M3, [O1](../screens/04-operations-screens.md#o1-appointment-calendar--no-show-board) |

**Required slice dimensions**, all ten available on every funnel metric: date · source · campaign · disease · branch · doctor · agent · lead quality · location · communication channel.

## Cost metrics

Derived, not listed verbatim in the thesis, but required to answer the Section 5 question "which source has the lowest cost per surgery?".

| Metric | Formula | Owner screen |
|--------|---------|--------------|
| Cost per Lead | Spend ÷ Leads | L2 |
| Cost per Connected Lead | Spend ÷ Connected Leads | L2 |
| Cost per Appointment | Spend ÷ Appointments | L2 |
| Cost per Surgery | Spend ÷ Surgeries | L2 — **default sort** |
| Junk Lead Rate | Invalid + Fake + Wrong Number + Out of Location ÷ Leads × 100 | L2 |

## Communication metrics — Section 27

| Metric | Owner screen |
|--------|--------------|
| Messages scheduled | [M9](../screens/02-manager-screens.md#m9-communication-performance) |
| Messages sent | M9 |
| Messages delivered | M9 |
| Messages failed | M9 |
| Messages read | M9 |
| Patient replies | M9 |
| Link clicks | M9 |
| Appointment actions | M9 |
| Opt-outs | M9 |
| WhatsApp response rate | M9 |
| RCS/MMS response rate | M9 |
| Image communication response rate | M9 |
| Conversion after each communication touch | M9 |
| Best-performing content | M9, [S3](../screens/05-admin-screens.md#s3-template-library--approval) |
| Best-performing channel sequence | M9 |
| Communication fatigue indicators | M9 |
| 48-hour compliance rate | M9 |

The five questions M9 exists to answer: does WhatsApp perform better as the first touch · do RCS/MMS images improve trust · does a testimonial produce more appointments · does a financial message produce more conversions · do too many touches reduce engagement.

## Agent metrics — Section 28

Displayed in two explicitly separated columns. Never merged.

**Outcome performance**

leads assigned · Hot Leads generated · appointment bookings · patient visits · surgery conversions · revenue generated · recovery conversions

**Process compliance**

first response time · calls attempted · connected rate · qualification accuracy · follow-ups due · follow-ups completed · follow-ups missed · WhatsApp activities · RCS/MMS activities · remarks quality · non-conversion reasons logged · recoverable leads identified

Owner screen: [M6](../screens/02-manager-screens.md#m6-agent-scorecard).

Remarks quality is scored on structural completeness against the seven [Section 3.2](../docs/THESIS.md#32-no-call-without-a-remark) parts, not on prose style.

## Cohort comparison factors — Section 22

Computed per treatment category, converted against non-converted, on [L3](../screens/03-leadership-screens.md#l3-cohort-comparison):

average first response time · connected rate · average number of calls · follow-up completion · WhatsApp delivery · RCS/MMS delivery · reply rate · appointment booking · patient visit · doctor interaction · financial counseling · average quoted package · insurance availability · main source · main agent
