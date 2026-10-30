import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtDate, fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/renewals")({
  component: RenewalsPage,
});

function classify(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 7) return "due";
  if (days <= 60) return "upcoming";
  return "completed";
}

function RenewalsPage() {
  const { hasRole } = useAuth();
  const canExport = hasRole(["admin", "management"]);
  const [tab, setTab] = useState("upcoming");
  const { data } = useQuery({
    queryKey: ["renewals"],
    queryFn: async () => {
      const [pols, deals, clients, cos, types] = await Promise.all([
        supabase.from("policies").select("*").order("end_date"),
        supabase.from("deals").select("id, deal_number, policy_number, policy_end_date, gross_premium, client_id, insurance_company_id, insurance_type_id"),
        supabase.from("clients").select("id, company_name, full_name, phone, poc_name, poc_number"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("insurance_types").select("id, name"),
      ]);
      const clientMap = new Map((clients.data ?? []).map(c => [c.id, c.company_name]));
      const clientDetail = new Map((clients.data ?? []).map(c => [c.id, c]));
      const coMap = new Map((cos.data ?? []).map(c => [c.id, c.name]));
      const typeMap = new Map((types.data ?? []).map(t => [t.id, t.name]));
      const contactOf = (clientId: string | null) => {
        const c = clientId ? clientDetail.get(clientId) : undefined;
        if (!c) return "—";
        const bits = [c.poc_name, c.poc_number || c.phone].filter(Boolean);
        return bits.length ? bits.join(" — ") : (c.phone ?? "—");
      };
      // combine policies + legacy deal-based renewals
      const rows = [
        ...(pols.data ?? []).map(p => ({
          id: p.id,
          number: p.policy_number,
          client: p.client_id ? clientMap.get(p.client_id) ?? "—" : "—",
          company: p.company_id ? coMap.get(p.company_id) ?? "—" : "—",
          product: "—",
          contact: contactOf(p.client_id ?? null),
          premium: Number(p.premium),
          end_date: p.end_date,
          bucket: classify(p.end_date),
        })),
        ...(deals.data ?? []).filter(d => d.policy_end_date).map(d => ({
          id: d.id,
          number: d.policy_number || d.deal_number,
          client: d.client_id ? clientMap.get(d.client_id) ?? "—" : "—",
          company: d.insurance_company_id ? coMap.get(d.insurance_company_id) ?? "—" : "—",
          product: d.insurance_type_id ? typeMap.get(d.insurance_type_id) ?? "—" : "—",
          contact: contactOf(d.client_id),
          premium: Number(d.gross_premium),
          end_date: d.policy_end_date!,
          bucket: classify(d.policy_end_date!),
        })),
      ];
      return rows;
    },
  });

  const exportRenewals = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = (data ?? [])
      .filter(r => new Date(r.end_date) >= today)
      .sort((a, b) => a.end_date.localeCompare(b.end_date));
    const toRow = (r: (typeof upcoming)[number]) => ({
      "Policy / Deal #": r.number || "—",
      "Customer Name": r.client,
      "Company": r.company,
      "Product": r.product,
      "Contact": r.contact,
      "Gross Premium": r.premium,
      "End Date": r.end_date,
      "Days Left": Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86400000),
    });
    const wb = XLSX.utils.book_new();
    // month-wise sheets
    const byMonth = new Map<string, typeof upcoming>();
    for (const r of upcoming) {
      const key = r.end_date.slice(0, 7); // YYYY-MM
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(r);
    }
    for (const [key, rows] of byMonth) {
      const label = new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(toRow)), label.slice(0, 31));
    }
    // quarter-wise sheet
    const byQuarter = new Map<string, typeof upcoming>();
    for (const r of upcoming) {
      const d = new Date(`${r.end_date}T00:00:00`);
      const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      if (!byQuarter.has(key)) byQuarter.set(key, []);
      byQuarter.get(key)!.push(r);
    }
    const quarterRows = [...byQuarter.entries()].flatMap(([q, rows]) =>
      rows.map(r => ({ Quarter: q, ...toRow(r) })),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quarterRows), "Quarter Wise");
    if (byMonth.size === 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "No Upcoming");
    XLSX.writeFile(wb, `upcoming-renewals-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filtered = (data ?? []).filter(r => r.bucket === tab);

  const counts = (data ?? []).reduce<Record<string, number>>((acc, r) => { acc[r.bucket] = (acc[r.bucket] ?? 0) + 1; return acc; }, {});

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Renewals" subtitle="Track upcoming, due, expired and completed policy renewals."
        actions={canExport ? <Button variant="outline" onClick={exportRenewals}>Export Excel</Button> : undefined}/>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming ({counts.upcoming ?? 0})</TabsTrigger>
          <TabsTrigger value="due">Due ({counts.due ?? 0})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed ?? 0})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({counts.expired ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5">Policy / Deal #</th>
                    <th className="text-left px-4 py-2.5">Client</th>
                    <th className="text-left px-4 py-2.5">Company</th>
                    <th className="text-right px-4 py-2.5">Premium</th>
                    <th className="text-left px-4 py-2.5">End Date</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const days = Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86400000);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{r.number || "—"}</td>
                        <td className="px-4 py-2.5">{r.client}</td>
                        <td className="px-4 py-2.5">{r.company}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtPKR(r.premium)}</td>
                        <td className="px-4 py-2.5">{fmtDate(r.end_date)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={days < 0 ? "destructive" : days <= 7 ? "default" : "secondary"}>
                            {days < 0 ? `Expired ${-days}d ago` : `${days}d`}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No renewals in this bucket.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
