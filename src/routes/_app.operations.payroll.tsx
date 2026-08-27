import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtPKR } from "@/lib/format";
import { toast } from "sonner";
import { DateField } from "@/components/DateField";

export const Route = createFileRoute("/_app/operations/payroll")({
  component: PayrollPage,
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function PayrollPage() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [empDialog, setEmpDialog] = useState<any | null>(null);
  const [payDialog, setPayDialog] = useState<any | null>(null);

  if (!hasRole(["admin", "management"])) return <Navigate to="/operations/reimbursements" replace />;

  const { data } = useQuery({
    queryKey: ["payroll", year, month],
    queryFn: async () => {
      const sb = supabase as any;
      const [profs, runs] = await Promise.all([
        sb.from("profiles").select("*").order("full_name"),
        sb.from("payroll_runs").select("*").eq("period_year", year).eq("period_month", month),
      ]);
      const runByProf = new Map((runs.data ?? []).map((r: any) => [r.profile_id, r]));
      return { profiles: profs.data ?? [], runByProf };
    },
  });

  const saveEmp = async () => {
    const p = empDialog;
    const { error } = await (supabase as any).from("profiles").update({
      department: p.department, designation: p.designation,
      monthly_salary: Number(p.monthly_salary || 0),
      salary_tax_percentage: Number(p.salary_tax_percentage || 0),
      default_allowances: Number(p.default_allowances || 0),
      default_deductions: Number(p.default_deductions || 0),
      joining_date: p.joining_date || null,
      employment_status: p.employment_status || "active",
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Employee updated");
    setEmpDialog(null);
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };

  const runPayroll = async (prof: any) => {
    const gross = Number(prof.monthly_salary || 0);
    const tax = gross * Number(prof.salary_tax_percentage || 0) / 100;
    const allowances = Number(prof.default_allowances || 0);
    const deductions = Number(prof.default_deductions || 0);
    const { error } = await (supabase as any).from("payroll_runs").insert({
      profile_id: prof.id, period_year: year, period_month: month,
      gross_salary: gross, tax_amount: tax, deductions, bonuses: 0, allowances,
      status: "pending", created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Payroll generated");
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };

  const markPaid = async () => {
    const r = payDialog;
    const { error } = await (supabase as any).from("payroll_runs").update({
      status: "paid", paid_at: new Date().toISOString(),
      payment_method: r.payment_method, reference_number: r.reference_number, remarks: r.remarks,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    setPayDialog(null);
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };

  const rows = useMemo(() => (data?.profiles ?? []).map((p: any) => ({
    ...p, run: data?.runByProf.get(p.id),
  })), [data]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs">Year</Label>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue/></SelectTrigger>
            <SelectContent>
              {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Month</Label>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Tax %</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => {
              const gross = Number(r.monthly_salary || 0);
              const tax = gross * Number(r.salary_tax_percentage || 0) / 100;
              const net = gross - tax + Number(r.default_allowances || 0) - Number(r.default_deductions || 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || r.email}</TableCell>
                  <TableCell>{r.department || "—"}</TableCell>
                  <TableCell>{r.designation || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(gross)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.salary_tax_percentage || 0}%</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtPKR(r.run?.net_salary ?? net)}</TableCell>
                  <TableCell>
                    {r.run ? <Badge variant={r.run.status === "paid" ? "default" : "outline"}>{r.run.status}</Badge>
                           : <span className="text-xs text-muted-foreground">not generated</span>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setEmpDialog({ ...r })}>Edit</Button>
                    {!r.run && <Button size="sm" variant="outline" onClick={() => runPayroll(r)}>Generate</Button>}
                    {r.run && r.run.status !== "paid" && <Button size="sm" onClick={() => setPayDialog({ ...r.run })}>Mark Paid</Button>}
                    {r.run && <Button size="sm" variant="ghost" onClick={() => printPayslip(r, r.run, year, month)}>Payslip</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No employees</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!empDialog} onOpenChange={o => !o && setEmpDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Compensation — {empDialog?.full_name || empDialog?.email}</DialogTitle></DialogHeader>
          {empDialog && (
            <div className="grid grid-cols-2 gap-3">
              <F label="Department"><Input value={empDialog.department ?? ""} onChange={e => setEmpDialog({ ...empDialog, department: e.target.value })}/></F>
              <F label="Designation"><Input value={empDialog.designation ?? ""} onChange={e => setEmpDialog({ ...empDialog, designation: e.target.value })}/></F>
              <F label="Monthly Salary"><Input type="number" value={empDialog.monthly_salary ?? 0} onChange={e => setEmpDialog({ ...empDialog, monthly_salary: e.target.value })}/></F>
              <F label="Salary Tax %"><Input type="number" step="0.01" value={empDialog.salary_tax_percentage ?? 0} onChange={e => setEmpDialog({ ...empDialog, salary_tax_percentage: e.target.value })}/></F>
              <F label="Default Allowances"><Input type="number" value={empDialog.default_allowances ?? 0} onChange={e => setEmpDialog({ ...empDialog, default_allowances: e.target.value })}/></F>
              <F label="Default Deductions"><Input type="number" value={empDialog.default_deductions ?? 0} onChange={e => setEmpDialog({ ...empDialog, default_deductions: e.target.value })}/></F>
              <F label="Joining Date"><DateField value={empDialog.joining_date ?? ""} onChange={(v) => setEmpDialog({ ...empDialog, joining_date: v })}/></F>
              <F label="Employment Status">
                <Select value={empDialog.employment_status ?? "active"} onValueChange={v => setEmpDialog({ ...empDialog, employment_status: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEmpDialog(null)}>Cancel</Button><Button onClick={saveEmp}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payDialog} onOpenChange={o => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Salary Paid</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-3">
              <F label="Payment Method"><Input value={payDialog.payment_method ?? ""} onChange={e => setPayDialog({ ...payDialog, payment_method: e.target.value })}/></F>
              <F label="Reference #"><Input value={payDialog.reference_number ?? ""} onChange={e => setPayDialog({ ...payDialog, reference_number: e.target.value })}/></F>
              <F label="Remarks"><Input value={payDialog.remarks ?? ""} onChange={e => setPayDialog({ ...payDialog, remarks: e.target.value })}/></F>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setPayDialog(null)}>Cancel</Button><Button onClick={markPaid}>Confirm Paid</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function printPayslip(p: any, r: any, y: number, m: number) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>Payslip ${p.full_name} ${MONTHS[m-1]} ${y}</title>
    <style>body{font-family:system-ui;padding:32px;max-width:640px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:6px 8px;border-bottom:1px solid #eee}.tot{font-weight:600;background:#f8f8f8}</style>
    </head><body>
    <h1>Payslip — ${MONTHS[m-1]} ${y}</h1>
    <div style="color:#666">${p.full_name || p.email} · ${p.designation || ""} · ${p.department || ""}</div>
    <table>
      <tr><td>Gross Salary</td><td style="text-align:right">${fmtPKR(r.gross_salary)}</td></tr>
      <tr><td>Tax</td><td style="text-align:right">− ${fmtPKR(r.tax_amount)}</td></tr>
      <tr><td>Deductions</td><td style="text-align:right">− ${fmtPKR(r.deductions)}</td></tr>
      <tr><td>Allowances</td><td style="text-align:right">+ ${fmtPKR(r.allowances)}</td></tr>
      <tr><td>Bonuses</td><td style="text-align:right">+ ${fmtPKR(r.bonuses)}</td></tr>
      <tr class="tot"><td>Net Salary</td><td style="text-align:right">${fmtPKR(r.net_salary)}</td></tr>
      <tr><td>Status</td><td style="text-align:right">${r.status}</td></tr>
    </table>
    <script>window.print()</script></body></html>`);
  w.document.close();
}
