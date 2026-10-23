import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/DateField";
import { MoneyInput } from "@/components/MoneyInput";
import { fmtDate, fmtPKR } from "@/lib/format";
import { toast } from "sonner";
import { Download, FileDown, Plus, Upload } from "lucide-react";
import { normPolicy, parseRefundSheet, type ParsedRow } from "@/lib/refunds";
import { RefundDocuments } from "@/components/RefundDocuments";

export const Route = createFileRoute("/_app/operations/refunds")({
  head: () => ({ meta: [{ title: "Refunds — Insurekar CRM" }, { name: "description", content: "Refund management and supporting documents for operations." }, { property: "og:title", content: "Refunds — Insurekar CRM" }, { property: "og:description", content: "Refund management and supporting documents for operations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RefundsPage,
});

const sb = supabase as any;

function RefundsPage() {
  const { allow, loading, user } = useAuth();
  const qc = useQueryClient();
  const can = {
    view: allow("refunds.view"),
    import: allow("refunds.import", "add") || allow("refunds.import", "edit"),
    add: allow("refunds.add", "add") || allow("refunds.add", "edit"),
    edit: allow("refunds.edit", "add") || allow("refunds.edit", "edit"),
    status: allow("refunds.status", "add") || allow("refunds.status", "edit"),
    remarks: allow("refunds.remarks", "add") || allow("refunds.remarks", "edit"),
    export: allow("refunds.export", "add") || allow("refunds.export", "edit"),
  };
  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data } = useQuery({
    enabled: !!user && can.view,
    queryKey: ["refunds", can.remarks],
    queryFn: async () => {
      const [r, rm, profs] = await Promise.all([
        sb.from("refunds").select("*").order("sr_no", { ascending: true }),
        can.remarks ? sb.from("refund_remarks").select("refund_id, remarks") : Promise.resolve({ data: [] }),
        sb.from("profiles").select("id, full_name, email"),
      ]);
      if (r.error) throw r.error;
      return {
        rows: (r.data ?? []) as any[],
        remarks: new Map<string, string>((rm.data ?? []).map((x: any) => [x.refund_id, x.remarks ?? ""])),
        profs: new Map<string, string>((profs.data ?? []).map((p: any) => [p.id, p.full_name || p.email])),
      };
    },
  });

  const userNames = useMemo(() => {
    const names = new Set<string>();
    (data?.rows ?? []).forEach((r) => { if (r.agent_name) names.add(r.agent_name); if (r.do_name) names.add(r.do_name); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (userFilter !== "all" && r.agent_name !== userFilter && r.do_name !== userFilter) return false;
      if (from && (!r.refund_process_date || r.refund_process_date < from)) return false;
      if (to && (!r.refund_process_date || r.refund_process_date > to)) return false;
      if (!s) return true;
      return [r.name, r.policy_no, r.agent_name, r.do_name].some((v) => String(v ?? "").toLowerCase().includes(s));
    });
  }, [data, q, userFilter, status, from, to]);

  if (loading) return null;
  if (!can.view) return <Navigate to="/dashboard" replace />;
  const refresh = () => qc.invalidateQueries({ queryKey: ["refunds"] });

  const exportXlsx = () => {
    const out = rows.map((r) => ({
      "Sr. No.": r.sr_no, Name: r.name, "Policy No.": r.policy_no, "Agent Name": r.agent_name ?? "",
      Premium: Number(r.premium), "DO Name": r.do_name ?? "", Refunded: Number(r.refunded),
      Status: r.status === "paid" ? "Paid" : "Not Paid", "Refund Process Date": r.refund_process_date ?? "",
      ...(can.remarks ? { Remarks: data?.remarks.get(r.id) ?? "" } : {}),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), "Refunds");
    XLSX.writeFile(wb, `refunds-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold mr-auto">Refunds</h2>
        {(can.import || can.add) && <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="w-4 h-4 mr-1" />Sample Template</Button>}
        {can.import && <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />Upload Sheet</Button>}
        {can.add && <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" />Add Refund</Button>}
        {can.export && <Button size="sm" variant="outline" onClick={exportXlsx}><Download className="w-4 h-4 mr-1" />Export</Button>}
      </div>
      <Card><CardContent className="p-4 grid gap-3 md:grid-cols-5">
        <div><Label className="text-xs">Search</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, policy, agent, DO" /></div>
        <div><Label className="text-xs">User</Label>
          <Select value={userFilter} onValueChange={setUserFilter}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Users</SelectItem>
              {userNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select></div>
        <div><Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="not_paid">Not Paid</SelectItem></SelectContent>
          </Select></div>
        <div><Label className="text-xs">Process date from</Label><DateField value={from} onChange={setFrom} /></div>
        <div><Label className="text-xs">Process date to</Label><div className="flex gap-1"><DateField value={to} onChange={setTo} />
          {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>}</div></div>
      </CardContent></Card>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Sr. No.</TableHead><TableHead>Name</TableHead><TableHead>Policy No.</TableHead><TableHead>Agent Name</TableHead>
            <TableHead className="text-right">Premium</TableHead><TableHead>DO Name</TableHead><TableHead className="text-right">Refunded</TableHead>
            <TableHead>Status</TableHead><TableHead>Update</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No refunds found.</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.policy_no}</TableCell>
                <TableCell>{r.agent_name ?? "—"}</TableCell>
                <TableCell className="text-right">{fmtPKR(r.premium)}</TableCell>
                <TableCell>{r.do_name ?? "—"}</TableCell>
                <TableCell className="text-right">{fmtPKR(r.refunded)}</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : "outline"}>{r.status === "paid" ? "Paid" : "Not Paid"}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {(can.edit || can.status) ? <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Update</Button>
                      : <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>View</Button>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {r.refund_process_date ? `Processed ${fmtDate(r.refund_process_date)}` : "No process date"}
                    {r.updated_by && <> · by {data?.profs.get(r.updated_by) ?? "—"} {new Date(r.updated_at).toLocaleString()}</>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      {editing && <UpdateDialog row={editing} remarks={data?.remarks.get(editing.id) ?? ""} can={can} onClose={() => setEditing(null)} onSaved={refresh} />}
      {adding && <AddDialog userNames={Array.from(new Set((data?.profs ? [...data.profs.values()] : []).filter(Boolean))).sort((a, b) => a.localeCompare(b))} onClose={() => setAdding(false)} onSaved={refresh} />}
      {importOpen && <ImportDialog existing={(data?.rows ?? []).map((r) => normPolicy(r.policy_no))} onClose={() => setImportOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([["Name", "Policy No.", "Agent Name", "Premium", "DO Name", "Refunded"], ["Ali Khan", "TRV-0001", "Agent A", 12000, "Amir Ali", 3000]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Refunds");
  XLSX.writeFile(wb, "refund-template.xlsx");
}

function UpdateDialog({ row, remarks, can, onClose, onSaved }: any) {
  const [f, setF] = useState({ refund_process_date: row.refund_process_date ?? "", refunded: Number(row.refunded), status: row.status, remarks });
  const [saving, setSaving] = useState(false);
  const readOnly = !can.edit && !can.status;
  const save = async () => {
    if (saving) return;
    setSaving(true);
    const patch: any = {};
    if (can.edit) { patch.refund_process_date = f.refund_process_date || null; patch.refunded = f.refunded || 0; }
    if (can.status) patch.status = f.status;
    const { data, error } = await sb.from("refunds").update(patch).eq("id", row.id).select("id").maybeSingle();
    if (!error && !data) { setSaving(false); return toast.error("You do not have permission to update this refund."); }
    if (error) { setSaving(false); return toast.error(error.message); }
    if (can.edit && can.remarks && f.remarks !== remarks) {
      const r = await sb.from("refund_remarks").upsert({ refund_id: row.id, remarks: f.remarks }, { onConflict: "refund_id" });
      if (r.error) { setSaving(false); return toast.error(r.error.message); }
    }
    setSaving(false);
    toast.success("Refund updated");
    onSaved(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{readOnly ? "Refund" : "Update Refund"} — {row.policy_no}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="text-sm text-muted-foreground">{row.name} · Premium {fmtPKR(row.premium)}</div>
          <div><Label>Refund Process Date</Label><DateField value={f.refund_process_date} onChange={(v) => setF({ ...f, refund_process_date: v })} disabled={!can.edit} /></div>
          <div><Label>Refunded</Label><MoneyInput value={f.refunded} onChange={(n) => setF({ ...f, refunded: n })} disabled={!can.edit} /></div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })} disabled={!can.status}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="not_paid">Not Paid</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
            </Select></div>
          {can.remarks && <div><Label>Remarks</Label><Textarea value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} disabled={!can.edit} /></div>}
          <RefundDocuments refundId={row.id} canUpload={can.edit} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!readOnly && <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ userNames, onClose, onSaved }: any) {
  const userSelect = (k: string, l: string) => (
    <div><Label>{l}</Label>
      <Select value={f[k] || "__none__"} onValueChange={(v) => setF({ ...f, [k]: v === "__none__" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
        <SelectContent><SelectItem value="__none__">None</SelectItem>
          {userNames.map((n: string) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
        </SelectContent>
      </Select></div>
  );
  const [f, setF] = useState<any>({ name: "", policy_no: "", agent_name: "", premium: 0, do_name: "", refunded: 0, refund_process_date: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    if (!f.name.trim() || !f.policy_no.trim()) return toast.error("Name and Policy No. are required");
    setSaving(true);
    const { error } = await sb.from("refunds").insert({ ...f, refund_process_date: f.refund_process_date || null, agent_name: f.agent_name || null, do_name: f.do_name || null });
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "A refund with this Policy No. already exists" : error.message);
    toast.success("Refund added"); onSaved(); onClose();
  };
  const t = (k: string, l: string) => <div><Label>{l}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Refund</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          {t("name", "Name *")}{t("policy_no", "Policy No. *")}{userSelect("agent_name", "Agent Name")}{userSelect("do_name", "DO Name")}
          <div><Label>Premium</Label><MoneyInput value={f.premium} onChange={(n) => setF({ ...f, premium: n })} /></div>
          <div><Label>Refunded</Label><MoneyInput value={f.refunded} onChange={(n) => setF({ ...f, refunded: n })} /></div>
          <div className="md:col-span-2"><Label>Refund Process Date</Label><DateField value={f.refund_process_date} onChange={(v) => setF({ ...f, refund_process_date: v })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ existing, onClose, onSaved }: { existing: string[]; onClose: () => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ ok: number; failed: { row: number; policy: string; error: string }[] } | null>(null);

  const onFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
      setRows(parseRefundSheet(aoa, existing)); setSummary(null);
    } catch { toast.error("Could not read this file. Please upload a valid .xlsx or .xls sheet."); }
  };
  const valid = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? [];

  const doImport = async () => {
    if (busy || !valid.length) return;
    if (!date) return toast.error("Select the Refund Process Date for this batch");
    setBusy(true);
    const batch = crypto.randomUUID();
    let ok = 0; const failed = invalid.map((r) => ({ row: r.rowNo, policy: r.policy_no, error: r.errors.join("; ") }));
    for (const r of valid) {
      const { error } = await sb.from("refunds").insert({
        name: r.name, policy_no: r.policy_no, agent_name: r.agent_name || null, premium: r.premium,
        do_name: r.do_name || null, refunded: r.refunded, refund_process_date: date, import_batch: batch,
      });
      if (error) failed.push({ row: r.rowNo, policy: r.policy_no, error: error.code === "23505" ? "Policy No. already exists in refunds" : error.message });
      else ok++;
    }
    setBusy(false); setSummary({ ok, failed }); onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Upload Refund Sheet</DialogTitle></DialogHeader>
        {summary ? (
          <div className="space-y-3">
            <div className="text-sm"><b>{summary.ok}</b> imported successfully · <b>{summary.failed.length}</b> failed</div>
            {summary.failed.length > 0 && <ErrTable items={summary.failed} />}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Excel file (.xlsx, .xls)</Label>
                <Input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></div>
              <div><Label>Refund Process Date (for this batch) *</Label><DateField value={date} onChange={setDate} /></div>
            </div>
            {rows && (
              <>
                <div className="text-sm">{rows.length} rows · <span className="text-primary font-medium">{valid.length} valid</span> · <span className="text-destructive font-medium">{invalid.length} invalid</span></div>
                {invalid.length > 0 && <ErrTable items={invalid.map((r) => ({ row: r.rowNo, policy: r.policy_no, error: r.errors.join("; ") }))} />}
                <div className="max-h-64 overflow-auto border rounded">
                  <Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Name</TableHead><TableHead>Policy No.</TableHead><TableHead>Agent</TableHead><TableHead>Premium</TableHead><TableHead>DO</TableHead><TableHead>Refunded</TableHead></TableRow></TableHeader>
                    <TableBody>{valid.map((r) => (
                      <TableRow key={r.rowNo}><TableCell>{r.rowNo}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.policy_no}</TableCell><TableCell>{r.agent_name}</TableCell>
                        <TableCell>{fmtPKR(r.premium)}</TableCell><TableCell>{r.do_name}</TableCell><TableCell>{fmtPKR(r.refunded)}</TableCell></TableRow>))}</TableBody></Table>
                </div>
                <p className="text-xs text-muted-foreground">Only valid rows are imported, all as Not Paid. Invalid rows are listed above and are not imported; existing refunds are never overwritten.</p>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{summary ? "Close" : "Cancel"}</Button>
          {!summary && <Button onClick={doImport} disabled={busy || !valid.length}>{busy ? "Importing…" : `Import ${valid.length} rows`}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErrTable({ items }: { items: { row: number; policy: string; error: string }[] }) {
  return (
    <div className="max-h-48 overflow-auto border border-destructive/40 rounded">
      <Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Policy No.</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((e, i) => <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell>{e.policy || "—"}</TableCell><TableCell className="text-destructive">{e.error}</TableCell></TableRow>)}</TableBody></Table>
    </div>
  );
}
