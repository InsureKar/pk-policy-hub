import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShieldCheck, Pencil } from "lucide-react";
import { fmtPKR } from "@/lib/format";
import { toast } from "sonner";
import { DateField } from "@/components/DateField";

export const Route = createFileRoute("/_app/operations/dispatch")({
  component: DispatchPage,
});

const DOC_TYPES = [
  "Policy Document", "Fluctuation Cards", "Claim Cheque", "Claim Documents",
  "Marine Policy", "Motor Policy", "Fire Policy", "Cover Note", "Any Other Cheque", "Other",
];
const CHEQUE_TYPES = ["Claim Cheque", "Any Other Cheque"];
const CHEQUE_STATUSES = ["Deposited Directly in Bank", "Dispatched to Client by TCS", "Dispatched by Company Dispatcher"];
const ACCESS_LEVELS = [
  { value: "none", label: "No Access" },
  { value: "view", label: "View Only" },
  { value: "edit", label: "View + Edit" },
  { value: "add", label: "Full (Add/Edit)" },
];

const emptyForm = () => ({
  record_kind: "dispatched",
  document_status: "dispatched",
  client_id: "",
  client_name: "",
  dispatch_date: new Date().toISOString().slice(0, 10),
  tracking_number: "",
  document_type: "Policy Document",
  description: "",
  dispatcher_name: "",
  receiver_name: "",
  card_count: "",
  cheque_number: "",
  cheque_payee: "",
  cheque_amount: "",
  cheque_status: "",
});

