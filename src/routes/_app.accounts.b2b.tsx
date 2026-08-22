import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/accounts/b2b")({
  component: B2BPage,
});

const sb = supabase as any;

function B2BPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "management"]);

  const { data } = useQuery({
    queryKey: ["accounts-b2b"],
    enabled: isAdmin,
    queryFn: async () => {
      const [deals, profiles] = await Promise.all([
        sb.from("deals").select("id,deal_number,gross_premium,b2b_commission,b2b_commission_type,b2b_commission_percentage,b2b_taker_id,b2b_tax_deduct,b2b_tax_rate,b2b_tax_amount,b2b_net_amount,b2b_transfer_status,b2b_transfer_date")
          .gt("b2b_commission", 0).order("created_at", { ascending: false }),
        sb.from("profiles").select("id,full_name"),
      ]);
      return {
        rows: (deals.data ?? []) as any[],
        profs: new Map(((profiles.data ?? []) as any[]).map(p => [p.id, p.full_name])),
      };
    },
  });

  if (!isAdmin) return <Navigate to="/accounts" replace />;

  const rows = data?.rows ?? [];
  const totals = rows.reduce((a, r) => ({
    gross: a.gross + Number(r.b2b_commission || 0),
    tax: a.tax + Number(r.b2b_tax_amount || 0),
    net: a.net + Number(r.b2b_net_amount || 0),
    pending: a.pending + (r.b2b_transfer_status === "transferred" ? 0 : Number(r.b2b_net_amount || 0)),
  }), { gross: 0, tax: 0, net: 0, pending: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Gross B2B Commission" value={fmtPKR(totals.gross)} />
        <KPI label="Tax Deducted" value={fmtPKR(totals.tax)} />
        <KPI label="Net Commission" value={fmtPKR(totals.net)} />
        <KPI label="Pending Transfer" value={fmtPKR(totals.pending)} tone="danger" />
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>B2B Commission Taker</TableHead>
            <TableHead className="text-right">Commission %</TableHead>
            <TableHead className="text-right">Gross B2B Commission</TableHead>
            <TableHead>Tax Deduction</TableHead>
            <TableHead className="text-right">Tax Rate</TableHead>
            <TableHead className="text-right">Tax Amount</TableHead>
            <TableHead className="text-right">Net Commission</TableHead>
            <TableHead>Transfer Status</TableHead>
            <TableHead>Transfer Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No B2B commissions</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.deal_number}</TableCell>
                <TableCell>{data?.profs.get(r.b2b_taker_id) ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.b2b_commission_type === "percentage" ? `${Number(r.b2b_commission_percentage)}%` : "Fixed"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(r.b2b_commission)}</TableCell>
                <TableCell>{r.b2b_tax_deduct ? <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                <TableCell className="text-right tabular-nums">{r.b2b_tax_deduct ? `${Number(r.b2b_tax_rate)}%` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(r.b2b_tax_amount)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmtPKR(r.b2b_net_amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={r.b2b_transfer_status === "transferred" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-amber-500/15 text-amber-600 border-amber-500/30"}>
                    {r.b2b_transfer_status}
                  </Badge>
                </TableCell>
                <TableCell>{r.b2b_transfer_date ? fmtDate(r.b2b_transfer_date) : "—"}</TableCell>
                <TableCell className="text-right"><ProcessDialog deal={r} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">
        Deducted tax automatically creates a linked Tax Payable record against the B2B commission taker, and the net amount becomes a B2B Commission Payable in the Payables ledger.
      </p>
    </div>
  );
}

function ProcessDialog({ deal }: { deal: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deduct, setDeduct] = useState(!!deal.b2b_tax_deduct);
  const [rate, setRate] = useState(String(Number(deal.b2b_tax_rate ?? 0)));
  const [transferred, setTransferred] = useState(deal.b2b_transfer_status === "transferred");
  const [date, setDate] = useState(deal.b2b_transfer_date ?? new Date().toISOString().slice(0, 10));

  const gross = Number(deal.b2b_commission || 0);
  const tax = deduct ? Math.round(gross * (Number(rate) || 0)) / 100 : 0;
  const net = Math.max(0, gross - tax);

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("deals").update({
        b2b_tax_deduct: deduct,
        b2b_tax_rate: deduct ? Number(rate) || 0 : 0,
        b2b_transfer_status: transferred ? "transferred" : "pending",
        b2b_transfer_date: transferred ? date : null,
      }).eq("id", deal.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("B2B commission updated"); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Process</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>B2B commission — {deal.deal_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Deduct tax from commission?</Label>
              <p className="text-xs text-muted-foreground">Accountant controlled</p>
            </div>
            <Switch checked={deduct} onCheckedChange={setDeduct} />
          </div>
          {deduct && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax rate (%)</Label>
              <Input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
          )}
          <div className="rounded-md border p-3 space-y-1 text-sm">
            <Row k="Gross B2B Commission" v={fmtPKR(gross)} />
            <Row k={`Tax${deduct ? ` (${Number(rate) || 0}%)` : ""}`} v={fmtPKR(tax)} />
            <Row k="Net Commission" v={fmtPKR(net)} bold />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="text-sm">Transferred to commission taker</Label>
            <Switch checked={transferred} onCheckedChange={setTransferred} />
          </div>
          {transferred && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transfer date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{v}</span></div>;
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-lg font-semibold mt-1 tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}
