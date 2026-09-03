import { createFileRoute, Navigate } from "@tanstack/react-router";
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
import { Download, Plus } from "lucide-react";
import { DateField } from "@/components/DateField";

export const Route = createFileRoute("/_app/accounts/payables")({
  component: PayablesPage,
});

const sb = supabase as any;

const CATEGORY_LABEL: Record<string, string> = {
  commission: "Commission Payable",
  b2b_commission: "B2B Commission Payable",
  tax: "Tax Payable",
  expense: "Expense Payable",
  other: "Other Payable",
};

const SUBHEADS = [
  { value: "all", label: "All Payables" },
  { value: "expense", label: "Expenses" },
  { value: "tax", label: "Tax Payable" },
  { value: "b2b_commission", label: "B2B Commission Payable" },
];

function PayablesPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "management"]);
  const canManage = hasRole("admin");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");

  const { data } = useQuery({
    queryKey: ["accounts-payables-ledger"],
    enabled: isAdmin,
    queryFn: async () => {
      const [p, profiles, deals] = await Promise.all([
        sb.from("payables").select("*").order("created_at", { ascending: false }),
        sb.from("profiles").select("id,full_name"),
        sb.from("deals").select("id,deal_number,b2b_commission,b2b_taker_id"),
      ]);
      return {
        rows: (p.data ?? []) as any[],
        profs: new Map(((profiles.data ?? []) as any[]).map(pr => [pr.id, pr.full_name])),
        deals: new Map(((deals.data ?? []) as any[]).map(d => [d.id, d.deal_number])),
        dealB2b: new Map(((deals.data ?? []) as any[]).map(d => [d.id, Number(d.b2b_commission || 0)])),
      };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter(r => {
      if (status !== "all" && r.status !== status) return false;
      if (category !== "all" && r.category !== category) return false;
      if (search) {
        const payee = r.payee_name ?? data?.profs.get(r.payee_profile_id) ?? "";
        const d = data?.deals.get(r.deal_id) ?? "";
        if (!`${payee} ${d} ${r.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, search, status, category]);

  const totals = useMemo(() => {
    const t = { original: 0, paid: 0, outstanding: 0, byCat: {} as Record<string, number> };
    for (const r of filtered) {
      t.original += Number(r.original_amount || 0);
      t.paid += Number(r.paid_amount || 0);
      t.outstanding += Number(r.outstanding_amount ?? 0);
    }
    for (const r of data?.rows ?? []) t.byCat[r.category] = (t.byCat[r.category] ?? 0) + Number(r.original_amount || 0);
    return t;
  }, [filtered, data]);

  if (!isAdmin) return <Navigate to="/accounts" replace />;

  const payeeOf = (r: any) => r.payee_name || data?.profs.get(r.payee_profile_id) || "—";

  const exportCsv = () => {
    const head = ["Category", "Payee", "Deal", "Description", "Original", "Paid", "Outstanding", "Due Date", "Payment Date", "Status"];
    const body = filtered.map(r => [CATEGORY_LABEL[r.category] ?? r.category, payeeOf(r), data?.deals.get(r.deal_id) ?? "", r.description ?? "",
      r.original_amount, r.paid_amount, r.outstanding_amount, r.due_date ?? "", r.payment_date ?? "", r.status]);
    const csv = [head, ...body].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `payables-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Commission Payable" value={fmtPKR(totals.byCat["commission"] ?? 0)} />
        <KPI label="B2B Commission Payable" value={fmtPKR(totals.byCat["b2b_commission"] ?? 0)} />
        <KPI label="Tax Payable" value={fmtPKR(totals.byCat["tax"] ?? 0)} />
        <KPI label="Expense Payables" value={fmtPKR(totals.byCat["expense"] ?? 0)} />
        <KPI label="Other Payables" value={fmtPKR(totals.byCat["other"] ?? 0)} />
        <KPI label="Total Outstanding" value={fmtPKR(totals.outstanding)} tone="danger" />
      </div>

      <SubHeadTabs value={category} onChange={setCategory} items={SUBHEADS} />

      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <Input placeholder="Search payee / deal / description" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {canManage ? <NewPayableDialog /> : <div />}
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />Export CSV</Button>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Payee</TableHead>
            <TableHead>Deal / Transaction</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Original</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Payment Date</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={canManage ? 11 : 10} className="text-center text-muted-foreground py-8">No payables</TableCell></TableRow>}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{CATEGORY_LABEL[r.category] ?? r.category}</TableCell>
                <TableCell>{payeeOf(r)}</TableCell>
                <TableCell className="font-mono text-xs">{data?.deals.get(r.deal_id) ?? "—"}</TableCell>
                <TableCell className="max-w-[260px] truncate">{r.description ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(r.original_amount)}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">{fmtPKR(r.paid_amount)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmtPKR(r.outstanding_amount ?? 0)}</TableCell>
                <TableCell>{r.due_date ? fmtDate(r.due_date) : "—"}</TableCell>
                <TableCell>{r.payment_date ? fmtDate(r.payment_date) : "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                {canManage && <TableCell className="text-right">{r.status !== "paid" && r.status !== "cancelled" && <PayDialog payable={r} />}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function NewPayableDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ category: "other", payee_name: "", description: "", original_amount: 0, due_date: "" });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("payables").insert({
        category: form.category, payee_name: form.payee_name || null, description: form.description || null,
        original_amount: Number(form.original_amount || 0), due_date: form.due_date || null, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payable added"); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><Plus className="w-4 h-4 mr-1" />New Payable</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New payable</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" className="col-span-2">
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Payee" className="col-span-2"><Input value={form.payee_name} onChange={e => setForm({ ...form, payee_name: e.target.value })} /></Field>
          <Field label="Amount"><Input type="number" step="0.01" value={form.original_amount} onChange={e => setForm({ ...form, original_amount: e.target.value })} /></Field>
          <Field label="Due date"><DateField value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })}/></Field>
          <Field label="Description" className="col-span-2"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    partial: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status}</Badge>;
}

function PayDialog({ payable }: { payable: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(Number(payable.outstanding_amount ?? 0)));

  const mut = useMutation({
    mutationFn: async () => {
      const paid = Number(payable.paid_amount || 0) + (Number(amount) || 0);
      const st = paid >= Number(payable.original_amount) ? "paid" : paid > 0 ? "partial" : "pending";
      const { error } = await sb.from("payables").update({ paid_amount: paid, payment_date: date, status: st }).eq("id", payable.id);
      if (error) throw error;
      // keep the linked source record in sync — no duplicate ledgers
      if (payable.commission_payable_id && st === "paid") {
        await sb.from("commission_payables").update({ status: "paid", paid_date: date }).eq("id", payable.commission_payable_id);
      }
      if (payable.tax_record_id) {
        await sb.from("tax_records").update({ paid_amount: paid, status: st === "paid" ? "paid" : st === "partial" ? "partial" : "unpaid" }).eq("id", payable.tax_record_id);
      }
      if (payable.category === "b2b_commission" && payable.deal_id && st === "paid") {
        await sb.from("deals").update({ b2b_transfer_status: "transferred", b2b_transfer_date: date }).eq("id", payable.deal_id);
      }
      const { data: u } = await supabase.auth.getUser();
      await sb.from("accounts_audit_log").insert({
        entity_type: "payable", entity_id: payable.id, action: "payment",
        actor_id: u.user?.id ?? null, new_value: { amount, date },
      });
    },
    onSuccess: () => { toast.success("Payment recorded"); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Record Payment</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record payable payment</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Payment date"><DateField value={date} onChange={(v) => setDate(v)}/></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-lg font-semibold mt-1 tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}
