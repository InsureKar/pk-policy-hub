import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/accounts/tax")({
  component: TaxPage,
});

const TAX_LABEL: Record<string, string> = {
  income_tax: "Income Tax",
  sales_tax: "Sales Tax",
  marketing_budget_tax: "Marketing Budget Tax",
  commission_taker_tax: "Commission Taker Tax",
  b2b_commission_tax: "B2B Commission Tax",
};

const sb = supabase as any;

function TaxPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "management"]);
  const [type, setType] = useState("all");
  const [deal, setDeal] = useState("all");
  const [client, setClient] = useState("all");
  const [userF, setUserF] = useState("all");
  const [team, setTeam] = useState("all");
  const [product, setProduct] = useState("all");
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");

  const { data } = useQuery({
    queryKey: ["accounts-tax"],
    enabled: isAdmin,
    queryFn: async () => {
      const [t, deals, clients, profiles, teams, types] = await Promise.all([
        sb.from("tax_records").select("*").order("period_date", { ascending: false }),
        sb.from("deals").select("id,deal_number"),
        sb.from("clients").select("id,company_name,full_name"),
        sb.from("profiles").select("id,full_name"),
        sb.from("teams").select("id,name"),
        sb.from("insurance_types").select("id,name"),
      ]);
      return {
        rows: (t.data ?? []) as any[],
        deals: (deals.data ?? []) as any[],
        clients: (clients.data ?? []) as any[],
        profiles: (profiles.data ?? []) as any[],
        teams: (teams.data ?? []) as any[],
        types: (types.data ?? []) as any[],
      };
    },
  });

  const maps = useMemo(() => ({
    deals: new Map((data?.deals ?? []).map(d => [d.id, d.deal_number])),
    clients: new Map((data?.clients ?? []).map(c => [c.id, c.company_name || c.full_name])),
    profiles: new Map((data?.profiles ?? []).map(p => [p.id, p.full_name])),
    teams: new Map((data?.teams ?? []).map(t => [t.id, t.name])),
    types: new Map((data?.types ?? []).map(t => [t.id, t.name])),
  }), [data]);

  if (!isAdmin) return <Navigate to="/accounts" replace />;

  const statusOf = (r: any) => {
    const paid = Number(r.paid_amount || 0), amt = Number(r.amount || 0);
    if (paid >= amt && amt > 0) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };

  const rows = (data?.rows ?? []).filter(r => {
    if (type !== "all" && r.tax_type !== type) return false;
    if (deal !== "all" && r.deal_id !== deal) return false;
    if (client !== "all" && r.client_id !== client) return false;
    if (userF !== "all" && r.deducted_from !== userF) return false;
    if (team !== "all" && r.team_id !== team) return false;
    if (product !== "all" && r.insurance_type_id !== product) return false;
    if (status !== "all" && statusOf(r) !== status) return false;
    const d = String(r.period_date ?? "");
    if (year !== "all" && d.slice(0, 4) !== year) return false;
    if (month !== "all" && d.slice(5, 7) !== month) return false;
    return true;
  });

  const totals = rows.reduce((a, r) => {
    a.amount += Number(r.amount || 0);
    a.paid += Number(r.paid_amount || 0);
    a.outstanding += Math.max(0, Number(r.amount || 0) - Number(r.paid_amount || 0));
    a.byType[r.tax_type] = (a.byType[r.tax_type] ?? 0) + Number(r.amount || 0);
    return a;
  }, { amount: 0, paid: 0, outstanding: 0, byType: {} as Record<string, number> });

  const years = Array.from(new Set((data?.rows ?? []).map(r => String(r.period_date ?? "").slice(0, 4)).filter(Boolean))).sort().reverse();

  const exportCsv = () => {
    const head = ["Tax Type", "Deal", "Client", "Deducted From", "Team", "Product", "Base", "Rate %", "Amount", "Paid", "Outstanding", "Status", "Date"];
    const body = rows.map(r => [TAX_LABEL[r.tax_type] ?? r.tax_type, maps.deals.get(r.deal_id) ?? "", maps.clients.get(r.client_id) ?? "",
      maps.profiles.get(r.deducted_from) ?? "", maps.teams.get(r.team_id) ?? "", maps.types.get(r.insurance_type_id) ?? "",
      r.base_amount, r.rate, r.amount, r.paid_amount, Number(r.amount) - Number(r.paid_amount), statusOf(r), r.period_date]);
    const csv = [head, ...body].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `tax-records-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI label="All Taxes" value={fmtPKR(totals.amount)} />
        <KPI label="Income Tax" value={fmtPKR(totals.byType["income_tax"] ?? 0)} />
        <KPI label="Sales Tax" value={fmtPKR(totals.byType["sales_tax"] ?? 0)} />
        <KPI label="Marketing Budget Tax" value={fmtPKR(totals.byType["marketing_budget_tax"] ?? 0)} />
        <KPI label="Commission Taker Tax" value={fmtPKR((totals.byType["commission_taker_tax"] ?? 0) + (totals.byType["b2b_commission_tax"] ?? 0))} />
        <KPI label="Tax Payable (outstanding)" value={fmtPKR(totals.outstanding)} tone="danger" />
      </div>

      <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <F label="Tax type"><Sel value={type} onChange={setType} options={[["all", "All Taxes"], ...Object.entries(TAX_LABEL)]} /></F>
        <F label="Deal"><Sel value={deal} onChange={setDeal} options={[["all", "All deals"], ...(data?.deals ?? []).map(d => [d.id, d.deal_number] as [string, string])]} /></F>
        <F label="Client"><Sel value={client} onChange={setClient} options={[["all", "All clients"], ...(data?.clients ?? []).map(c => [c.id, c.company_name || c.full_name] as [string, string])]} /></F>
        <F label="User"><Sel value={userF} onChange={setUserF} options={[["all", "All users"], ...(data?.profiles ?? []).map(p => [p.id, p.full_name] as [string, string])]} /></F>
        <F label="Team"><Sel value={team} onChange={setTeam} options={[["all", "All teams"], ...(data?.teams ?? []).map(t => [t.id, t.name] as [string, string])]} /></F>
        <F label="Product"><Sel value={product} onChange={setProduct} options={[["all", "All products"], ...(data?.types ?? []).map(t => [t.id, t.name] as [string, string])]} /></F>
        <F label="Month"><Sel value={month} onChange={setMonth} options={[["all", "All months"], ...Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, "0"), new Date(2000, i, 1).toLocaleString("en", { month: "long" })] as [string, string])]} /></F>
        <F label="Year"><Sel value={year} onChange={setYear} options={[["all", "All years"], ...years.map(y => [y, y] as [string, string])]} /></F>
        <F label="Payment status"><Sel value={status} onChange={setStatus} options={[["all", "All"], ["paid", "Paid"], ["unpaid", "Unpaid"], ["partial", "Partial"]]} /></F>
        <div className="flex items-end"><Button variant="outline" className="w-full" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />Export CSV</Button></div>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tax Type</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Deducted From</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Base</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">No tax records</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{TAX_LABEL[r.tax_type] ?? r.tax_type}</TableCell>
                <TableCell className="font-mono text-xs">{maps.deals.get(r.deal_id) ?? "—"}</TableCell>
                <TableCell>{maps.clients.get(r.client_id) ?? "—"}</TableCell>
                <TableCell>{maps.profiles.get(r.deducted_from) ?? "—"}</TableCell>
                <TableCell>{maps.types.get(r.insurance_type_id) ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(r.base_amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.rate)}%</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmtPKR(r.amount)}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">{fmtPKR(r.paid_amount)}</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{fmtPKR(Math.max(0, Number(r.amount) - Number(r.paid_amount)))}</TableCell>
                <TableCell>{fmtDate(r.period_date)}</TableCell>
                <TableCell><StatusBadge status={statusOf(r)} /></TableCell>
                <TableCell className="text-right">{statusOf(r) !== "paid" && <PayTaxDialog record={r} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function PayTaxDialog({ record }: { record: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.max(0, Number(record.amount) - Number(record.paid_amount))));

  const mut = useMutation({
    mutationFn: async () => {
      const paid = Number(record.paid_amount || 0) + (Number(amount) || 0);
      const st = paid >= Number(record.amount) ? "paid" : paid > 0 ? "partial" : "unpaid";
      const { error } = await sb.from("tax_records").update({ paid_amount: paid, status: st }).eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tax payment recorded"); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Record Payment</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record tax payment</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Amount (PKR)</Label>
          <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
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
    unpaid: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    partial: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status}</Badge>;
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-lg font-semibold mt-1 tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}
