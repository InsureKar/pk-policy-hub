import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateField } from "@/components/DateField";
import { fmtDate } from "@/lib/format";
import { Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
  head: () => ({
    meta: [
      { title: "Tasks & Reminders | Insurance CRM" },
      { name: "description", content: "Create task reminders that are routed to Admin and Management for follow-up." },
      { property: "og:title", content: "Tasks & Reminders | Insurance CRM" },
      { property: "og:description", content: "Create task reminders that are routed to Admin and Management for follow-up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY = { title: "", description: "", due_date: "", priority: "medium", deal_id: "", client_id: "" };

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({ ...EMPTY });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const { data } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const [tasks, deals, clients, profiles] = await Promise.all([
        supabase.from("tasks" as any).select("*").order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("deals").select("id, deal_number").order("created_at", { ascending: false }).limit(200),
        supabase.from("clients").select("id, company_name, full_name, client_type").order("company_name"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        tasks: (tasks.data ?? []) as any[],
        deals: deals.data ?? [],
        clients: clients.data ?? [],
        people: new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])),
      };
    },
  });

  const rows = useMemo(
    () => (data?.tasks ?? []).filter((t) => (filter === "all" ? true : filter === "open" ? t.status !== "done" : t.status === "done")),
    [data, filter],
  );

  const submit = async () => {
    if (!user) return;
    if (!form.title.trim()) return toast.error("Task title is required");
    const { error } = await supabase.from("tasks" as any).insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      priority: form.priority,
      deal_id: form.deal_id || null,
      client_id: form.client_id || null,
      created_by: user.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Task created — visible to Admin & Management");
    setForm({ ...EMPTY });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const complete = async (id: string) => {
    const { error } = await supabase.from("tasks" as any).update({ status: "done", completed_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const clientName = (id: string | null) => {
    const c = data?.clients.find((x) => x.id === id);
    return c ? (c.client_type === "individual" ? c.full_name || c.company_name : c.company_name) : "—";
  };

  return (
    <div className="p-6 max-w-[1300px] mx-auto space-y-4">
      <PageHeader title="Tasks & Reminders" subtitle="Every task you create is routed to Admin and Management for visibility." />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open tasks</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />New Task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Task / Reminder</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <F label="Title *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></F>
                <F label="Details"><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></F>
                <div className="grid sm:grid-cols-2 gap-3">
                  <F label="Due Date"><DateField value={form.due_date} onChange={(v) => set("due_date", v)} /></F>
                  <F label="Priority">
                    <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Related Deal">
                    <Select value={form.deal_id} onValueChange={(v) => set("deal_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>{data?.deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.deal_number}</SelectItem>)}</SelectContent>
                    </Select>
                  </F>
                  <F label="Related Client">
                    <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>{data?.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_type === "individual" ? c.full_name || c.company_name : c.company_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </F>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit}>Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tasks</TableCell></TableRow>}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                </TableCell>
                <TableCell>{t.due_date ? fmtDate(t.due_date) : "—"}</TableCell>
                <TableCell><Badge variant={t.priority === "high" ? "destructive" : "outline"}>{t.priority}</Badge></TableCell>
                <TableCell>{clientName(t.client_id)}</TableCell>
                <TableCell className="text-xs">{data?.people.get(t.created_by) ?? "—"}</TableCell>
                <TableCell><Badge variant={t.status === "done" ? "secondary" : "outline"}>{t.status}</Badge></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {t.status !== "done" && <Button size="sm" variant="ghost" onClick={() => complete(t.id)}><Check className="w-4 h-4" /></Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
