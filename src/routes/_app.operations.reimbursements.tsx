import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/operations/reimbursements")({
  component: ReimbursementsPage,
});

function ReimbursementsPage() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole(["admin", "management"]);
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ amount: 0, expense_date: new Date().toISOString().slice(0,10) });
  const [file, setFile] = useState<File | null>(null);

  const { data } = useQuery({
    queryKey: ["reimbursements"],
    queryFn: async () => {
      const sb = supabase as any;
      const [rmb, profs, cats] = await Promise.all([
        sb.from("reimbursements").select("*").order("created_at", { ascending: false }),
        sb.from("profiles").select("id, full_name, email"),
        sb.from("expense_categories").select("id, name, parent_id"),
      ]);
      return {
        rows: rmb.data ?? [],
        profs: new Map<string, any>((profs.data ?? []).map((p: any) => [p.id, p])),
        cats: (cats.data ?? []).filter((c: any) => !c.parent_id),
        catMap: new Map<string, any>((cats.data ?? []).map((c: any) => [c.id, c])),
      };
    },
  });

  const submit = async () => {
    if (!form.description || !form.amount) return toast.error("Description and amount required");
    let attachment_url: string | null = null;
    if (file) {
      const path = `reimbursements/${user?.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
      if (upErr) return toast.error(upErr.message);
      attachment_url = path;
    }
    const { error } = await (supabase as any).from("reimbursements").insert({
      employee_id: user?.id, created_by: user?.id,
      category_id: form.category_id || null,
      description: form.description, amount: Number(form.amount || 0),
      expense_date: form.expense_date, attachment_url, remarks: form.remarks || null,
      status: "submitted", submitted_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Submitted");
    setOpen(false);
    setForm({ amount: 0, expense_date: new Date().toISOString().slice(0,10) });
    setFile(null);
    qc.invalidateQueries({ queryKey: ["reimbursements"] });
  };

  const setStatus = async (id: string, patch: any) => {
    const { error } = await (supabase as any).from("reimbursements").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setReviewing(null);
    qc.invalidateQueries({ queryKey: ["reimbursements"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{isAdmin ? "All reimbursement requests" : "Your reimbursement requests"}</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1"/>New Reimbursement</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Submit Reimbursement</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Category">
                <Select value={form.category_id ?? ""} onValueChange={v => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                  <SelectContent>{(data?.cats ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Amount *"><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></F>
              <F label="Expense Date *"><Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}/></F>
              <F label="Attachment"><Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}/></F>
              <div className="col-span-2"><F label="Description *"><Textarea rows={2} value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })}/></F></div>
              <div className="col-span-2"><F label="Remarks"><Textarea rows={2} value={form.remarks ?? ""} onChange={e => setForm({ ...form, remarks: e.target.value })}/></F></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.request_code}</TableCell>
                <TableCell>{data?.profs.get(r.employee_id)?.full_name ?? "—"}</TableCell>
                <TableCell>{data?.catMap.get(r.category_id)?.name ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                <TableCell>{fmtDate(r.expense_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPKR(r.amount)}</TableCell>
                <TableCell><StatusBadge status={r.status}/></TableCell>
                <TableCell className="text-right">
                  {isAdmin && ["submitted","under_review"].includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>Review</Button>
                  )}
                  {isAdmin && r.status === "approved" && (
                    <Button size="sm" onClick={() => setStatus(r.id, { status: "paid", paid_at: new Date().toISOString(), paid_by: user?.id })}>Mark Paid</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data || data.rows.length === 0) && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No requests</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!reviewing} onOpenChange={o => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Reimbursement</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Code:</span> {reviewing.request_code}</div>
              <div><span className="text-muted-foreground">Amount:</span> {fmtPKR(reviewing.amount)}</div>
              <div><span className="text-muted-foreground">Description:</span> {reviewing.description}</div>
              <F label="Rejection reason (if rejecting)">
                <Textarea rows={2} value={reviewing.rejection_reason ?? ""} onChange={e => setReviewing({ ...reviewing, rejection_reason: e.target.value })}/>
              </F>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => setStatus(reviewing.id, { status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString(), rejection_reason: reviewing.rejection_reason })}>Reject</Button>
            <Button onClick={() => setStatus(reviewing.id, { status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: "bg-gray-500/15 text-gray-600 border-gray-500/30",
    submitted: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    under_review: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-600 border-red-500/30",
    paid: "bg-primary/15 text-primary border-primary/30",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status.replace("_", " ")}</Badge>;
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
