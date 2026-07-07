import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtPKR, fmtDate } from "@/lib/format";
import { Printer, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/accounts/invoices")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["accounts-invoices"],
    queryFn: async () => {
      const [inv, clients, deals, recv, payments] = await Promise.all([
        supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
        supabase.from("clients").select("id,company_name,full_name,poc_address,address,ntn"),
        supabase.from("deals").select("id,deal_number,policy_number,insurance_company_id"),
        supabase.from("receivables").select("id,receivable_number,paid_amount,outstanding_amount,status"),
        supabase.from("payments").select("id,receivable_id,amount,payment_date,payment_method,transaction_reference"),
      ]);
      return {
        rows: inv.data ?? [],
        clients: new Map((clients.data ?? []).map(c => [c.id, c])),
        deals: new Map((deals.data ?? []).map(d => [d.id, d])),
        recv: new Map((recv.data ?? []).map(r => [r.id, r])),
        pays: payments.data ?? [],
      };
    },
  });

  const filtered = useMemo(() => (data?.rows ?? []).filter(r => {
    if (!search) return true;
    const d = data?.deals.get(r.deal_id);
    const c = r.client_id ? data?.clients.get(r.client_id) : null;
    const cname = c ? (c.company_name ?? c.full_name ?? "") : "";
    return `${r.invoice_number} ${d?.deal_number ?? ""} ${cname}`.toLowerCase().includes(search.toLowerCase());
  }), [data, search]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <Input placeholder="Search invoice / deal / client" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md"/>
      </CardContent></Card>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices</TableCell></TableRow>}
            {filtered.map(r => {
              const d = data?.deals.get(r.deal_id);
              const c = r.client_id ? data?.clients.get(r.client_id) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                  <TableCell className="font-mono text-xs">{d?.deal_number ?? "—"}</TableCell>
                  <TableCell>{c ? (c.company_name ?? c.full_name ?? "—") : "—"}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
                  <TableCell>{fmtDate(r.due_date)}</TableCell>
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

function InvoicePreview({ invoice, data, onClose }: { invoice: any; data: any; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  if (!invoice) return null;
  const d = data?.deals.get(invoice.deal_id);
  const c = invoice.client_id ? data?.clients.get(invoice.client_id) : null;
  const r = data?.recv.get(invoice.receivable_id);
  const payments = (data?.pays ?? []).filter((p: any) => p.receivable_id === invoice.receivable_id);
  const cname = c ? (c.company_name ?? c.full_name ?? "—") : "—";

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
                <td>Insurance Premium — Deal {d?.deal_number ?? "—"}<br/><span className="muted">Policy: {d?.policy_number ?? "—"}</span></td>
                <td className="right">{fmtPKR(invoice.total_amount)}</td>
              </tr>
              <tr><td className="right"><strong>Total</strong></td><td className="right"><strong>{fmtPKR(invoice.total_amount)}</strong></td></tr>
              <tr><td className="right">Paid</td><td className="right">{fmtPKR(r?.paid_amount ?? 0)}</td></tr>
              <tr><td className="right"><strong>Outstanding</strong></td><td className="right"><strong>{fmtPKR(r?.outstanding_amount ?? invoice.total_amount)}</strong></td></tr>
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
