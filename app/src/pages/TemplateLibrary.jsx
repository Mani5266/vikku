import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, X } from "lucide-react";
import { NURTURE_SEQUENCE } from "@/lib/communicationEngine";
import { useStore } from "@/store/store";
import PageHeader from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Tabs from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

// S3. Template Library & Approval — Thesis §9, §11, §30.11.
// Only approved, purposeful content reaches a patient.

const MEDIA_TYPES = [
  "None",
  "Doctor Image",
  "Hospital Image",
  "Treatment Information Card",
  "Procedure Benefit Card",
  "Patient Education Poster",
  "Appointment Reminder Creative",
  "Testimonial Image",
  "Insurance Information",
  "Financial Counseling Information",
  "Location Card",
  "Recovery Timeline Image",
  "Before-Visit Checklist",
  "Call-back Request Card",
];

// Section 11 lint: a message must carry a purpose, not repeatedly ask this.
const LINT_PATTERN = /are you interested/i;

const STATUS_VARIANT = {
  Approved: "success",
  "Pending Approval": "warning",
  Draft: "secondary",
  Rejected: "destructive",
  Retired: "outline",
};

const EMPTY = {
  name: "",
  purpose: "",
  channel: "WhatsApp",
  nurture_step: "",
  disease: "Any",
  temperature: "Any",
  body: "",
  media_type: "None",
  is_price_offer: false,
  is_surgery_push: false,
};

export default function TemplateLibrary() {
  const { templates, communications, saveTemplate, setTemplateStatus } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [draft, setDraft] = useState(null);

  const performance = useMemo(() => {
    const acc = {};
    for (const c of communications) {
      if (!c.template_id) continue;
      const row = (acc[c.template_id] ||= { sent: 0, delivered: 0, read: 0, replied: 0, suppressed: 0 });
      if (c.suppressed) row.suppressed += 1;
      if (c.sent_at && !c.suppressed) row.sent += 1;
      if (c.delivered_at) row.delivered += 1;
      if (c.read_at) row.read += 1;
      if (c.replied_at) row.replied += 1;
    }
    return acc;
  }, [communications]);

  const filters = {
    all: () => true,
    approved: (t) => t.approval_status === "Approved",
    pending: (t) => t.approval_status === "Pending Approval",
    draft: (t) => t.approval_status === "Draft",
    flagged: (t) => LINT_PATTERN.test(t.body || ""),
  };

  const visible = templates.filter(filters[tab]);

  const submit = () => {
    if (!draft.name.trim() || !draft.purpose.trim() || !draft.nurture_step) {
      toast({
        title: "Cannot save",
        description: "Name, purpose and nurture step are required. Purpose is what makes the message allowed at all.",
        variant: "destructive",
      });
      return;
    }
    const step = Number(draft.nurture_step);
    saveTemplate({
      ...draft,
      nurture_step: step,
      nurture_label: NURTURE_SEQUENCE[step - 1],
    });
    toast({ title: "Template saved as Draft", description: "Submit it for approval to reach the composer." });
    setDraft(null);
  };

  return (
    <>
      <PageHeader
        screen="S3"
        title="Template Library & Approval"
        subtitle="Indexed by channel and by the seven Section 11 nurture communications. Only approved templates appear in the agent's composer."
        thesis="§9, §11, §30.11"
        actions={
          <Button size="sm" onClick={() => setDraft(EMPTY)}>
            <Plus className="h-3.5 w-3.5" />
            New template
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          className="w-fit"
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "All", count: templates.length },
            { value: "approved", label: "Approved", count: templates.filter(filters.approved).length },
            { value: "pending", label: "Pending approval", count: templates.filter(filters.pending).length },
            { value: "draft", label: "Draft", count: templates.filter(filters.draft).length },
            { value: "flagged", label: "Lint flagged", count: templates.filter(filters.flagged).length },
          ]}
        />

        {draft && (
          <Card>
            <CardHeader>
              <CardTitle>New template</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Purpose — required</Label>
                <Input
                  value={draft.purpose}
                  onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                  placeholder="What this message is for. No purpose, no send."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["WhatsApp", "RCS", "MMS"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nurture step</Label>
                <Select
                  value={draft.nurture_step ? String(draft.nurture_step) : ""}
                  onValueChange={(v) => setDraft({ ...draft, nurture_step: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {NURTURE_SEQUENCE.map((label, i) => (
                      <SelectItem key={label} value={String(i + 1)}>
                        {i + 1}. {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Media</Label>
                <Select value={draft.media_type} onValueChange={(v) => setDraft({ ...draft, media_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIA_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Lead quality band</Label>
                <Select value={draft.temperature} onValueChange={(v) => setDraft({ ...draft, temperature: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Any", "Hot", "Warm", "Cold", "Not Connected"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Body</Label>
                <Textarea rows={3} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                {LINT_PATTERN.test(draft.body) && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Section 11 lint: "Are you interested?" is not a purpose.
                  </p>
                )}
              </div>
              <div className="flex gap-4 text-sm sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.is_price_offer}
                    onChange={(e) => setDraft({ ...draft, is_price_offer: e.target.checked })}
                  />
                  Price offer — blocked from Cold Leads
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.is_surgery_push}
                    onChange={(e) => setDraft({ ...draft, is_surgery_push: e.target.checked })}
                  />
                  Aggressive surgery push — blocked from Cold Leads
                </label>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={submit}>Save as draft</Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((t) => {
            const stats = performance[t.id] || { sent: 0, delivered: 0, read: 0, replied: 0, suppressed: 0 };
            const flagged = LINT_PATTERN.test(t.body || "");
            return (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="flex-1">{t.name}</CardTitle>
                    <Badge variant={STATUS_VARIANT[t.approval_status]}>{t.approval_status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline">{t.channel}</Badge>
                    <Badge variant="outline">
                      {t.nurture_step}. {t.nurture_label}
                    </Badge>
                    <Badge variant="outline">{t.temperature}</Badge>
                    <Badge variant="secondary">{t.media_type}</Badge>
                    <Badge variant="outline">v{t.version}</Badge>
                    {t.is_price_offer && <Badge variant="warning">price offer</Badge>}
                    {t.is_surgery_push && <Badge variant="warning">surgery push</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">Purpose: {t.purpose}</p>
                  <p className="rounded-md bg-muted/50 p-2 text-xs">{t.body}</p>

                  {flagged && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Lint: asks "Are you interested?" — Section 11 requires a purpose.
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Live from M9 — sent {stats.sent} · delivered {stats.delivered} · read {stats.read} · replies{" "}
                    {stats.replied} · suppressed {stats.suppressed}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.approval_status === "Draft" && (
                      <Button size="sm" variant="outline" onClick={() => setTemplateStatus(t.id, "Pending Approval")}>
                        Submit for approval
                      </Button>
                    )}
                    {t.approval_status === "Pending Approval" && (
                      <>
                        <Button size="sm" onClick={() => setTemplateStatus(t.id, "Approved")}>
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setTemplateStatus(t.id, "Rejected", "Rejected on review")}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    )}
                    {t.approval_status === "Approved" && (
                      <Button size="sm" variant="outline" onClick={() => setTemplateStatus(t.id, "Retired")}>
                        Retire
                      </Button>
                    )}
                    {t.approval_status === "Rejected" && (
                      <Button size="sm" variant="outline" onClick={() => setTemplateStatus(t.id, "Pending Approval")}>
                        Resubmit
                      </Button>
                    )}
                  </div>
                  {t.approval_status === "Retired" && (
                    <p className="text-xs text-muted-foreground">
                      Retired. Sent records keep pointing at this version — history is not deleted.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
