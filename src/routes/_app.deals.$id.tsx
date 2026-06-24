import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeDeal } from "@/lib/calc";
import { fmtPKR, fmtPct, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/deals/$id")({
  component: DealDetail,
});

function DealDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const [deal, stages, companies, types, sources, profiles, teams, clients, settings] = await Promise.all([
        supabase.from("deals").select("*").eq("id", id).maybeSingle(),
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("insurance_types").select("id, name"),
        supabase.from("lead_sources").select("id, name"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("teams").select("id, name"),
        supabase.from("clients").select("id, company_name"),
        supabase.from("app_settings").select("value").eq("key","tagged_premium_base_percentage").maybeSingle(),
      ]);
      return { deal: deal.data, stages: stages.data ?? [], companies: companies.data ?? [], types: types.data ?? [],
        sources: sources.data ?? [], profiles: profiles.data ?? [], teams: teams.data ?? [], clients: clients.data ?? [],
        basePct: Number(settings.data?.value ?? 13) };
    },
  });

  const [stageId, setStageId] = useState<string>("");
  useEffect(() => { if (data?.deal?.stage_id) setStageId(data.deal.stage_id); }, [data?.deal?.stage_id]);

  const calc = useMemo(() => data?.deal ? computeDeal({
    gross_premium: Number(data.deal.gross_premium),
    commission_percentage: Number(data.deal.commission_percentage),
    marketing_budget_percentage: Number(data.deal.marketing_budget_percentage),
    loading: Number(data.deal.loading), b2b_commission: Number(data.deal.b2b_commission),
  }, data.basePct) : null, [data]);

  if (!data?.deal) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const d = data.deal;
  const company = data.companies.find(c=>c.id===d.insurance_company_id)?.name;
  const type = data.types.find(t=>t.id===d.insurance_type_id)?.name;
  const source = data.sources.find(s=>s.id===d.source_id)?.name;
  const stage = data.stages.find(s=>s.id===d.stage_id);
  const doName = data.profiles.find(p=>p.id===d.assigned_do_id)?.full_name;
  const team = data.teams.find(t=>t.id===d.team_id)?.name;
  const client = data.clients.find(c=>c.id===d.client_id)?.company_name;

  const updateStage = async (newStage: string) => {
    setStageId(newStage);
    const { error } = await supabase.from("deals").update({ stage_id: newStage }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Stage updated"); qc.invalidateQueries({ queryKey: ["deal", id] }); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Link to="/deals" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4"/>Back to deals</Link>
      <PageHeader title={d.deal_number} subtitle={`${client ?? "—"} · Created ${fmtDate(d.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs">Stage:</Label>
            <Select value={stageId} onValueChange={updateStage}>
              <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
              <SelectContent>{data.stages.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Deal Information</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <KV k="Cover Note #" v={d.cover_note_number || "—"} />
            <KV k="Policy #" v={d.policy_number || "—"} />
            <KV k="Insurance Company" v={company || "—"} />
            <KV k="Insurance Type" v={type || "—"} />
            <KV k="Source" v={source || "—"} />
            <KV k="Stage" v={stage ? <Badge variant={stage.is_won?"default":stage.is_lost?"destructive":"secondary"}>{stage.name}</Badge> : "—"} />
            <KV k="Assigned DO" v={doName || "—"} />
            <KV k="Team" v={team || "—"} />
            <KV k="Policy Start" v={fmtDate(d.policy_start_date)} />
            <KV k="Policy End" v={fmtDate(d.policy_end_date)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Premium & Income</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KV k="Gross Premium" v={fmtPKR(Number(d.gross_premium))} />
            <KV k="Net Premium" v={fmtPKR(Number(d.net_premium))} />
            <KV k="Commission %" v={fmtPct(Number(d.commission_percentage))} />
            <KV k="Marketing %" v={fmtPct(Number(d.marketing_budget_percentage))} />
            <KV k="Loading" v={fmtPKR(Number(d.loading))} />
            <KV k="B2B Commission" v={fmtPKR(Number(d.b2b_commission))} />
            <hr/>
            <KV k="Commission Before Tax" v={fmtPKR(Number(d.commission_before_tax))} />
            <KV k="Commission After Tax" v={fmtPKR(Number(d.commission_after_tax))} />
            <KV k="Marketing After Tax" v={fmtPKR(Number(d.marketing_after_tax))} />
            <KV k="Total Income" v={<span className="font-semibold">{fmtPKR(Number(d.total_income))}</span>} />
            <KV k="Income %" v={fmtPct(Number(d.income_percentage))} />
            {calc && <>
              <KV k="Tagged Premium %" v={fmtPct(calc.tagged_premium_percentage)} />
              <KV k="Tagged Premium" v={<span className="font-semibold">{fmtPKR(calc.tagged_premium)}</span>} />
            </>}
          </CardContent>
        </Card>
      </div>

      {d.notes && <Card className="mt-4"><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{d.notes}</CardContent></Card>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
}
