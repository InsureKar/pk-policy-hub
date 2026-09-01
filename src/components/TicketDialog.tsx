import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/DateField";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TICKET_DEPARTMENTS, TICKET_PRIORITIES, SERVICE_MODULES, clientLabel,
} from "@/lib/tickets";

const EMPTY = {
  subject: "", description: "", department: "operations", service_module: "",
  category_id: "", priority: "medium", assignee_kind: "employee",
  assigned_to: "", assigned_team_id: "", assigned_department: "",
  due_date: "", client_id: "", deal_id: "", policy_number: "", insurance_company_id: "",
};

export function TicketDialog({
  data, defaults, trigger,
}: {
  data: any;
  defaults?: Partial<typeof EMPTY>;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ ...EMPTY, ...defaults });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const cats = useMemo(
    () => (data?.categories ?? []).filter((c: any) => c.department === form.department),
    [data, form.department],
  );

  const reset = () => { setForm({ ...EMPTY, ...defaults }); setFiles([]); };

  const submit = async () => {
    if (!user) return;
    if (!form.subject.trim()) return toast.error("Subject is required");
    setSaving(true);
    const payload: any = {
      subject: form.subject.trim(),
      description: form.description.trim() || null,
      department: form.department,
      service_module: form.service_module || null,
      category_id: form.category_id || null,
      priority: form.priority,
      status: form.assigned_to || form.assigned_team_id || form.assigned_department ? "assigned" : "new",
      assignee_kind: form.assigned_to ? "employee" : form.assigned_team_id ? "team" : form.assigned_department ? "department" : null,
      assigned_to: form.assigned_to || null,
      assigned_team_id: form.assigned_team_id || null,
      assigned_department: form.assigned_department || null,
      due_date: form.due_date || null,
      client_id: form.client_id || null,
      deal_id: form.deal_id || null,
      policy_number: form.policy_number.trim() || null,
      insurance_company_id: form.insurance_company_id || null,
      created_by: user.id,
    };
    const { data: created, error } = await supabase.from("tickets" as any).insert(payload).select("id, ticket_number").single();
    if (error || !created) { setSaving(false); return toast.error(error?.message ?? "Could not create ticket"); }

    for (const f of files) {
      const path = `tickets/${(created as any).id}/${Date.now()}-${f.name}`;
      const up = await supabase.storage.from("crm-documents").upload(path, f);
      if (!up.error) {
        await supabase.from("ticket_attachments" as any).insert({
          ticket_id: (created as any).id, file_name: f.name, storage_path: path, uploaded_by: user.id,
        } as any);
      }
    }
    setSaving(false);
    toast.success(`Ticket ${(created as any).ticket_number} created`);
    reset();
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["service-desk"] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus className="w-4 h-4 mr-1" />New Ticket</Button>}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Raise Internal Ticket</DialogTitle></DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Subject *</Label>
            <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Short summary of the issue" />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div>
            <Label>Department</Label>
            <Select value={form.department} onValueChange={(v) => { set("department", v); set("category_id", ""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TICKET_DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Service / Module</Label>
            <Select value={form.service_module} onValueChange={(v) => set("service_module", v)}>
              <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
              <SelectContent>{SERVICE_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assign to employee</Label>
            <Select value={form.assigned_to} onValueChange={(v) => { set("assigned_to", v); set("assigned_team_id", ""); set("assigned_department", ""); }}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>{(data?.profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>…or assign to team</Label>
            <Select value={form.assigned_team_id} onValueChange={(v) => { set("assigned_team_id", v); set("assigned_to", ""); set("assigned_department", ""); }}>
              <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
              <SelectContent>{(data?.teams ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>…or assign to department</Label>
            <Select value={form.assigned_department} onValueChange={(v) => { set("assigned_department", v); set("assigned_to", ""); set("assigned_team_id", ""); }}>
              <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
              <SelectContent>{TICKET_DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due date</Label>
            <DateField value={form.due_date} onChange={(v) => set("due_date", v)} />
          </div>

          <div>
            <Label>Related client</Label>
            <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>{(data?.clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Related deal</Label>
            <Select
              value={form.deal_id}
              onValueChange={(v) => {
                set("deal_id", v);
                const d = (data?.deals ?? []).find((x: any) => x.id === v);
                if (d) { if (d.policy_number) set("policy_number", d.policy_number); if (d.client_id) set("client_id", d.client_id); }
              }}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>{(data?.deals ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.deal_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Related policy no.</Label>
            <Input value={form.policy_number} onChange={(e) => set("policy_number", e.target.value)} />
          </div>
          <div>
            <Label>Related insurance company</Label>
            <Select value={form.insurance_company_id} onValueChange={(v) => set("insurance_company_id", v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>{(data?.companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label className="flex items-center gap-2"><Paperclip className="w-4 h-4" /> Attachments</Label>
            <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            {files.length > 0 && <p className="text-xs text-muted-foreground mt-1">{files.length} file(s) selected</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create Ticket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
