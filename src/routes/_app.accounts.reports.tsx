import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtPKR } from "@/lib/format";
import { Download } from "lucide-react";
import { DateField } from "@/components/DateField";

export const Route = createFileRoute("/_app/accounts/reports")({
  component: ReportsPage,
});

type ReportType = "receivables"|"payables"|"commission"|"collections"|"outstanding"|"overdue"|"monthly_revenue"|"company"|"product"|"team"|"do";

function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("receivables");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["accounts-reports"],
    queryFn: async () => {
      const [recv, pay, payables, deals, cos, types, teams, profs] = await Promise.all([
        supabase.from("receivables").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("commission_payables").select("*"),
        supabase.from("deals").select("id,deal_number,gross_premium,net_premium,insurance_company_id,insurance_type_id,team_id,assigned_do_id"),
        supabase.from("insurance_companies").select("id,name"),
        supabase.from("insurance_types").select("id,name"),
        supabase.from("teams").select("id,name"),
        supabase.from("profiles").select("id,full_name"),
      ]);
      return {
        recv: recv.data ?? [], pay: pay.data ?? [], payables: payables.data ?? [],
        deals: new Map((deals.data ?? []).map(d => [d.id, d])),
        cos: new Map((cos.data ?? []).map(c => [c.id, c.name])),
        types: new Map((types.data ?? []).map(t => [t.id, t.name])),
        teams: new Map((teams.data ?? []).map(t => [t.id, t.name])),
        profs: new Map((profs.data ?? []).map(p => [p.id, p.full_name])),
      };
    },
  });

  const inRange = (dateStr?: string | null) => {
    if (!dateStr) return true;
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  };

  const report = useMemo(() => {
    if (!data) return { columns: [], rows: [] as any[][] };
    const today = new Date().toISOString().slice(0, 10);
    switch (reportType) {
      case "receivables": {
        const rows = data.recv.filter(r => inRange(r.created_at?.slice(0,10)));
        return {
          columns: ["Receivable", "Premium Receivable", "Paid", "Outstanding", "Status"],
          rows: rows.map(r => [r.receivable_number, fmtPKR(r.total_amount), fmtPKR(r.paid_amount), fmtPKR(r.outstanding_amount), r.status]),
        };
      }
      case "payables": {
        const rows = data.payables.filter(p => inRange(p.created_at?.slice(0,10)));
        return {
          columns: ["Payable","Beneficiary","Amount","Status","Paid Date"],
          rows: rows.map(p => [p.payable_number, data.profs.get(p.beneficiary_id) ?? "—", fmtPKR(p.commission_amount), p.status, p.paid_date ?? "—"]),
        };
      }
      case "commission": {
        const rows = data.payables.filter(p => inRange(p.created_at?.slice(0,10)));
        return {
          columns: ["Beneficiary","Role","Total Commission","Paid","Pending"],
          rows: Array.from(rows.reduce((m, p) => {
            const k = p.beneficiary_id;
            const cur = m.get(k) ?? { total: 0, paid: 0, pending: 0 };
            cur.total += Number(p.commission_amount);
            if (p.status === "paid") cur.paid += Number(p.commission_amount); else cur.pending += Number(p.commission_amount);
            m.set(k, cur); return m;
          }, new Map<string, { total: number; paid: number; pending: number }>()).entries()).map(([k, v]) => [data.profs.get(k) ?? "—", "", fmtPKR(v.total), fmtPKR(v.paid), fmtPKR(v.pending)]),
        };
      }
      case "collections": {
        const rows = data.pay.filter(p => inRange(p.payment_date));
        return { columns: ["Date","Receivable","Amount","Method"], rows: rows.map(p => [p.payment_date, p.receivable_id.slice(0,8), fmtPKR(p.amount), p.payment_method]) };
      }
      case "outstanding": {
        const rows = data.recv.filter(r => Number(r.outstanding_amount) > 0);
        return { columns: ["Receivable","Total","Outstanding","Due Date","Status"], rows: rows.map(r => [r.receivable_number, fmtPKR(r.total_amount), fmtPKR(r.outstanding_amount), r.first_due_date ?? "—", r.status]) };
      }
      case "overdue": {
        const rows = data.recv.filter(r => Number(r.outstanding_amount) > 0 && r.first_due_date && r.first_due_date < today);
        return { columns: ["Receivable","Outstanding","Due Date","Days Overdue"], rows: rows.map(r => [r.receivable_number, fmtPKR(r.outstanding_amount), r.first_due_date, Math.floor((Date.now() - new Date(r.first_due_date as string).getTime()) / 86400000)]) };
      }
      case "monthly_revenue": {
        const map: Record<string, number> = {};
        data.pay.filter(p => inRange(p.payment_date)).forEach(p => {
          const k = p.payment_date.slice(0,7);
          map[k] = (map[k] ?? 0) + Number(p.amount);
        });
        return { columns: ["Month","Collections"], rows: Object.entries(map).sort().map(([m, v]) => [m, fmtPKR(v)]) };
      }
      case "company": {
        const map: Record<string, number> = {};
        data.pay.filter(p => inRange(p.payment_date)).forEach(p => {
          const r = data.recv.find(x => x.id === p.receivable_id);
          const d = r ? data.deals.get(r.deal_id) : null;
          const name = d?.insurance_company_id ? data.cos.get(d.insurance_company_id) : "—";
          map[name ?? "—"] = (map[name ?? "—"] ?? 0) + Number(p.amount);
        });
        return { columns: ["Company","Collections"], rows: Object.entries(map).map(([n, v]) => [n, fmtPKR(v)]) };
      }
      case "product": {
        const map: Record<string, number> = {};
        data.pay.filter(p => inRange(p.payment_date)).forEach(p => {
          const r = data.recv.find(x => x.id === p.receivable_id);
          const d = r ? data.deals.get(r.deal_id) : null;
          const name = d?.insurance_type_id ? data.types.get(d.insurance_type_id) : "—";
          map[name ?? "—"] = (map[name ?? "—"] ?? 0) + Number(p.amount);
        });
        return { columns: ["Product","Collections"], rows: Object.entries(map).map(([n, v]) => [n, fmtPKR(v)]) };
      }
      case "team": {
        const map: Record<string, number> = {};
        data.pay.filter(p => inRange(p.payment_date)).forEach(p => {
          const r = data.recv.find(x => x.id === p.receivable_id);
          const name = r?.team_id ? data.teams.get(r.team_id) : "—";
          map[name ?? "—"] = (map[name ?? "—"] ?? 0) + Number(p.amount);
        });
        return { columns: ["Team","Collections"], rows: Object.entries(map).map(([n, v]) => [n, fmtPKR(v)]) };
      }
      case "do": {
        const map: Record<string, number> = {};
        data.pay.filter(p => inRange(p.payment_date)).forEach(p => {
          const r = data.recv.find(x => x.id === p.receivable_id);
          const name = r?.assigned_do_id ? data.profs.get(r.assigned_do_id) : "—";
          map[name ?? "—"] = (map[name ?? "—"] ?? 0) + Number(p.amount);
        });
        return { columns: ["Development Officer","Collections"], rows: Object.entries(map).map(([n, v]) => [n, fmtPKR(v)]) };
      }
    }
  }, [data, reportType, from, to]);

  const exportCsv = () => {
    const csv = [report.columns, ...report.rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${reportType}-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const doPrint = () => {
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    const html = `<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:system-ui;font-size:12px">
      <thead><tr>${report.columns.map(c => `<th style="background:#eee">${c}</th>`).join("")}</tr></thead>
      <tbody>${report.rows.map(r => `<tr>${r.map((v: any) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    w.document.write(`<html><head><title>${reportType}</title></head><body><h2>${reportType.replace(/_/g," ")}</h2>${html}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="receivables">Premium Receivables</SelectItem>
            <SelectItem value="payables">Payables</SelectItem>
            <SelectItem value="commission">Commission</SelectItem>
            <SelectItem value="collections">Collections</SelectItem>
            <SelectItem value="outstanding">Outstanding Payments</SelectItem>
            <SelectItem value="overdue">Overdue Payments</SelectItem>
            <SelectItem value="monthly_revenue">Monthly Revenue</SelectItem>
            <SelectItem value="company">Company-wise Collections</SelectItem>
            <SelectItem value="product">Product-wise Collections</SelectItem>
            <SelectItem value="team">Team-wise Collections</SelectItem>
            <SelectItem value="do">DO-wise Collections</SelectItem>
          </SelectContent>
        </Select>
        <DateField value={from} onChange={(v) => setFrom(v)}/>
        <DateField value={to} onChange={(v) => setTo(v)}/>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1"/>CSV</Button>
        <Button variant="outline" onClick={doPrint}>Print / PDF</Button>
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base capitalize">{reportType.replace(/_/g, " ")}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>{report.columns.map(c => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {report.rows.length === 0 && <TableRow><TableCell colSpan={report.columns.length} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
              {report.rows.map((r, i) => <TableRow key={i}>{r.map((v: any, j: number) => <TableCell key={j}>{v}</TableCell>)}</TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
