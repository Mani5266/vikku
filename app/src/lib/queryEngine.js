// Ask-a-question report builder — Thesis §25 (drill-down), §31 (reports).
//
// The client's requirement is a single bar: type or speak a question, get a plain
// table back, download it as a spreadsheet. This file is that bar's engine.
//
// It is deliberately NOT a model call. It is a keyword grammar over the journey
// records, and it reports back exactly how it read the question — dimension, filters,
// date window — so a wrong answer is visibly a misread question rather than a
// black box. When the AI layer in docs/AI-LAYER.md is wired up, it replaces
// `parseQuestion` only: `runQuery(spec, rows)` keeps producing the same tables, so the
// numbers cannot change when the parser does.

import {
  TOUCH_SLA_MINUTES,
  agentScorecards,
  avgTouchMinutes,
  bandFor,
  funnel,
  funnelByDimension,
  lossBreakdown,
  pct,
  touchTimeDistribution,
} from "@/lib/funnel";
import { formatMinutes } from "@/lib/touchTime";

const DAY = 24 * 60 * 60 * 1000;

const DIMENSIONS = [
  { key: "source", label: "Source", words: ["source", "channel", "where", "meta", "google", "youtube"] },
  { key: "agent_name", label: "Agent", words: ["agent", "telecaller", "caller", "staff", "team member"] },
  { key: "disease", label: "Disease", words: ["disease", "procedure", "surgery type", "department", "speciality"] },
  { key: "campaign", label: "Campaign", words: ["campaign", "ad", "ads", "creative"] },
  { key: "temperature", label: "Temperature", words: ["temperature", "quality", "hot warm cold"] },
  { key: "branch", label: "Branch", words: ["branch", "centre", "center", "location", "hospital"] },
];

const TEMPERATURES = ["Hot", "Warm", "Cold", "Not Connected"];
const STATUSES = ["Converted", "Lost", "Pending", "Not Connected"];

const DATE_WINDOWS = [
  { days: 7, words: ["last week", "last 7 days", "past week", "this week"] },
  { days: 14, words: ["last 14 days", "last fortnight", "last two weeks"] },
  { days: 15, words: ["last 15 days", "15 days"] },
  { days: 30, words: ["last month", "last 30 days", "this month", "past month"] },
  { days: 90, words: ["last 90 days", "last quarter", "three months", "90 days"] },
];

