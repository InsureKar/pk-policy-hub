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

export const Route = createFileRoute("/_app/accounts/payables")({
  component: PayablesPage,
});

function PayablesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data } = useQuery({
    queryKey: ["accounts-payables"],
    queryFn: async () => {
      const [p, profiles, deals] = await Promise.all([
        supabase.from("commission_payables").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name"),
        supabase.from("deals").select("id,deal_number"),
      ]);
      return {
        rows: p.data ?? [],
        profs: new Map((profiles.data ?? []).map(pr => [pr.id, pr.full_name])),
        deals: new Map((deals.data ?? []).map(d => [d.id, d.deal_number])),
      };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter(r => {
      if (status !== "all" && r.status !== status) return false;
      if (search) {
        const b = data?.profs.get(r.beneficiary_id) ?? "";
        const d = data?.deals.get(r.deal_id) ?? "";
        if (!(`${r.payable_number} ${b} ${d}`).toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, search, status]);

  const exportCsv = () => {
    const rows = filtered.map(r => [r.payable_number, data?.profs.get(r.beneficiary_id) ?? "", r.beneficiary_role, data?.deals.get(r.deal_id) ?? "", r.commission_amount, r.status, r.paid_date ?? ""]);
    const csv = [["Payable No","Beneficiary","Role","Deal","Amount","Status","Paid Date"], ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `payables-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input placeholder="Search payable / beneficiary / deal" value={search} onChange={e => setSearch(e.target.value)}/>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div></div>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1"/>Export CSV</Button>
      </CardContent></Card>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Payable</TableHead>
            <TableHead>Beneficiary</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Payable Date</TableHead>
            <TableHead>Paid Date</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center text-muted-foreground py-8">No payables</TableCell></TableRow>}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.payable_number}</TableCell>
                <TableCell>{data?.profs.get(r.beneficiary_id) ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{r.beneficiary_role === "do" ? "DO" : "Team Lead"}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{data?.deals.get(r.deal_id) ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(r.commission_amount)}</TableCell>
                <TableCell>{fmtDate(r.payable_date)}</TableCell>
                <TableCell>{r.paid_date ? fmtDate(r.paid_date) : "—"}</TableCell>
                <TableCell><StatusBadge status={r.status}/></TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {r.status === "pending" && <MarkPaidDialog payable={r}/>}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status}</Badge>;
}

function MarkPaidDialog({ payable }: { payable: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("bank_transfer");
  const [ref, setRef] = useState("");
  const [remarks, setRemarks] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commission_payables").update({
        status: "paid" as any, paid_date: date, payment_method: method as any, reference_number: ref || null, remarks: remarks || null,
      }).eq("id", payable.id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("accounts_audit_log").insert({
        entity_type: "payable", entity_id: payable.id, action: "mark_paid",
        actor_id: u.user?.id ?? null, new_value: { paid_date: date, method, ref } as any,
      });
    },
    onSuccess: () => { toast.success("Marked as paid"); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Mark Paid</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark payable paid — {payable.payable_number}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid date"><Input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>
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
          <Field label="Reference No." className="col-span-2"><Input value={ref} onChange={e => setRef(e.target.value)}/></Field>
          <Field label="Remarks" className="col-span-2"><Input value={remarks} onChange={e => setRemarks(e.target.value)}/></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Saving…" : "Mark Paid"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
