import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateField } from "@/components/DateField";
import { fmtDate } from "@/lib/format";
import { openStorageDoc } from "@/lib/openStorageDoc";
import { Check, Eye, Pencil, Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = [
  { v: "pending", l: "Pending" },
  { v: "in_progress", l: "In Progress" },
  { v: "completed", l: "Completed" },
  { v: "overdue", l: "Overdue" },
];
const statusLabel = (s: string) =>
  STATUSES.find((x) => x.v === s)?.l ?? (s === "done" ? "Completed" : s === "open" ? "Pending" : s);
const isDone = (s: string) => s === "completed" || s === "done";

export function isTaskOverdue(t: any) {
  if (isDone(t.status)) return false;
  if (t.status === "overdue") return true;
  if (!t.due_date) return false;
  const due = new Date(`${t.due_date}T${t.due_time ? String(t.due_time).slice(0, 5) : "23:59"}:00`);
  return due.getTime() < Date.now();
}

type Form = {
  id?: string; title: string; description: string; assigned_to: string; priority: string;
  due_date: string; due_time: string; status: string; attachment_path?: string | null; attachment_name?: string | null;
};
const EMPTY: Form = { title: "", description: "", assigned_to: "", priority: "medium", due_date: "", due_time: "", status: "pending" };

export function DealTasks({ dealId, clientId }: { dealId: string; clientId?: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Form | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [view, setView] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["deal-tasks", dealId],
    queryFn: async () => {
      const [t, p] = await Promise.all([
        supabase.from("tasks" as any).select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name").order("full_name"),
      ]);
      return { tasks: (t.data ?? []) as any[], people: (p.data ?? []) as { id: string; full_name: string }[] };
    },
  });
  const nameOf = useMemo(() => new Map((data?.people ?? []).map((p) => [p.id, p.full_name])), [data]);

  const { data: history } = useQuery({
    queryKey: ["task-activity", view?.id],
    enabled: !!view?.id,
    queryFn: async () => {
      const { data } = await supabase.from("task_activity" as any).select("*").eq("task_id", view.id).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["deal-tasks", dealId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task-activity"] });
  };

  const save = async () => {
    if (!user || !edit) return;
    if (!edit.title.trim()) return toast.error("Task title is required");
    setSaving(true);
    try {
      let attachment_path = edit.attachment_path ?? null;
      let attachment_name = edit.attachment_name ?? null;
      if (file) {
        const path = `task-attachments/${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
        if (upErr) throw upErr;
        attachment_path = path;
        attachment_name = file.name;
      }
      const payload: any = {
        title: edit.title.trim(),
        description: edit.description.trim() || null,
        assigned_to: edit.assigned_to || null,
        priority: edit.priority,
        due_date: edit.due_date || null,
        due_time: edit.due_time || null,
        status: edit.status,
        completed_at: isDone(edit.status) ? new Date().toISOString() : null,
        attachment_path, attachment_name,
      };
      const res = edit.id
        ? await supabase.from("tasks" as any).update(payload).eq("id", edit.id)
        : await supabase.from("tasks" as any).insert({ ...payload, deal_id: dealId, client_id: clientId ?? null, created_by: user.id });
      if (res.error) throw res.error;
      toast.success(edit.id ? "Task updated" : "Task added");
      setEdit(null); setFile(null); refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save task");
    } finally { setSaving(false); }
  };

  const complete = async (id: string) => {
    const { error } = await supabase.from("tasks" as any).update({ status: "completed", completed_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Task marked as completed");
    refresh();
  };

  const tasks = data?.tasks ?? [];
  const f = edit;
  const set = (k: keyof Form, v: string) => setEdit((x) => (x ? { ...x, [k]: v } : x));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tasks</CardTitle>
        <Button size="sm" onClick={() => { setFile(null); setEdit({ ...EMPTY }); }}><Plus className="w-4 h-4 mr-1" />Add Task</Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Task</TableHead><TableHead>Assigned To</TableHead><TableHead>Priority</TableHead>
            <TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {tasks.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No tasks for this deal yet</TableCell></TableRow>}
            {tasks.map((t) => {
              const overdue = isTaskOverdue(t);
              return (
                <TableRow key={t.id} className={overdue ? "bg-destructive/5" : undefined}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-1">{t.title}{t.attachment_path && <Paperclip className="w-3 h-3 text-muted-foreground" />}</div>
                    {t.description && <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{nameOf.get(t.assigned_to) ?? "—"}</TableCell>
                  <TableCell><Badge variant={t.priority === "critical" || t.priority === "high" ? "destructive" : "outline"} className="capitalize">{t.priority}</Badge></TableCell>
                  <TableCell className={overdue ? "text-destructive font-medium text-sm" : "text-sm"}>
                    {t.due_date ? fmtDate(t.due_date) : "—"}{t.due_time ? ` ${String(t.due_time).slice(0, 5)}` : ""}
                  </TableCell>
                  <TableCell>
                    {overdue ? <Badge variant="destructive">Overdue</Badge>
                      : <Badge variant={isDone(t.status) ? "secondary" : "outline"}>{statusLabel(t.status)}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{nameOf.get(t.created_by) ?? "—"}<div className="text-muted-foreground">{fmtDate(t.created_at)}</div></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" title="View" onClick={() => setView(t)}><Eye className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" title="Edit" onClick={() => { setFile(null); setEdit({
                      id: t.id, title: t.title, description: t.description ?? "", assigned_to: t.assigned_to ?? "", priority: t.priority,
                      due_date: t.due_date ?? "", due_time: t.due_time ? String(t.due_time).slice(0, 5) : "",
                      status: t.status === "done" ? "completed" : t.status === "open" ? "pending" : t.status,
                      attachment_path: t.attachment_path, attachment_name: t.attachment_name,
                    }); }}><Pencil className="w-4 h-4" /></Button>
                    {!isDone(t.status) && <Button size="sm" variant="ghost" title="Mark as Completed" onClick={() => complete(t.id)}><Check className="w-4 h-4" /></Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{f?.id ? "Edit Task" : "Add Task"}</DialogTitle></DialogHeader>
          {f && (
            <div className="grid gap-3">
              <Fl label="Task Title *"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Fl>
              <Fl label="Task Description"><Textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></Fl>
              <div className="grid sm:grid-cols-2 gap-3">
                <Fl label="Assigned To">
                  <Select value={f.assigned_to} onValueChange={(v) => set("assigned_to", v)}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>{(data?.people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </Fl>
                <Fl label="Priority">
                  <Select value={f.priority} onValueChange={(v) => set("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p[0].toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </Fl>
                <Fl label="Due Date"><DateField value={f.due_date} onChange={(v) => set("due_date", v)} /></Fl>
                <Fl label="Due Time"><Input type="time" value={f.due_time} onChange={(e) => set("due_time", e.target.value)} /></Fl>
                <Fl label="Status">
                  <Select value={f.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Fl>
                <Fl label="Attachment (optional)">
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {f.attachment_name && !file && <div className="text-xs text-muted-foreground truncate">Current: {f.attachment_name}</div>}
                </Fl>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : f?.id ? "Save Changes" : "Add Task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{view?.title}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              {view.description && <p className="whitespace-pre-wrap">{view.description}</p>}
              <div className="grid grid-cols-2 gap-2">
                <Info k="Assigned To" v={nameOf.get(view.assigned_to) ?? "—"} />
                <Info k="Priority" v={view.priority} />
                <Info k="Due" v={`${view.due_date ? fmtDate(view.due_date) : "—"}${view.due_time ? " " + String(view.due_time).slice(0, 5) : ""}`} />
                <Info k="Status" v={isTaskOverdue(view) ? "Overdue" : statusLabel(view.status)} />
                <Info k="Created By" v={nameOf.get(view.created_by) ?? "—"} />
                <Info k="Created Date" v={fmtDate(view.created_at)} />
              </div>
              {view.attachment_path && (
                <Button size="sm" variant="outline" onClick={() => openStorageDoc(view.attachment_path)}>
                  <Paperclip className="w-4 h-4 mr-1" />{view.attachment_name ?? "View attachment"}
                </Button>
              )}
              <div>
                <div className="font-medium mb-1">Activity</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {(history ?? []).length === 0 && <div className="text-muted-foreground text-xs">No activity yet</div>}
                  {(history ?? []).map((h) => (
                    <div key={h.id} className="text-xs border-l-2 border-border pl-2">
                      <span className="font-medium">{nameOf.get(h.actor_id) ?? "System"}</span> {h.action}
                      {h.details ? ` — ${h.details}` : ""}
                      <span className="text-muted-foreground"> · {new Date(h.created_at).toLocaleString("en-PK")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Fl({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Info({ k, v }: { k: string; v: string }) {
  return <div><div className="text-xs text-muted-foreground">{k}</div><div className="capitalize">{v}</div></div>;
}
