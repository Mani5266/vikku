import React from "react";
import { useStore } from "@/store/store";
import PageHeader from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

// S5. Audit Log — Thesis §29. Append-only: entries are added, never edited.

const VARIANT = {
  CADENCE_OVERRIDE: "destructive",
  MESSAGE_BLOCKED: "warning",
  MESSAGE_SUPPRESSED: "warning",
  CALL_LOGGED: "secondary",
};

export default function AuditLog() {
  const { audit } = useStore();

  return (
    <>
      <PageHeader
        screen="S5"
        title="Audit Log"
        subtitle="Every manager exception, every blocked send, every logged call. Append-only — corrections post a new entry."
        thesis="§29"
      />

      <div className="p-6">
        <div className="scroll-slim overflow-x-auto card-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/70 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
              <tr>
                <th className="border-b px-4 py-2 font-semibold">When</th>
                <th className="border-b px-4 py-2 font-semibold">Actor</th>
                <th className="border-b px-4 py-2 font-semibold">Action</th>
                <th className="border-b px-4 py-2 font-semibold">Entity</th>
                <th className="border-b px-4 py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-xs">{formatDateTime(entry.at)}</td>
                  <td className="px-4 py-2">{entry.actor}</td>
                  <td className="px-4 py-2">
                    <Badge variant={VARIANT[entry.action] || "outline"}>{entry.action.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {entry.entity} · {entry.entity_id}
                  </td>
                  <td className="px-4 py-2 text-xs">{entry.detail}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