/** Reads a question into a query spec. Unmatched questions fall back to the funnel. */
export function parseQuestion(question, rows) {
  const q = (question || "").toLowerCase();
  const spec = { question, filters: [], dimension: null, intent: "funnel", windowDays: null };

  // --- date window -------------------------------------------------------------
  for (const window of DATE_WINDOWS) {
    if (window.words.some((w) => q.includes(w))) {
      spec.windowDays = window.days;
      break;
    }
  }

  // --- value filters -----------------------------------------------------------
  const values = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))];

  for (const key of ["source", "agent_name", "disease", "campaign", "branch"]) {
    // Campaign names embed a disease and a branch ("Piles — Jayanagar — Aug"), so a
    // partial match there would silently narrow "piles leads" to one campaign. A
    // campaign filter therefore needs the full name, or the word "campaign".
    const partialAllowed = key !== "campaign" || q.includes("campaign");
    for (const value of values(key)) {
      // Match on the distinguishing word so "meta" finds "Meta Ads" and
      // "nikhil" finds "Nikhil Rao".
      const needle = String(value).toLowerCase();
      const firstWord = needle.split(/[\s—-]+/)[0];
      if (q.includes(needle) || (partialAllowed && firstWord.length > 3 && q.includes(firstWord))) {
        spec.filters.push({ key, value, label: `${labelFor(key)} = ${value}` });
        break;
      }
    }
  }

  for (const temperature of TEMPERATURES) {
    if (q.includes(temperature.toLowerCase())) {
      spec.filters.push({ key: "temperature", value: temperature, label: `Temperature = ${temperature}` });
      break;
    }
  }

  if (/\bconverted\b|\badmission|\badmitted\b/.test(q)) {
    spec.filters.push({ key: "ip_admit", value: true, label: "Admitted (IP)" });
  } else if (/\bpending\b|\bopen\b|\bwaiting\b/.test(q) && !/follow[- ]?up/.test(q)) {
    spec.filters.push({ key: "status", value: "Pending", label: "Status = Pending" });
  } else if (/\blost\b|\bdropped\b|\bclosed\b/.test(q)) {
    spec.filters.push({ key: "status", value: "Lost", label: "Status = Lost" });
  }

  if (/\brecoverable\b|\breactivat/.test(q)) {
    spec.filters.push({ key: "recoverable", value: true, label: "Recoverable only" });
  }
  if (/missed follow|follow[- ]?up (miss|gap|leak|pending|fail)|not followed/.test(q)) {
    spec.filters.push({ key: "followup_compliant", value: false, label: "Follow-up incomplete" });
  }
  if (/\bop\b|\bopd\b|out ?patient/.test(q) && !/\bip\b/.test(q)) {
    spec.filters.push({ key: "op_visit", value: true, label: "Reached OPD" });
  }

  // --- intent ------------------------------------------------------------------
  if (/why.*(not|never).*(convert|come|visit)|reason|objection|price issue|counsel|drop/.test(q)) {
    spec.intent = "reasons";
  } else if (/touch time|response time|how (fast|quickly)|speed|sla|late|delay/.test(q)) {
    spec.intent = "touchTime";
  } else if (
    /mismatch|fake|inflate|validate|cross ?verify|wrongly marked|genuine|transcript (does )?not support|not support(ed)?|disagree/.test(
      q
    )
  ) {
    spec.intent = "mismatch";
  } else if (/scorecard|per agent|agent wise|which agent|best agent|worst agent/.test(q)) {
    spec.intent = "agents";
  } else if (
    /\blist\b|give me the leads|show me .*lead|which patients|patient wise|numbers of|mobile number|excel of|export/.test(q)
  ) {
    spec.intent = "leads";
  } else if (/transcript|conversation|what did .* say/.test(q)) {
    spec.intent = "leads";
  }

  // --- dimension ---------------------------------------------------------------
  if (spec.intent === "funnel") {
    for (const dimension of DIMENSIONS) {
      if (dimension.words.some((w) => q.includes(w))) {
        spec.dimension = dimension.key;
        break;
      }
    }
    if (!spec.dimension) spec.dimension = "source";
  }

  return spec;
}

function labelFor(key) {
  return DIMENSIONS.find((d) => d.key === key)?.label || key;
}

export function applyFilters(rows, spec, now = new Date()) {
  let out = rows;
  if (spec.windowDays) {
    const cutoff = new Date(now).getTime() - spec.windowDays * DAY;
    out = out.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }
  for (const filter of spec.filters) {
    out = out.filter((r) => r[filter.key] === filter.value);
  }
  return out;
}

const NUM = (v) => (v === null || v === undefined ? "—" : v);

