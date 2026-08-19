import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildSeed } from "@/store/seed";

// In-memory store standing in for the Base44 SDK. Entity shapes match
// implementation/base44/entities/*.jsonc, so swapping this for
// `import { Communication } from "@/api/entities"` is a per-call change,
// not a restructure.

const STORAGE_KEY = "elc-crm-state-v3";
const StoreContext = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted or unavailable storage falls back to a fresh seed
  }
  return buildSeed();
}

let sequence = 0;
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${++sequence}`;

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked — the session still works, it just will not persist
    }
  }, [state]);

  const audit = useCallback((entry) => {
    setState((s) => ({
      ...s,
      audit: [{ id: newId("audit"), at: new Date().toISOString(), ...entry }, ...s.audit],
    }));
  }, []);

  /** A send the engine allowed. `verdict` is the object canSendMessage returned. */
  const sendCommunication = useCallback(
    ({ lead, template, channel, nurtureStep, verdict, schedule = false }) => {
      const nowIso = new Date().toISOString();
      const record = {
        id: newId("comm"),
        lead_id: lead.id,
        lead_type: lead.lead_type,
        patient_name: lead.patient_name,
        phone_number: lead.phone_number,
        agent_name: lead.agent_name,
        branch: lead.branch,
        channel,
        template_id: template?.id,
        template_name: template?.name,
        nurture_step: nurtureStep ?? template?.nurture_step,
        protocol_day: lead.plan?.day,
        body_snapshot: template?.body,
        scheduled_at: schedule ? verdict?.nextAllowedAt || nowIso : nowIso,
        sent_at: schedule ? null : nowIso,
        delivered_at: schedule ? null : nowIso,
        delivery_status: schedule ? "Scheduled" : "Delivered",
        suppressed: false,
        link_clicked: false,
        exception_approved_by: verdict?.code === "OVERRIDE" ? "Meera Raghavan (Manager)" : undefined,
      };

      setState((s) => ({ ...s, communications: [...s.communications, record] }));

      if (verdict?.requiresAudit) {
        audit({
          actor: "Meera Raghavan (Manager)",
          action: "CADENCE_OVERRIDE",
          entity: "Communication",
          entity_id: record.id,
          detail: `48-hour floor overridden for ${lead.patient_name} — ${verdict.reason}`,
        });
      }
      return record;
    },
    [audit]
  );

  /** A send the engine blocked. Section 12: suppressions are recorded, never dropped. */
  const recordSuppressed = useCallback(
    ({ lead, template, channel, code, reason }) => {
      const record = {
        id: newId("comm"),
        lead_id: lead.id,
        lead_type: lead.lead_type,
        patient_name: lead.patient_name,
        phone_number: lead.phone_number,
        agent_name: lead.agent_name,
        branch: lead.branch,
        channel: channel || "WhatsApp",
        template_id: template?.id,
        template_name: template?.name,
        nurture_step: template?.nurture_step,
        protocol_day: lead.plan?.day,
        scheduled_at: new Date().toISOString(),
        suppressed: true,
        suppression_reason: `${code} — ${reason}`,
        delivery_status: "Suppressed",
      };
      setState((s) => ({ ...s, communications: [...s.communications, record] }));
      audit({
        actor: "System",
        action: "MESSAGE_BLOCKED",
        entity: "Communication",
        entity_id: record.id,
        detail: `${code} for ${lead.patient_name} — ${reason}`,
      });
      return record;
    },
    [audit]
  );

  const markReplied = useCallback((communicationId) => {
    const at = new Date().toISOString();
    setState((s) => ({
      ...s,
      communications: s.communications.map((c) =>
        c.id === communicationId ? { ...c, replied_at: at, read_at: c.read_at || at, delivery_status: "Replied" } : c
      ),
    }));
  }, []);

  const saveInteraction = useCallback(
    (record) => {
      const entry = { id: newId("call"), interaction_date: new Date().toISOString(), ...record };
      setState((s) => ({ ...s, interactions: [entry, ...s.interactions] }));
      audit({
        actor: entry.agent_name || "Agent",
        action: "CALL_LOGGED",
        entity: "LeadInteraction",
        entity_id: entry.id,
        detail: `${entry.contact_outcome} — next action ${entry.next_action || "retry"}`,
      });
      return entry;
    },
    [audit]
  );

  const updateLead = useCallback((leadId, patch) => {
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, ...patch, plan: { ...l.plan, ...patch.plan } } : l)),
    }));
  }, []);

  const saveTemplate = useCallback(
    (template) => {
      const isNew = !template.id;
      const entry = isNew
        ? { id: newId("tpl"), approval_status: "Draft", version: 1, ...template }
        : template;
      setState((s) => ({
        ...s,
        templates: isNew ? [...s.templates, entry] : s.templates.map((t) => (t.id === entry.id ? entry : t)),
      }));
      audit({
        actor: "Marketing",
        action: isNew ? "TEMPLATE_CREATED" : "TEMPLATE_EDITED",
        entity: "Template",
        entity_id: entry.id,
        detail: entry.name,
      });
      return entry;
    },
    [audit]
  );

  const setTemplateStatus = useCallback(
    (templateId, status, note) => {
      const at = new Date().toISOString();
      setState((s) => ({
        ...s,
        templates: s.templates.map((t) =>
          t.id === templateId
            ? {
                ...t,
                approval_status: status,
                approved_by: status === "Approved" ? "Meera Raghavan" : t.approved_by,
                approved_at: status === "Approved" ? at : t.approved_at,
                rejection_note: status === "Rejected" ? note : t.rejection_note,
              }
            : t
        ),
      }));
      audit({
        actor: "Meera Raghavan",
        action: `TEMPLATE_${status.toUpperCase().replace(" ", "_")}`,
        entity: "Template",
        entity_id: templateId,
        detail: note || status,
      });
    },
    [audit]
  );

  const reset = useCallback(() => setState(buildSeed()), []);

  const value = useMemo(
    () => ({
      ...state,
      leadById: (id) => state.leads.find((l) => l.id === id) || null,
      communicationsFor: (leadId) => state.communications.filter((c) => c.lead_id === leadId),
      interactionsFor: (leadId) => state.interactions.filter((i) => i.lead_id === leadId),
      sendCommunication,
      recordSuppressed,
      markReplied,
      saveInteraction,
      updateLead,
      saveTemplate,
      setTemplateStatus,
      logAudit: audit, // `audit` itself is the entry list, spread from state above
      reset,
    }),
    [state, sendCommunication, recordSuppressed, markReplied, saveInteraction, updateLead, saveTemplate, setTemplateStatus, audit, reset]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
