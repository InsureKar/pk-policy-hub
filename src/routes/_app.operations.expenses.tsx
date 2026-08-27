import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Upload } from "lucide-react";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { DateField } from "@/components/DateField";

export const Route = createFileRoute("/_app/operations/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ amount: 0, tax_amount: 0, expense_date: new Date().toISOString().slice(0,10) });
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState("all");

  if (!hasRole(["admin", "management"])) return <Navigate to="/operations/reimbursements" replace />;

  const { data } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const sb = supabase as any;
      const [ex, cats] = await Promise.all([
        sb.from("expenses").select("*").order("expense_date", { ascending: false }),
        sb.from("expense_categories").select("*").order("name"),
      ]);
      return { expenses: ex.data ?? [], categories: cats.data ?? [] };
    },
  });

  const rootCats = (data?.categories ?? []).filter((c: any) => !c.parent_id);
  const subCats = (data?.categories ?? []).filter((c: any) => c.parent_id === form.category_id);
  const catMap = new Map<string, any>((data?.categories ?? []).map((c: any) => [c.id, c]));

  const filtered = useMemo(() => {
    const list = data?.expenses ?? [];
    if (filter === "all") return list;
    return list.filter((e: any) => {
      const c = catMap.get(e.category_id);
      return c?.slug === filter;
    });
  }, [data, filter]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s: number, e: any) => s + Number(e.amount || 0) + Number(e.tax_amount || 0), 0);
    return { total, count: filtered.length };
  }, [filtered]);

  const submit = async () => {
    if (!form.category_id) return toast.error("Category required");
    if (!form.amount) return toast.error("Amount required");
    let attachment_url: string | null = null;
    if (file) {
      const path = `expenses/${user?.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
      if (upErr) return toast.error(upErr.message);
      attachment_url = path;
    }
    const { error } = await (supabase as any).from("expenses").insert({
      category_id: form.category_id, subcategory_id: form.subcategory_id || null,
      amount: Number(form.amount || 0), tax_amount: Number(form.tax_amount || 0),
      vendor: form.vendor || null, invoice_number: form.invoice_number || null,
      payment_method: form.payment_method || null, payment_date: form.payment_date || null,
      expense_date: form.expense_date, attachment_url, remarks: form.remarks || null,
      approval_status: "approved", approved_by: user?.id, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Expense recorded");
    setOpen(false);
    setForm({ amount: 0, tax_amount: 0, expense_date: new Date().toISOString().slice(0,10) });
    setFile(null);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1">
          <Label className="text-xs">Filter by category</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-64"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {rootCats.map((c: any) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">{totals.count} entries · <span className="font-medium text-foreground">{fmtPKR(totals.total)}</span></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1"/>New Expense</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Category *">
                <Select value={form.category_id ?? ""} onValueChange={v => setForm({ ...form, category_id: v, subcategory_id: null })}>
                  <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                  <SelectContent>{rootCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Subcategory">
                <Select value={form.subcategory_id ?? ""} onValueChange={v => setForm({ ...form, subcategory_id: v })} disabled={!form.category_id}>
                  <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                  <SelectContent>{subCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Amount *"><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></F>
              <F label="Tax"><Input type="number" value={form.tax_amount} onChange={e => setForm({ ...form, tax_amount: e.target.value })}/></F>
              <F label="Vendor"><Input value={form.vendor ?? ""} onChange={e => setForm({ ...form, vendor: e.target.value })}/></F>
              <F label="Invoice #"><Input value={form.invoice_number ?? ""} onChange={e => setForm({ ...form, invoice_number: e.target.value })}/></F>
              <F label="Payment Method"><Input value={form.payment_method ?? ""} onChange={e => setForm({ ...form, payment_method: e.target.value })}/></F>
              <F label="Expense Date *"><DateField value={form.expense_date} onChange={(v) => setForm({ ...form, expense_date: v })}/></F>
              <F label="Payment Date"><DateField value={form.payment_date ?? ""} onChange={(v) => setForm({ ...form, payment_date: v })}/></F>
              <F label="Attachment"><Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}/></F>
              <div className="col-span-2"><F label="Remarks"><Textarea rows={2} value={form.remarks ?? ""} onChange={e => setForm({ ...form, remarks: e.target.value })}/></F></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((e: any) => {
              const cat = catMap.get(e.category_id);
              const sub = catMap.get(e.subcategory_id);
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.expense_code}</TableCell>
                  <TableCell>{fmtDate(e.expense_date)}</TableCell>
                  <TableCell>{cat?.name}{sub && <span className="text-muted-foreground"> › {sub.name}</span>}</TableCell>
                  <TableCell>{e.vendor || "—"}</TableCell>
                  <TableCell>{e.invoice_number || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(e.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(e.tax_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtPKR(Number(e.amount) + Number(e.tax_amount))}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No expenses</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