/** Runs a spec and returns a renderable, downloadable report. */
export function runQuery(spec, allRows, now = new Date()) {
  const rows = applyFilters(allRows, spec, now);
  const scope = [
    spec.windowDays ? `last ${spec.windowDays} days` : "all 90 days on record",
    ...spec.filters.map((f) => f.label),
  ];

  if (spec.intent === "reasons") {
    const breakdown = lossBreakdown(rows);
    const table = [];
    for (const category of breakdown.categories) {
      for (const reason of category.reasons) {
        table.push({
          category: category.category,
          reason: reason.reason,
          leads: reason.leads,
          share: pct(reason.leads, breakdown.closed),
          recoverable: reason.recoverable,
          segment: reason.segment || "—",
          action: reason.action || "—",
        });
      }
    }
    return {
      spec,
      scope,
      title: "Why leads did not convert",
      summary: `${breakdown.closed} closed leads carry a reason. ${breakdown.recoverable} are marked recoverable.`,
      columns: [
        { key: "category", label: "Category" },
        { key: "reason", label: "Reason" },
        { key: "leads", label: "Leads", align: "right" },
        { key: "share", label: "% of closed", align: "right" },
        { key: "recoverable", label: "Recoverable", align: "right" },
        { key: "segment", label: "Segment" },
        { key: "action", label: "Recommended action" },
      ],
      rows: table,
      empty: "No closed leads in this scope, so no reasons have been recorded yet.",
    };
  }

  if (spec.intent === "touchTime") {
    const table = touchTimeDistribution(rows).map((band) => ({
      band: band.band,
      leads: band.leads,
      share: band.share,
      connected: band.connected,
      connectedRate: band.connectedRate,
      ip: band.ip,
      admissionRate: band.admissionRate,
    }));
    const average = avgTouchMinutes(rows);
    return {
      spec,
      scope,
      title: "First response time against outcome",
      summary: `Average first touch ${formatMinutes(average)}. The SLA is ${TOUCH_SLA_MINUTES} minutes.`,
      columns: [
        { key: "band", label: "First touch" },
        { key: "leads", label: "Leads", align: "right" },
        { key: "share", label: "% of leads", align: "right" },
        { key: "connected", label: "Connected", align: "right" },
        { key: "connectedRate", label: "Connected %", align: "right" },
        { key: "ip", label: "Admissions", align: "right" },
        { key: "admissionRate", label: "Admission %", align: "right" },
      ],
      rows: table,
      empty: "No leads in this scope.",
    };
  }

  if (spec.intent === "mismatch") {
    const table = rows
      .filter((r) => r.temperature_mismatch)
      .map((r) => ({
        patient_name: r.patient_name,
        phone_number: r.phone_number,
        agent_name: r.agent_name,
        source: r.source,
        agent_temperature: r.temperature,
        ai_temperature: r.ai_temperature,
        status: r.status,
        followups: `${r.followups_done}/${r.followups_required}`,
      }));
    return {
      spec,
      scope,
      title: "Qualification the transcript does not support",
      summary: `${table.length} of ${rows.filter((r) => r.connected).length} connected calls were graded differently by the transcript.`,
      columns: [
        { key: "patient_name", label: "Patient" },
        { key: "phone_number", label: "Mobile" },
        { key: "agent_name", label: "Agent" },
        { key: "source", label: "Source" },
        { key: "agent_temperature", label: "Agent typed" },
        { key: "ai_temperature", label: "Transcript supports" },
        { key: "followups", label: "Follow-ups" },
        { key: "status", label: "Outcome" },
      ],
      rows: table,
      empty: "Every qualification in this scope agrees with its transcript.",
    };
  }

  if (spec.intent === "agents") {
    const table = agentScorecards(rows).map((a) => ({
      agent: a.agent,
      leads: a.leads,
      connectedRate: a.connectedRate,
      qualityRate: a.qualityRate,
      op: a.op,
      ip: a.ip,
      admissionRate: a.admissionRate,
      avgTouch: formatMinutes(a.avgTouchMinutes),
      complianceRate: a.complianceRate,
      mismatchRate: a.mismatchRate,
    }));
    return {
      spec,
      scope,
      title: "Agent scorecard",
      summary: `${table.length} agents, ${rows.length} leads.`,
      columns: [
        { key: "agent", label: "Agent" },
        { key: "leads", label: "Leads", align: "right" },
        { key: "connectedRate", label: "Connected %", align: "right" },
        { key: "qualityRate", label: "Quality %", align: "right" },
        { key: "op", label: "OPD", align: "right" },
        { key: "ip", label: "IP", align: "right" },
        { key: "admissionRate", label: "Admission %", align: "right" },
        { key: "avgTouch", label: "Avg first touch", align: "right" },
        { key: "complianceRate", label: "Follow-up %", align: "right" },
        { key: "mismatchRate", label: "Qualification mismatch %", align: "right" },
      ],
      rows: table,
      empty: "No leads in this scope.",
    };
  }

  if (spec.intent === "leads") {
    const table = rows.map((r) => ({
      patient_name: r.patient_name,
      phone_number: r.phone_number,
      disease: r.disease,
      source: r.source,
      campaign: r.campaign,
      agent_name: r.agent_name,
      created_at: r.created_at.slice(0, 10),
      first_touch: formatMinutes(r.first_touch_minutes),
      band: bandFor(r.first_touch_minutes),
      temperature: r.temperature,
      ai_temperature: r.ai_temperature,
      followups: `${r.followups_done}/${r.followups_required}`,
      op_visit: r.op_visit ? "Yes" : "No",
      ip_admit: r.ip_admit ? "Yes" : "No",
      status: r.status,
      loss_reason: r.loss_reason || "—",
      recoverable: r.loss_category ? (r.recoverable ? "Yes" : "No") : "—",
    }));
    return {
      spec,
      scope,
      title: "Lead-level export",
      summary: `${table.length} leads, every field the analysis used.`,
      columns: [
        { key: "patient_name", label: "Patient" },
        { key: "phone_number", label: "Mobile" },
        { key: "disease", label: "Disease" },
        { key: "source", label: "Source" },
        { key: "campaign", label: "Campaign" },
        { key: "agent_name", label: "Agent" },
        { key: "created_at", label: "Lead date" },
        { key: "first_touch", label: "First touch" },
        { key: "band", label: "Touch band" },
        { key: "temperature", label: "Agent typed" },
        { key: "ai_temperature", label: "Transcript" },
        { key: "followups", label: "Follow-ups" },
        { key: "op_visit", label: "OPD" },
        { key: "ip_admit", label: "IP" },
        { key: "status", label: "Outcome" },
        { key: "loss_reason", label: "Reason" },
        { key: "recoverable", label: "Recoverable" },
      ],
      rows: table,
      empty: "No leads match that question.",
    };
  }

  // Default: the funnel, one line per value of the dimension.
  const dimension = spec.dimension || "source";
  const table = funnelByDimension(rows, dimension).map((line) => ({
    value: line.value,
    leads: line.leads,
    connected: line.connected,
    connectedRate: line.connectedRate,
    quality: line.quality,
    qualityRate: line.qualityRate,
    op: line.op,
    opRate: line.opRate,
    ip: line.ip,
    admissionRate: line.admissionRate,
    pending: line.pending,
    avgTouch: formatMinutes(line.avgTouchMinutes),
    complianceRate: NUM(line.complianceRate),
  }));
  const total = funnel(rows);

  return {
    spec,
    scope,
    title: `Funnel by ${labelFor(dimension).toLowerCase()}`,
    summary: `${total.leads} leads → ${total.connected} connected → ${total.quality} quality → ${total.op} OPD → ${total.ip} admitted (${total.admissionRate}%).`,
    columns: [
      { key: "value", label: labelFor(dimension) },
      { key: "leads", label: "Leads", align: "right" },
      { key: "connected", label: "Connected", align: "right" },
      { key: "connectedRate", label: "Connected %", align: "right" },
      { key: "quality", label: "Quality", align: "right" },
      { key: "qualityRate", label: "Quality %", align: "right" },
      { key: "op", label: "OPD", align: "right" },
      { key: "opRate", label: "OPD % of quality", align: "right" },
      { key: "ip", label: "IP", align: "right" },
      { key: "admissionRate", label: "Admission %", align: "right" },
      { key: "pending", label: "Pending", align: "right" },
      { key: "avgTouch", label: "Avg first touch", align: "right" },
      { key: "complianceRate", label: "Follow-up %", align: "right" },
    ],
    rows: table,
    empty: "No leads match that question.",
  };
}

/** Questions worth starting from — each one exercises a different intent. */
export const SUGGESTED_QUESTIONS = [
  "Source-wise funnel for the last 30 days",
  "Why are leads not converting?",
  "How fast are we responding to new leads?",
  "Which agent is the best?",
  "Show me every pending lead from Meta Ads",
  "Which qualifications does the transcript not support?",
  "Piles leads last 15 days, disease wise",
  "List recoverable leads with a price objection",
];

export function ask(question, rows, now = new Date()) {
  return runQuery(parseQuestion(question, rows), rows, now);
}
