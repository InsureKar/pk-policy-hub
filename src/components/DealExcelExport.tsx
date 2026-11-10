import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useVisibilityScope, isVisibleRow } from "@/lib/visibility";
import { canExportDeals, downloadDealWorkbook, exportSheet, matchesExportPeriod, type ExportPeriod } from "@/lib/deal-export";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Table = keyof Database["public"]["Tables"];

// Every read uses the existing signed-in client and database visibility rules.
async function readAll(table: Table): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let start = 0; ; start += 500) {
    const result = await supabase.from(table).select("*").order("id").range(start, start + 499);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    const page = (result.data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export function DealExcelExport() {
  const { roles } = useAuth();
  const scope = useVisibilityScope();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<ExportPeriod>({ mode: "all", month: "", from: "", to: "" });
  const [ready, setReady] = useState<{ workbook: XLSX.WorkBook; filename: string; count: number } | null>(null);
  if (!canExportDeals(roles)) return null;

  const change = (patch: Partial<ExportPeriod>) => { setPeriod(p => ({ ...p, ...patch })); setReady(null); setError(""); };
  const prepare = async () => {
    if (busy || !canExportDeals(roles)) return;
    if (period.mode === "month" && !/^\d{4}-\d{2}$/.test(period.month)) { setError("Select a month."); return; }
    if (period.mode === "dates" && (!period.from || !period.to || period.from > period.to)) { setError("Select a valid From and To date."); return; }
    setBusy(true); setError(""); setReady(null);
    try {
      const deals = (await readAll("deals")).filter(d => isVisibleRow(d, scope) && matchesExportPeriod(String(d.created_at), period));
      if (!deals.length) { setError("No deals found for the selected period."); return; }
      const [clients, profiles, companies, products, stages, sources, teams, installments, policies, postings, postingRows, transfers, documents] = await Promise.all([
        readAll("clients"), readAll("profiles"), readAll("insurance_companies"), readAll("insurance_types"), readAll("deal_stages"), readAll("lead_sources"), readAll("teams"), readAll("deal_installments"), readAll("deal_policies"), readAll("travel_postings"), readAll("travel_posting_rows"), readAll("travel_posting_transfers"), readAll("deal_documents"),
      ]);
      const lookup = (rows: Record<string, unknown>[], field: string) => new Map(rows.map(r => [r.id, r[field]]));
      const clientMap = new Map(clients.map(c => [c.id, c]));
      const people = lookup(profiles, "full_name"), company = lookup(companies, "name"), product = lookup(products, "name"), stage = lookup(stages, "name"), source = lookup(sources, "name"), team = lookup(teams, "name");
      const ids = new Set(deals.map(d => d.id));
      const numbers = lookup(deals, "deal_number");
      const selectedPostings = postings.filter(p => ids.has(p.deal_id));
      const postingDeals = new Map(selectedPostings.map(p => [p.id, p.deal_id]));
      const linked = (rows: Record<string, unknown>[]) => rows.filter(r => ids.has(r.deal_id)).map(r => ({ deal_number: numbers.get(r.deal_id), ...r }));
      const workbook = XLSX.utils.book_new();
      const append = (name: string, rows: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(workbook, exportSheet(rows), name);
      append("Deals", deals.map(d => {
        const c = clientMap.get(d.client_id);
        return { deal_number: d.deal_number, customer_name: c?.client_type === "corporate" ? c?.company_name : c?.full_name, customer_company: c?.company_name, customer_phone: c?.phone, customer_email: c?.email, contact_person: c?.poc_name, contact_number: c?.poc_number, insurance_company: company.get(d.insurance_company_id), product: product.get(d.insurance_type_id), stage: stage.get(d.stage_id), assigned_do: people.get(d.assigned_do_id), created_by_name: people.get(d.created_by), team_name: team.get(d.team_id), team_lead_name: people.get(d.team_lead_id), source_name: source.get(d.source_id), ...d };
      }));
      append("Clients", clients.filter(c => deals.some(d => d.client_id === c.id)));
      append("Installments", linked(installments));
      append("Bulk Policies", linked(policies));
      append("Travel Postings", linked(selectedPostings));
      for (const [name, rows] of [["Travel Policies", postingRows], ["Travel Transfers", transfers]] as const) {
        append(name, rows.filter(r => postingDeals.has(r.posting_id)).map(r => ({ deal_number: numbers.get(postingDeals.get(r.posting_id)), ...r })));
      }
      append("Documents", linked(documents));
      const suffix = period.mode === "month" ? period.month : period.mode === "dates" ? `${period.from}-to-${period.to}` : "all";
      setReady({ workbook, filename: `Insurekar-deals-${suffix}.xlsx`, count: deals.length });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare Excel. Please retry."); }
    finally { setBusy(false); }
  };

  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Export Deals</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Period — Deal Created Date</Label><Select value={period.mode} disabled={busy} onValueChange={mode => change({ mode: mode as ExportPeriod["mode"] })}><SelectTrigger aria-label="Export period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Dates</SelectItem><SelectItem value="month">Month Wise</SelectItem><SelectItem value="dates">Date Range</SelectItem></SelectContent></Select></div>
          {period.mode === "month" && <div className="space-y-2"><Label htmlFor="export-month">Month</Label><Input id="export-month" type="month" disabled={busy} value={period.month} onChange={e => change({ month: e.target.value })} /></div>}
          {period.mode === "dates" && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="export-from">From</Label><Input id="export-from" type="date" disabled={busy} value={period.from} onChange={e => change({ from: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="export-to">To</Label><Input id="export-to" type="date" disabled={busy} value={period.to} onChange={e => change({ to: e.target.value })} /></div></div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {ready && <p className="text-sm text-muted-foreground">{ready.count} deals ready</p>}
        </div>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>{ready ? <Button onClick={() => downloadDealWorkbook(ready.workbook, ready.filename)}><Download className="w-4 h-4 mr-2" />Download Excel</Button> : <Button disabled={busy} onClick={prepare}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{busy ? "Preparing…" : "Prepare Excel"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}