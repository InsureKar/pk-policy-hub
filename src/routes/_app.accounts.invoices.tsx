import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { fmtPKR, fmtDate } from "@/lib/format";
import { Printer, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/DateField";

export const Route = createFileRoute("/_app/accounts/invoices")({
  component: InvoicesPage,
});

type Schedule = "annual" | "half_yearly" | "quarterly" | "monthly";
const scheduleMeta: Record<Schedule, { label: string; count: number; stepMonths: number }> = {
  annual: { label: "Annually", count: 1, stepMonths: 12 },
  half_yearly: { label: "Biannually", count: 2, stepMonths: 6 },
  quarterly: { label: "Quarterly", count: 4, stepMonths: 3 },
  monthly: { label: "Monthly", count: 12, stepMonths: 1 },
};

function InvoicesPage() {
  const { user, hasRole } = useAuth();
  const canCreate = hasRole(["admin", "management"]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const { data } = useQuery({
    queryKey: ["accounts-invoices"],
    queryFn: async () => {
      const [inv, clients, deals, recv, payments, types] = await Promise.all([
        supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
        supabase.from("clients").select("id,company_name,full_name,poc_address,address,ntn,client_type"),
        supabase.from("deals").select("id,deal_number,policy_number,insurance_company_id"),
        supabase.from("receivables").select("id,receivable_number,paid_amount,outstanding_amount,status"),
        supabase.from("payments").select("id,receivable_id,amount,payment_date,payment_method,transaction_reference"),
        supabase.from("insurance_types").select("id,name").eq("active", true),
      ]);
      return {
        rows: (inv.data ?? []) as any[],
        clients: new Map<string, any>((clients.data ?? []).map((c: any) => [c.id, c])),
        deals: new Map<string, any>((deals.data ?? []).map((d: any) => [d.id, d])),
        recv: new Map<string, any>((recv.data ?? []).map((r: any) => [r.id, r])),
        pays: payments.data ?? [],
        types: types.data ?? [],
      };
    },
  });

  const filtered = useMemo(() => (data?.rows ?? []).filter((r: any) => {
    if (!search) return true;
    const d = r.deal_id ? data?.deals.get(r.deal_id) : null;
    const c = r.client_id ? data?.clients.get(r.client_id) : null;
    const cname = c ? (c.company_name ?? c.full_name ?? "") : "";
    return `${r.invoice_number} ${d?.deal_number ?? ""} ${cname}`.toLowerCase().includes(search.toLowerCase());
  }), [data, search]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex items-center justify-between gap-3">
        <Input placeholder="Search invoice / deal / client" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md"/>
        {canCreate && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1"/>New Invoice</Button>
            </DialogTrigger>
            <NewInvoiceDialog
              clients={Array.from(data?.clients.values() ?? [])}
              types={data?.types ?? []}
              creatorId={user?.id}
              onDone={() => setOpenNew(false)}
            />
          </Dialog>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices</TableCell></TableRow>}
            {filtered.map((r: any) => {
              const d = r.deal_id ? data?.deals.get(r.deal_id) : null;
              const c = r.client_id ? data?.clients.get(r.client_id) : null;
              const sched = r.payment_schedule ? scheduleMeta[r.payment_schedule as Schedule]?.label : "—";
              const idx = r.installment_index && r.installment_total ? ` (${r.installment_index}/${r.installment_total})` : "";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                  <TableCell>{c ? (c.company_name ?? c.full_name ?? "—") : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{d?.deal_number ?? "—"}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
                  <TableCell>{fmtDate(r.due_date)}</TableCell>
                  <TableCell className="text-xs">{sched}{idx}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(r.total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><FileText className="w-4 h-4 mr-1"/>View</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <InvoicePreview invoice={selected} data={data} onClose={() => setSelected(null)}/>
    </div>
  );
}

function NewInvoiceDialog({ clients, types, creatorId, onDone }: { clients: any[]; types: any[]; creatorId?: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    client_id: "",
    insurance_type_id: "",
    total_amount: 0,
    payment_schedule: "annual" as Schedule,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.client_id) return toast.error("Client is required");
    if (!Number(form.total_amount)) return toast.error("Amount must be greater than zero");
    setBusy(true);
    try {
      const meta = scheduleMeta[form.payment_schedule as Schedule];
      const total = Number(form.total_amount);
      const per = Math.round((total / meta.count) * 100) / 100;
      const lastAdj = Math.round((total - per * (meta.count - 1)) * 100) / 100;
      const issue = form.issue_date;
      const dueBase = new Date(form.due_date);

      // Parent invoice (full total, status draft, kind manual)
      const parentRes = await (supabase as any).from("invoices").insert({
        client_id: form.client_id,
        deal_id: null,
        insurance_type_id: form.insurance_type_id || null,
        payment_schedule: form.payment_schedule,
        total_amount: total,
        issue_date: issue,
        due_date: form.due_date,
        description: form.description || null,
        notes: form.description || null,
        status: "pending_approval",
        invoice_kind: "manual",
        created_by: creatorId,
      }).select("id").single();
      if (parentRes.error) throw new Error(parentRes.error.message);

      if (meta.count > 1) {
        const rows = Array.from({ length: meta.count }, (_, i) => {
          const d = new Date(dueBase);
          d.setMonth(d.getMonth() + i * meta.stepMonths);
          return {
            client_id: form.client_id,
            deal_id: null,
            insurance_type_id: form.insurance_type_id || null,
            payment_schedule: form.payment_schedule,
            total_amount: i === meta.count - 1 ? lastAdj : per,
            issue_date: issue,
            due_date: d.toISOString().slice(0, 10),
            description: form.description || null,
            notes: `${form.description ?? ""} — Installment ${i + 1} of ${meta.count}`.trim(),
            status: "pending_approval",
            invoice_kind: "manual_installment",
            parent_invoice_id: parentRes.data.id,
            installment_index: i + 1,
            installment_total: meta.count,
            created_by: creatorId,
          };
        });
        const childRes = await (supabase as any).from("invoices").insert(rows);
        if (childRes.error) throw new Error(childRes.error.message);
      }

      toast.success(meta.count > 1 ? `Created invoice with ${meta.count} installments` : "Invoice created");
      qc.invalidateQueries({ queryKey: ["accounts-invoices"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <F label="Client *">
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select existing client"/></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.company_name ?? c.full_name ?? "Client"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
        <F label="Insurance Type">
          <Select value={form.insurance_type_id} onValueChange={(v) => setForm({ ...form, insurance_type_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="Total Amount (PKR) *">
          <Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })}/>
        </F>
        <F label="Payment Mode / Schedule *">
          <Select value={form.payment_schedule} onValueChange={(v) => setForm({ ...form, payment_schedule: v })}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annually (1)</SelectItem>
              <SelectItem value="half_yearly">Biannually (2)</SelectItem>
              <SelectItem value="quarterly">Quarterly (4)</SelectItem>
              <SelectItem value="monthly">Monthly (12)</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Issue Date *">
          <DateField value={form.issue_date} onChange={(v) => setForm({ ...form, issue_date: v })}/>
        </F>
        <F label="First Due Date *">
          <DateField value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })}/>
        </F>
        <div className="col-span-2">
          <F label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Line item description shown on the invoice"/>
          </F>
        </div>
        <div className="col-span-2 text-xs text-muted-foreground">
          Invoice number is generated automatically. Non-annual schedules will create a parent invoice plus one child invoice per installment, each with its own due date.
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create Invoice"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function InvoicePreview({ invoice, data, onClose }: { invoice: any; data: any; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  if (!invoice) return null;
  const d = invoice.deal_id ? data?.deals.get(invoice.deal_id) : null;
  const c = invoice.client_id ? data?.clients.get(invoice.client_id) : null;
  const r = invoice.receivable_id ? data?.recv.get(invoice.receivable_id) : null;
  const payments = (data?.pays ?? []).filter((p: any) => p.receivable_id === invoice.receivable_id);
  const cname = c ? (c.company_name ?? c.full_name ?? "—") : "—";
  const schedLabel = invoice.payment_schedule ? scheduleMeta[invoice.payment_schedule as Schedule]?.label : null;

  const doPrint = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w || !printRef.current) return;
    w.document.write(`<html><head><title>${invoice.invoice_number}</title>
      <style>body{font-family:system-ui;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#f5f5f5}h1{margin:0 0 4px}.right{text-align:right}.muted{color:#666;font-size:12px}</style>
      </head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice {invoice.invoice_number}</span>
            <Button size="sm" variant="outline" onClick={doPrint}><Printer className="w-4 h-4 mr-1"/>Print / PDF</Button>
          </DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="bg-background p-4">
          <div className="flex justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">TAX INVOICE</h1>
              <div className="muted text-xs text-muted-foreground">Invoice #: {invoice.invoice_number}</div>
              <div className="muted text-xs text-muted-foreground">Date: {fmtDate(invoice.issue_date)}</div>
              <div className="muted text-xs text-muted-foreground">Due: {fmtDate(invoice.due_date)}</div>
              {schedLabel && <div className="muted text-xs text-muted-foreground">Schedule: {schedLabel}{invoice.installment_index ? ` (${invoice.installment_index}/${invoice.installment_total})` : ""}</div>}
            </div>
            <div className="text-right">
              <div className="font-semibold">InsureBroker CRM</div>
              <div className="text-xs text-muted-foreground">Karachi, Pakistan</div>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-xs uppercase text-muted-foreground">Bill To</div>
            <div className="font-medium">{cname}</div>
            <div className="text-sm text-muted-foreground">{c?.poc_address ?? c?.address ?? ""}</div>
            {c?.ntn && <div className="text-xs">NTN: {c.ntn}</div>}
          </div>
          <table>
            <thead><tr><th>Description</th><th className="right">Amount</th></tr></thead>
            <tbody>
              <tr>
                <td>
                  {invoice.description ?? `Insurance Premium — Deal ${d?.deal_number ?? "—"}`}
                  {d?.policy_number && <><br/><span className="muted">Policy: {d.policy_number}</span></>}
                </td>
                <td className="right">{fmtPKR(invoice.total_amount)}</td>
              </tr>
              <tr><td className="right"><strong>Total</strong></td><td className="right"><strong>{fmtPKR(invoice.total_amount)}</strong></td></tr>
              {r && <>
                <tr><td className="right">Paid</td><td className="right">{fmtPKR(r?.paid_amount ?? 0)}</td></tr>
                <tr><td className="right"><strong>Outstanding</strong></td><td className="right"><strong>{fmtPKR(r?.outstanding_amount ?? invoice.total_amount)}</strong></td></tr>
              </>}
            </tbody>
          </table>
          {payments.length > 0 && (
            <>
              <div className="mt-6 mb-1 font-semibold">Payment History</div>
              <table>
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="right">Amount</th></tr></thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.payment_date)}</td>
                      <td>{p.payment_method}</td>
                      <td>{p.transaction_reference ?? "—"}</td>
                      <td className="right">{fmtPKR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
