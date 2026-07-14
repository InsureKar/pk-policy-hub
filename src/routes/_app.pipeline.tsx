import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const [stages, deals, clients] = await Promise.all([
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("deals").select("id, deal_number, client_id, gross_premium, stage_id"),
        supabase.from("clients").select("id, company_name"),
      ]);
      return {
        stages: stages.data ?? [],
        deals: deals.data ?? [],
        clientMap: new Map((clients.data ?? []).map(c => [c.id, c.company_name])),
      };
    },
  });

  const move = async (dealId: string, stageId: string) => {
    const { error } = await supabase.from("deals").update({ stage_id: stageId }).eq("id", dealId);
    if (error) toast.error(error.message); else { toast.success("Stage updated"); qc.invalidateQueries({ queryKey: ["pipeline"] }); }
  };

  const stages = data?.stages ?? [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Pipeline" subtitle="Kanban view of all deals across pipeline stages." />
      <div className="grid gap-3 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(260px, 1fr))` }}>
        {stages.map(s => {
          const dealsInStage = (data?.deals ?? []).filter(d => d.stage_id === s.id);
          const total = dealsInStage.reduce((a, d) => a + Number(d.gross_premium), 0);
          return (
            <div key={s.id} className="bg-muted/30 rounded-lg p-3 min-h-[400px]">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground">{dealsInStage.length} · {fmtPKR(total)}</div>
              </div>
              <div className="space-y-2">
                {dealsInStage.map(d => (
                  <Card key={d.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      <Link to="/deals/$id" params={{ id: d.id }} className="block">
                        <div className="text-sm font-medium hover:text-primary">{d.deal_number}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.client_id ? data?.clientMap.get(d.client_id) ?? "—" : "—"}</div>
                        <div className="text-sm tabular-nums mt-1">{fmtPKR(Number(d.gross_premium))}</div>
                      </Link>
                      <Select value={s.id} onValueChange={(v)=>move(d.id, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent>{stages.map(x => <SelectItem key={x.id} value={x.id}>Move to {x.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
                {dealsInStage.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">No deals</div>}
              </div>
            </div>
          );
        })}
        {stages.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            No pipeline stages configured. Add stages in <Link to="/master" search={{ tab: "pipeline" }} className="text-primary underline">Master Data → Pipeline Stages</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
