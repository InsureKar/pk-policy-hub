import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtPKR, fmtDate } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/accounts/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["accounts-payments"],
    queryFn: async () => {
      const [p, recv] = await Promise.all([
        supabase.from("payments").select("*").order("payment_date", { ascending: false }),
        supabase.from("receivables").select("id,receivable_number,deal_id"),
      ]);
      return { rows: p.data ?? [], recvs: new Map((recv.data ?? []).map(r => [r.id, r])) };
    },
  });

  const filtered = useMemo(() => (data?.rows ?? []).filter(p => {
    if (method !== "all" && p.payment_method !== method) return false;
    if (from && p.payment_date < from) return false;
    if (to && p.payment_date > to) return false;
    if (search) {
      const r = data?.recvs.get(p.receivable_id);
      const hay = `${r?.receivable_number ?? ""} ${p.transaction_reference ?? ""} ${p.ibft_reference ?? ""} ${p.cheque_number ?? ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [data, search, method, from, to]);

  const exportCsv = () => {
    const headers = ["Date","Receivable","Amount","Method","Txn Ref","IBFT","Cheque","Voucher","Bank","Account"];
    const rows = filtered.map(p => [p.payment_date, data?.recvs.get(p.receivable_id)?.receivable_number ?? "", p.amount, p.payment_method, p.transaction_reference ?? "", p.ibft_reference ?? "", p.cheque_number ?? "", p.cash_voucher_number ?? "", p.receiving_bank ?? "", p.receiving_account ?? ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `payments-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const total = filtered.reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <Input placeholder="Search receivable / references" value={search} onChange={e => setSearch(e.target.value)}/>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
            <SelectItem value="ibft">IBFT</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)}/>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)}/>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1"/>Export CSV</Button>
      </CardContent></Card>

      <div className="text-sm text-muted-foreground">Total in view: <span className="font-medium text-foreground tabular-nums">{fmtPKR(total)}</span> across {filtered.length} payments</div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Receivable</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Txn Ref</TableHead>
            <TableHead>IBFT</TableHead>
            <TableHead>Cheque</TableHead>
            <TableHead>Bank</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>}
            {filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell>{fmtDate(p.payment_date)}</TableCell>
                <TableCell className="font-mono text-xs">{data?.recvs.get(p.receivable_id)?.receivable_number ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(p.amount)}</TableCell>
                <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                <TableCell className="text-xs">{p.transaction_reference ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.ibft_reference ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.cheque_number ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.receiving_bank ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
