import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/accounts/receivables")({
  component: ReceivablesPage,
});

function ReceivablesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["accounts-receivables"],
    queryFn: async () => {
      const [r, clients, deals, cos, profiles] = await Promise.all([
        supabase.from("receivables").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id,company_name,full_name,client_type"),
        supabase.from("deals").select("id,deal_number,policy_number,insurance_company_id,insurance_type_id"),
        supabase.from("insurance_companies").select("id,name"),
        supabase.from("profiles").select("id,full_name"),
      ]);
      return {
        rows: r.data ?? [],
        clients: new Map((clients.data ?? []).map(c => [c.id, c])),
        deals: new Map((deals.data ?? []).map(d => [d.id, d])),
        cos: new Map((cos.data ?? []).map(c => [c.id, c.name])),
        profs: new Map((profiles.data ?? []).map(p => [p.id, p.full_name])),
      };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter(r => {
      // Premium paid directly to the insurance company is never a company receivable
      if ((r as any).excluded_from_receivable) return false;
      if (status !== "all" && r.status !== status) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      if (search) {
        const d = data?.deals.get(r.deal_id);
        const c = r.client_id ? data?.clients.get(r.client_id) : null;
        const cname = c ? (c.company_name ?? c.full_name ?? "") : "";
        const hay = `${r.receivable_number} ${d?.deal_number ?? ""} ${d?.policy_number ?? ""} ${cname}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, search, status, from, to]);

  const exportCsv = () => {
    const headers = ["Receivable No","Deal","Client","Policy","Company","Gross","Net","Commission","Total","Paid","Outstanding","Status","Due"];
    const rows = filtered.map(r => {
      const d = data?.deals.get(r.deal_id);
      const c = r.client_id ? data?.clients.get(r.client_id) : null;
      const cname = c ? (c.company_name ?? c.full_name ?? "") : "";
      return [r.receivable_number, d?.deal_number, cname, d?.policy_number ?? "",
        (d?.insurance_company_id ? data?.cos.get(d.insurance_company_id) : "") ?? "",
        r.gross_premium, r.net_premium, r.commission_receivable, r.total_amount, r.paid_amount, r.outstanding_amount, r.status, r.first_due_date ?? ""];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `receivables-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <Input placeholder="Search receivable / deal / policy / client" value={search} onChange={e => setSearch(e.target.value)}/>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)}/>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)}/>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1"/>Export CSV</Button>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receivable</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Premium Receivable</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={canManage ? 10 : 9} className="text-center text-muted-foreground py-8">No receivables</TableCell></TableRow>}
            {filtered.map(r => {
              const d = data?.deals.get(r.deal_id);
              const c = r.client_id ? data?.clients.get(r.client_id) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.receivable_number}</TableCell>
                  <TableCell className="font-mono text-xs">{d?.deal_number ?? "—"}</TableCell>
                  <TableCell>{c ? (c.company_name ?? c.full_name ?? "—") : "—"}</TableCell>
                  <TableCell>{d?.insurance_company_id ? data?.cos.get(d.insurance_company_id) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(r.gross_premium)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(r.paid_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtPKR(r.outstanding_amount)}</TableCell>
                  <TableCell>{fmtDate(r.first_due_date)}</TableCell>
                  <TableCell><StatusBadge status={r.status}/></TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {r.status !== "paid" && r.status !== "cancelled" && (
                        <RecordPaymentDialog receivable={r}/>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    open: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    partial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    overdue: "bg-red-500/15 text-red-600 border-red-500/30",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status}</Badge>;
}

function RecordPaymentDialog({ receivable }: { receivable: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(receivable.outstanding_amount ?? 0));
  const [method, setMethod] = useState<string>("bank_transfer");
  const [txn, setTxn] = useState("");
  const [ibft, setIbft] = useState("");
  const [cheque, setCheque] = useState("");
  const [voucher, setVoucher] = useState("");
  const [bank, setBank] = useState("");
  const [acct, setAcct] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { data: installments } = useQuery({
    queryKey: ["installments", receivable.id],
    queryFn: async () => (await supabase.from("installments").select("*").eq("receivable_id", receivable.id).order("installment_number")).data ?? [],
    enabled: open,
  });
  const [instId, setInstId] = useState<string>("auto");

  const mut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be greater than zero");
      if (amt > Number(receivable.outstanding_amount)) throw new Error("Amount exceeds outstanding balance");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        receivable_id: receivable.id,
        installment_id: instId === "auto" ? null : instId,
        amount: amt,
        payment_date: date,
        payment_method: method as any,
        transaction_reference: txn || null,
        ibft_reference: ibft || null,
        cheque_number: cheque || null,
        cash_voucher_number: voucher || null,
        receiving_bank: bank || null,
        receiving_account: acct || null,
        notes: notes || null,
        recorded_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record payment"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Record Payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record payment — {receivable.receivable_number}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (PKR)"><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}/></Field>
          <Field label="Payment date"><Input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>
          <Field label="Installment">
            <Select value={instId} onValueChange={setInstId}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-allocate (FIFO)</SelectItem>
                {(installments ?? []).filter(i => Number(i.remaining_amount) > 0).map(i => (
                  <SelectItem key={i.id} value={i.id}>#{i.installment_number} • due {fmtDate(i.due_date)} • {fmtPKR(i.remaining_amount)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="ibft">IBFT</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Transaction Ref"><Input value={txn} onChange={e => setTxn(e.target.value)}/></Field>
          <Field label="IBFT Ref"><Input value={ibft} onChange={e => setIbft(e.target.value)}/></Field>
          <Field label="Cheque No."><Input value={cheque} onChange={e => setCheque(e.target.value)}/></Field>
          <Field label="Cash Voucher No."><Input value={voucher} onChange={e => setVoucher(e.target.value)}/></Field>
          <Field label="Receiving Bank"><Input value={bank} onChange={e => setBank(e.target.value)}/></Field>
          <Field label="Receiving Account"><Input value={acct} onChange={e => setAcct(e.target.value)}/></Field>
          <Field label="Notes" className="col-span-2"><Input value={notes} onChange={e => setNotes(e.target.value)}/></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Saving…" : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
