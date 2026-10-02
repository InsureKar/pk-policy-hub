import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Insurekar CRM" },
      { name: "description", content: "Complete history of user actions across the CRM." },
      { property: "og:title", content: "Activity Log — Insurekar CRM" },
      { property: "og:description", content: "Complete history of user actions across the CRM." },
    ],
  }),
  component: ActivityPage,
});

type Row = { id: string; actor_id: string | null; action: string; module: string | null; summary: string | null;
  entity_type: string; old_value: any; new_value: any; created_at: string; metadata: any };

const short = (v: any) => {
  if (v == null) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 160 ? s.slice(0, 160) + "…" : s;
};

function ActivityPage() {
  const { hasRole } = useAuth();
  const isMgr = hasRole(["admin", "management"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows((data ?? []) as any));
    supabase.from("profiles").select("id, full_name, email").order("full_name").then(({ data }) => setPeople((data ?? []) as any));
  }, []);

  const nameOf = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.full_name || p.email])), [people]);
  const modules = useMemo(() => Array.from(new Set(rows.map((r) => r.module).filter(Boolean))) as string[], [rows]);
  const filtered = rows.filter((r) => (mod === "all" || r.module === mod) &&
    (!q || `${r.summary} ${nameOf[r.actor_id ?? ""] ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="p-6">
      <PageHeader title="Activity Log" subtitle={isMgr ? "Every important action by every user" : "Your own activity"}
        actions={isMgr && <Button onClick={() => setSendOpen(true)}><Send className="w-4 h-4 mr-1" /> Send Notification</Button>} />
      <div className="flex gap-2 mb-4">
        <Input placeholder="Search user or action…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={mod} onValueChange={setMod}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-2">Date & Time</th><th className="p-2">User</th><th className="p-2">Module</th><th className="p-2">Action</th><th className="p-2">Previous</th><th className="p-2">New</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No activity recorded.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-PK")}</td>
                <td className="p-2 whitespace-nowrap">{nameOf[r.actor_id ?? ""] ?? "—"}</td>
                <td className="p-2">{r.module ?? r.entity_type}</td>
                <td className="p-2">{r.summary ?? `${r.action} ${r.entity_type}`}</td>
                <td className="p-2 text-xs text-muted-foreground font-mono break-all max-w-xs">{r.action === "insert" ? "—" : short(r.old_value)}</td>
                <td className="p-2 text-xs text-muted-foreground font-mono break-all max-w-xs">{r.action === "delete" ? "—" : short(r.action === "insert" ? null : r.new_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isMgr && <SendDialog open={sendOpen} onOpenChange={setSendOpen} people={people} />}
    </div>
  );
}

function SendDialog({ open, onOpenChange, people }: { open: boolean; onOpenChange: (v: boolean) => void; people: { id: string; full_name: string; email: string }[] }) {
  const [sel, setSel] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [relType, setRelType] = useState("none");
  const [relId, setRelId] = useState("");
  const [opts, setOpts] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRelId(""); setOpts([]);
    if (relType === "deal") supabase.from("deals").select("id, deal_number").order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setOpts((data ?? []).map((d: any) => ({ id: d.id, label: d.deal_number }))));
    if (relType === "client") supabase.from("clients").select("id, name").order("name").limit(500)
      .then(({ data }) => setOpts((data ?? []).map((d: any) => ({ id: d.id, label: d.name }))));
    if (relType === "task") supabase.from("tasks").select("id, title").order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setOpts((data ?? []).map((d: any) => ({ id: d.id, label: d.title }))));
  }, [relType]);

  const send = async () => {
    if (sel.length === 0 || !title.trim()) { toast.error("Select at least one user and enter a title"); return; }
    setBusy(true);
    const { error } = await (supabase.rpc as any)("send_notification", {
      _user_ids: sel, _title: title.trim(), _message: message.trim(),
      _entity_type: relType !== "none" && relId ? relType : null, _entity_id: relType !== "none" && relId ? relId : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Notification sent to ${sel.length} user(s)`);
    setSel([]); setTitle(""); setMessage(""); setRelType("none"); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm font-medium mb-1">
              <span>Users ({sel.length})</span>
              <button className="text-xs text-primary" onClick={() => setSel(sel.length === people.length ? [] : people.map((p) => p.id))}>
                {sel.length === people.length ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sel.includes(p.id)} onCheckedChange={(c) => setSel((s) => c ? [...s, p.id] : s.filter((x) => x !== p.id))} />
                  {p.full_name || p.email}
                </label>
              ))}
            </div>
          </div>
          <Input placeholder="Notification title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <Textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
          <div className="flex gap-2">
            <Select value={relType} onValueChange={setRelType}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No link</SelectItem>
                <SelectItem value="deal">Deal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
            {relType !== "none" && (
              <Select value={relId} onValueChange={setRelId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter><Button onClick={send} disabled={busy}><Send className="w-4 h-4 mr-1" /> Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
