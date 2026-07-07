import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtPKR, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/accounts/installments")({
  component: InstallmentsPage,
});

function InstallmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data } = useQuery({
    queryKey: ["accounts-installments"],
    queryFn: async () => {
      const [inst, recv] = await Promise.all([
        supabase.from("installments").select("*").order("due_date"),
        supabase.from("receivables").select("id,receivable_number,deal_id"),
      ]);
      return {
        rows: inst.data ?? [],
        recvs: new Map((recv.data ?? []).map(r => [r.id, r])),
      };
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    return (data?.rows ?? []).filter(i => {
      const effStatus = i.status === "pending" && i.due_date < today ? "overdue" : i.status;
      if (status !== "all" && effStatus !== status) return false;
      if (search) {
        const r = data?.recvs.get(i.receivable_id);
        if (!(r?.receivable_number ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, search, status, today]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input placeholder="Search receivable number" value={search} onChange={e => setSearch(e.target.value)}/>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Receivable</TableHead>
            <TableHead>#</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No installments</TableCell></TableRow>}
            {filtered.map(i => {
              const overdue = i.status === "pending" && i.due_date < today;
              const eff = overdue ? "overdue" : i.status;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{data?.recvs.get(i.receivable_id)?.receivable_number ?? "—"}</TableCell>
                  <TableCell>{i.installment_number}</TableCell>
                  <TableCell>{fmtDate(i.due_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(i.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(i.paid_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtPKR(i.remaining_amount)}</TableCell>
                  <TableCell><StatusBadge status={eff}/></TableCell>
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
    pending: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    partial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    overdue: "bg-red-500/15 text-red-600 border-red-500/30",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status}</Badge>;
}
