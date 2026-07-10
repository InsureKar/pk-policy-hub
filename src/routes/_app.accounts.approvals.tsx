import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, Printer, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/accounts/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending_approval");

  const { data } = useQuery({
    queryKey: ["invoice-approvals"],
    queryFn: async () => {
      const [inv, deals, clients] = await Promise.all([
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("deals").select("id,deal_number,gross_premium,insurance_company_id,insurance_type_id,assigned_do_id,team_lead_id,team_id"),
        supabase.from("clients").select("id,full_name,company_name"),
      ]);
      return {
        rows: inv.data ?? [],
        deals: new Map((deals.data ?? []).map(d => [d.id, d])),
        clients: new Map((clients.data ?? []).map(c => [c.id, c])),
      };
    },
  });

  const filtered = useMemo(() => {
    return (data?.rows ?? []).filter(r => {
      if (status !== "all" && r.status !== status) return false;
      if (!search) return true;
      const d = data?.deals.get(r.deal_id!);
      const c = r.client_id ? data?.clients.get(r.client_id) : null;
      const hay = `${r.invoice_number} ${d?.deal_number ?? ""} ${c?.company_name ?? c?.full_name ?? ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [data, search, status]);

  const act = async (id: string, patch: any) => {
    const { error } = await supabase.from("invoices").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Invoice updated"); qc.invalidateQueries({ queryKey: ["invoice-approvals"] }); }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input placeholder="Search invoice / deal / client" value={search} onChange={e => setSearch(e.target.value)}/>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices</TableCell></TableRow>}
            {filtered.map(inv => {
              const d = data?.deals.get(inv.deal_id!);
              const c = inv.client_id ? data?.clients.get(inv.client_id) : null;
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell className="font-mono text-xs">{d?.deal_number ?? "—"}</TableCell>
                  <TableCell>{c?.company_name ?? c?.full_name ?? "—"}</TableCell>
                  <TableCell>{fmtDate(inv.issue_date)}</TableCell>
                  <TableCell>{fmtDate(inv.due_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(inv.total_amount)}</TableCell>
                  <TableCell><StatusBadge status={inv.status as string}/></TableCell>
                  <TableCell className="text-right space-x-1">
                    <PreviewButton invoice={inv} client={c}/>
                    {isAdmin && inv.status === "pending_approval" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => act(inv.id, { status: "approved", approved_at: new Date().toISOString() })}>
                          <Check className="w-4 h-4 mr-1"/>Approve
                        </Button>
                        <RejectDialog onReject={(reason) => act(inv.id, { status: "rejected", rejected_at: new Date().toISOString(), rejection_reason: reason })}/>
                      </>
                    )}
                    {isAdmin && inv.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={() => act(inv.id, { status: "sent", sent_at: new Date().toISOString() })}>
                        Mark Sent
                      </Button>
                    )}
                  </TableCell>
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
    draft: "bg-muted text-muted-foreground",
    pending_approval: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-600 border-red-500/30",
    sent: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  };
  return <Badge variant="outline" className={cls[status] ?? ""}>{status.replace("_", " ")}</Badge>;
}

function RejectDialog({ onReject }: { onReject: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-red-600"><X className="w-4 h-4 mr-1"/>Reject</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject invoice</DialogTitle></DialogHeader>
        <Textarea placeholder="Rejection reason" value={reason} onChange={e => setReason(e.target.value)}/>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onReject(reason); setOpen(false); }} disabled={!reason.trim()}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewButton({ invoice, client }: { invoice: any; client: any }) {
  const openPrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const clientName = client?.company_name ?? client?.full_name ?? "—";
    w.document.write(`
      <html><head><title>${invoice.invoice_number}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#111}
        h1{margin:0 0 8px}.muted{color:#666}
        table{width:100%;border-collapse:collapse;margin-top:24px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        .right{text-align:right}
        .total{font-weight:700;font-size:1.1em}
        .badge{display:inline-block;padding:4px 10px;border-radius:6px;background:#f3f4f6;font-size:12px}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <h1>Invoice ${invoice.invoice_number}</h1>
          <div class="muted">Issued ${new Date(invoice.issue_date).toLocaleDateString()}</div>
          <div class="muted">Due ${new Date(invoice.due_date).toLocaleDateString()}</div>
        </div>
        <span class="badge">${(invoice.status || "").replace("_", " ").toUpperCase()}</span>
      </div>
      <div style="margin-top:24px"><strong>Bill To</strong><br>${clientName}</div>
      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Premium Receivable</td><td class="right">${new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(invoice.total_amount))}</td></tr>
          <tr class="total"><td class="right">Total</td><td class="right">${new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(invoice.total_amount))}</td></tr>
        </tbody>
      </table>
      ${invoice.notes ? `<p style="margin-top:24px"><strong>Notes:</strong> ${invoice.notes}</p>` : ""}
      ${invoice.rejection_reason ? `<p style="margin-top:16px;color:#b91c1c"><strong>Rejection:</strong> ${invoice.rejection_reason}</p>` : ""}
      <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
      </body></html>`);
    w.document.close();
  };
  return <Button size="sm" variant="ghost" onClick={openPrint}><Eye className="w-4 h-4 mr-1"/>Preview</Button>;
}
