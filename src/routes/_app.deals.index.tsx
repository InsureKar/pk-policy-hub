import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR, fmtDate } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

export type DealsSearch = { stage?: string; dealType?: string; category?: string };

export const Route = createFileRoute("/_app/deals/")({
  validateSearch: (s: Record<string, unknown>): DealsSearch => ({
    stage: typeof s.stage === "string" ? s.stage : undefined,
    dealType: typeof s.dealType === "string" ? s.dealType : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  component: DealsList,
});

function DealsList() {
  const { hasRole } = useAuth();
  const canSeeFinancials = hasRole(["admin", "management", "team_lead"]);
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(search.stage ?? "all");
  const [dealType, setDealType] = useState<string>(search.dealType ?? "all");
  const [month, setMonth] = useState<string>("all");
  const [category, setCategory] = useState<string>(search.category ?? "all");

  const { data } = useQuery({
    queryKey: ["deals-list"],
    queryFn: async () => {
      const [deals, stages, companies, types, profiles] = await Promise.all([
        supabase.from("deals").select("*").order("created_at", { ascending: false }),
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("insurance_types").select("id, name"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        deals: deals.data ?? [], stages: stages.data ?? [],
        companies: companies.data ?? [], types: types.data ?? [], profiles: profiles.data ?? [],
      };
    },
  });

  const stageMap = useMemo(() => new Map((data?.stages ?? []).map(s => [s.id, s])), [data]);
  const companyMap = useMemo(() => new Map((data?.companies ?? []).map(c => [c.id, c.name])), [data]);
  const typeMap = useMemo(() => new Map((data?.types ?? []).map(t => [t.id, t.name])), [data]);
  const profileMap = useMemo(() => new Map((data?.profiles ?? []).map(p => [p.id, p.full_name])), [data]);

  // Last 24 months, newest first — used for the month filter.
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-US", { month: "long", year: "numeric" }) };
    });
  }, []);

  const filtered = (data?.deals ?? []).filter((d: any) => {
    if (stage !== "all" && d.stage_id !== stage) return false;
    if (dealType !== "all" && d.deal_type !== dealType) return false;
    if (category !== "all" && d.insurance_type_id !== category) return false;
    if (month !== "all" && String(d.created_at).slice(0, 7) !== month) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return [d.deal_number, d.cover_note_number, d.policy_number].some((x) => x && x.toLowerCase().includes(needle));
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Deals" subtitle="All policies, quotations, and pipeline opportunities."
        actions={<Button asChild><Link to="/deals/new"><Plus className="w-4 h-4 mr-2"/>New Deal</Link></Button>} />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"/>
            <Input className="pl-8" placeholder="Search deal #, cover note #, policy #" value={q} onChange={(e)=>setQ(e.target.value)}/>
          </div>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Stage"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {(data?.stages ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dealType} onValueChange={setDealType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Deal Type"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="fresh">Fresh</SelectItem>
              <SelectItem value="renewal">Renewal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(data?.types ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Month"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {(stage !== "all" || dealType !== "all" || category !== "all" || month !== "all" || q) && (
            <Button variant="ghost" size="sm" onClick={() => { setStage("all"); setDealType("all"); setCategory("all"); setMonth("all"); setQ(""); }}>Clear</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Deal #</th>
                <th className="text-left px-4 py-2.5">Company</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Deal Type</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="text-left px-4 py-2.5">DO</th>
                <th className="text-right px-4 py-2.5">Gross Premium</th>
                {canSeeFinancials && <th className="text-right px-4 py-2.5">Total Income</th>}
                <th className="text-left px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const s = d.stage_id ? stageMap.get(d.stage_id) : null;
                return (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5"><Link to="/deals/$id" params={{ id: d.id }} className="font-medium text-primary hover:underline">{d.deal_number}</Link></td>
                    <td className="px-4 py-2.5">{d.insurance_company_id ? companyMap.get(d.insurance_company_id) : "—"}</td>
                    <td className="px-4 py-2.5">{d.insurance_type_id ? typeMap.get(d.insurance_type_id) : "—"}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline">{d.deal_type === "renewal" ? "Renewal" : "Fresh"}</Badge></td>
                    <td className="px-4 py-2.5">
                      {s ? <Badge variant={s.is_won ? "default" : s.is_lost ? "destructive" : "secondary"}>{s.name}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-2.5">{d.assigned_do_id ? profileMap.get(d.assigned_do_id) ?? "—" : <span className="text-muted-foreground italic">Unassigned</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtPKR(Number(d.gross_premium))}</td>
                    {canSeeFinancials && <td className="px-4 py-2.5 text-right tabular-nums">{fmtPKR(Number(d.total_income))}</td>}
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(d.created_at)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={canSeeFinancials ? 9 : 8} className="text-center py-12 text-muted-foreground">No deals found. <Link to="/deals/new" className="text-primary hover:underline">Create your first deal</Link>.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