function DispatchPage() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole(["admin", "management"]);
  const [tab, setTab] = useState<"dispatched" | "received">("dispatched");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm());
  const [accessOpen, setAccessOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dispatch-records"],
    queryFn: async () => {
      const sb = supabase as any;
      const [recs, clients, profs, access] = await Promise.all([
        sb.from("dispatch_records").select("*").order("dispatch_date", { ascending: false }),
        sb.from("clients").select("id, company_name, full_name, client_type"),
        sb.from("profiles").select("id, full_name, email"),
        sb.from("dispatch_access").select("user_id, level"),
      ]);
      return {
        rows: (recs.data ?? []) as any[],
        clients: (clients.data ?? []) as any[],
        profs: new Map<string, any>((profs.data ?? []).map((p: any) => [p.id, p])),
        access: (access.data ?? []) as any[],
        error: recs.error,
      };
    },
  });

  const myLevel: string = isAdmin
    ? "add"
    : (data?.access.find((a: any) => a.user_id === user?.id)?.level ?? "none");
  const canAdd = myLevel === "add";
  const canEdit = myLevel === "add" || myLevel === "edit";
  const hasAccess = isAdmin || myLevel !== "none";

  const clientLabel = (c: any) => c?.company_name || c?.full_name || "—";
  const clientMap = useMemo(
    () => new Map<string, any>((data?.clients ?? []).map((c: any) => [c.id, c])),
    [data?.clients],
  );

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.rows ?? [])
      .filter((r: any) => r.record_kind === tab)
      .filter((r: any) => typeFilter === "all" || r.document_type === typeFilter)
      .filter((r: any) => {
        if (!term) return true;
        const name = r.client_name || clientLabel(clientMap.get(r.client_id));
        return [name, r.tracking_number, r.document_type, r.description, r.dispatcher_name, r.receiver_name, r.cheque_number, r.cheque_payee]
          .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(term));
      });
  }, [data?.rows, tab, q, typeFilter, clientMap]);

  const isCheque = CHEQUE_TYPES.includes(form.document_type);
  const isCards = form.document_type === "Fluctuation Cards";

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), record_kind: tab, document_status: tab }); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      ...emptyForm(), ...r,
      client_id: r.client_id ?? "",
      card_count: r.card_count ?? "",
      cheque_amount: r.cheque_amount ?? "",
      cheque_number: r.cheque_number ?? "",
      cheque_payee: r.cheque_payee ?? "",
      cheque_status: r.cheque_status ?? "",
      description: r.description ?? "",
      tracking_number: r.tracking_number ?? "",
      dispatcher_name: r.dispatcher_name ?? "",
      receiver_name: r.receiver_name ?? "",
      client_name: r.client_name ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_id && !form.client_name.trim()) return toast.error("Select or enter a client");
    if (!form.document_type) return toast.error("Document type is required");
    const payload: any = {
      record_kind: form.record_kind,
      document_status: form.document_status,
      client_id: form.client_id || null,
      client_name: form.client_id ? (clientLabel(clientMap.get(form.client_id)) as string) : form.client_name.trim(),
      dispatch_date: form.dispatch_date,
      tracking_number: form.tracking_number || null,
      document_type: form.document_type,
      description: form.description || null,
      dispatcher_name: form.dispatcher_name || null,
      receiver_name: form.receiver_name || null,
      card_count: isCards && form.card_count !== "" ? Number(form.card_count) : null,
      cheque_number: isCheque ? form.cheque_number || null : null,
      cheque_payee: isCheque ? form.cheque_payee || null : null,
      cheque_amount: isCheque && form.cheque_amount !== "" ? Number(form.cheque_amount) : null,
      cheque_status: isCheque ? form.cheque_status || null : null,
    };
    const sb = supabase as any;
    const { error } = editing
      ? await sb.from("dispatch_records").update(payload).eq("id", editing.id)
      : await sb.from("dispatch_records").insert({ ...payload, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success(editing ? "Record updated" : "Record saved");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["dispatch-records"] });
  };

  if (!isLoading && !hasAccess) {
    return (
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        You do not have access to the Dispatch Record module. Ask Management to grant access.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          {(["dispatched", "received"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-1.5 text-sm rounded-[5px] capitalize ${tab === k ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"}`}>
              {k}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-8 w-[240px]" placeholder="Search client, TCS no., type…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All document types</SelectItem>
            {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setAccessOpen(true)}>
              <ShieldCheck className="w-4 h-4 mr-1" /> Module Access
            </Button>
          )}
          {canAdd && <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Record</Button>}
        </div>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>TCS / Tracking</TableHead>
            <TableHead>Document Type</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dispatcher</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{r.dispatch_date}
                  <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </TableCell>
                <TableCell className="font-medium">{r.client_name || clientLabel(clientMap.get(r.client_id))}</TableCell>
                <TableCell>{r.tracking_number || "—"}</TableCell>
                <TableCell>{r.document_type}</TableCell>
                <TableCell className="text-xs">
                  {r.card_count ? <div>Cards: {r.card_count}</div> : null}
                  {r.cheque_number ? <div>Cheque #{r.cheque_number} · {r.cheque_payee || "—"}</div> : null}
                  {r.cheque_amount ? <div>{fmtPKR(Number(r.cheque_amount))}</div> : null}
                  {r.cheque_status ? <div className="text-muted-foreground">{r.cheque_status}</div> : null}
                  {r.description ? <div className="text-muted-foreground line-clamp-2">{r.description}</div> : null}
                </TableCell>
                <TableCell><Badge variant={r.document_status === "received" ? "secondary" : "outline"} className="capitalize">{r.document_status}</Badge></TableCell>
                <TableCell>{r.dispatcher_name || "—"}</TableCell>
                <TableCell>{r.receiver_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{data?.profs.get(r.created_by)?.full_name || data?.profs.get(r.created_by)?.email || "—"}</TableCell>
                <TableCell className="text-right">
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No {tab} records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Dispatch Record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Record Type</Label>
              <Select value={form.record_kind} onValueChange={(v) => setForm((f: any) => ({ ...f, record_kind: v, document_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Status</Label>
              <Select value={form.document_status} onValueChange={(v) => setForm((f: any) => ({ ...f, document_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={form.client_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, client_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not listed (type name) —</SelectItem>
                  {(data?.clients ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!form.client_id && (
              <div><Label>Client Name</Label>
                <Input value={form.client_name} onChange={(e) => setForm((f: any) => ({ ...f, client_name: e.target.value }))} /></div>
            )}
            <div>
              <Label>Parcel / Dispatch Date</Label>
              <DateField value={form.dispatch_date} onChange={(v) => setForm((f: any) => ({ ...f, dispatch_date: v }))} />
            </div>
            <div><Label>TCS No. / Tracking No.</Label>
              <Input value={form.tracking_number} onChange={(e) => setForm((f: any) => ({ ...f, tracking_number: e.target.value }))} /></div>
            <div>
              <Label>Document Type</Label>
              <Select value={form.document_type} onValueChange={(v) => setForm((f: any) => ({ ...f, document_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isCards && (
              <div><Label>Number of Cards</Label>
                <Input type="number" min={0} value={form.card_count} onChange={(e) => setForm((f: any) => ({ ...f, card_count: e.target.value }))} /></div>
            )}
            <div><Label>Dispatcher Name</Label>
              <Input value={form.dispatcher_name} onChange={(e) => setForm((f: any) => ({ ...f, dispatcher_name: e.target.value }))} /></div>
            <div><Label>Receiver Name</Label>
              <Input value={form.receiver_name} onChange={(e) => setForm((f: any) => ({ ...f, receiver_name: e.target.value }))} /></div>

            {isCheque && (
              <>
                <div className="col-span-2 text-xs uppercase tracking-wide text-muted-foreground pt-2">Cheque Details</div>
                <div><Label>Cheque No.</Label>
                  <Input value={form.cheque_number} onChange={(e) => setForm((f: any) => ({ ...f, cheque_number: e.target.value }))} /></div>
                <div><Label>Cheque Name / Payee</Label>
                  <Input value={form.cheque_payee} onChange={(e) => setForm((f: any) => ({ ...f, cheque_payee: e.target.value }))} /></div>
                <div><Label>Cheque Amount</Label>
                  <Input type="number" min={0} value={form.cheque_amount} onChange={(e) => setForm((f: any) => ({ ...f, cheque_amount: e.target.value }))} /></div>
                <div>
                  <Label>Cheque Status</Label>
                  <Select value={form.cheque_status || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, cheque_status: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {CHEQUE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="col-span-2"><Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Create Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Dispatch Module Access</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Admin and Management always have full access. Other users have no access unless granted here.</p>
            <div className="space-y-2">
              {Array.from(data?.profs.values() ?? []).map((p: any) => {
                const lvl = data?.access.find((a: any) => a.user_id === p.id)?.level ?? "none";
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="flex-1 text-sm truncate">{p.full_name || p.email}</div>
                    <Select value={lvl} onValueChange={async (v) => {
                      const sb = supabase as any;
                      const { error } = v === "none"
                        ? await sb.from("dispatch_access").delete().eq("user_id", p.id)
                        : await sb.from("dispatch_access").upsert({ user_id: p.id, level: v }, { onConflict: "user_id" });
                      if (error) return toast.error(error.message);
                      toast.success("Access updated");
                      qc.invalidateQueries({ queryKey: ["dispatch-records"] });
                    }}>
                      <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{ACCESS_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
