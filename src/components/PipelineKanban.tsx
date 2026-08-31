import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fmtPKR } from "@/lib/format";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  created: "#c8d34a",
  "follow up": "#c76ac9",
  qualified: "#f2c6de",
  negotiation: "#e8a33d",
  approval: "#8a7f78",
  won: "#2dbf9a",
  lost: "#9aa0a6",
};
const stageColor = (name: string) => STAGE_COLORS[name.trim().toLowerCase()] ?? "hsl(var(--muted-foreground))";

type Props = { lockUserId?: string };

export function PipelineKanban({ lockUserId }: Props) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string>(lockUserId ?? "all");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["pipeline-kanban"],
    queryFn: async () => {
      const [deals, stages, profiles, companies] = await Promise.all([
        supabase.from("deals").select("id, deal_number, gross_premium, stage_id, assigned_do_id, team_lead_id, deal_type, insurance_company_id"),
        supabase.from("deal_stages").select("id, name, sort_order, is_won, is_lost").order("sort_order"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("insurance_companies").select("id, name"),
      ]);
      return {
        deals: deals.data ?? [],
        stages: stages.data ?? [],
        profiles: profiles.data ?? [],
        companies: companies.data ?? [],
      };
    },
  });

  const stages = data?.stages ?? [];
  const profileMap = useMemo(() => new Map((data?.profiles ?? []).map((p: any) => [p.id, p.full_name])), [data]);
  const companyMap = useMemo(() => new Map((data?.companies ?? []).map((c: any) => [c.id, c.name])), [data]);

  const deals = useMemo(() => {
    return (data?.deals ?? []).filter((d: any) => {
      if (userId !== "all" && d.assigned_do_id !== userId && d.team_lead_id !== userId) return false;
      return true;
    });
  }, [data, userId]);

  const moveDeal = async (dealId: string, stageId: string) => {
    const { error } = await supabase.from("deals").update({ stage_id: stageId }).eq("id", dealId);
    if (error) return toast.error(error.message);
    toast.success("Deal stage updated");
    qc.invalidateQueries({ queryKey: ["pipeline-kanban"] });
    qc.invalidateQueries({ queryKey: ["pipeline-funnel"] });
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 p-3 border-b">
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={!!lockUserId}
        >
          <option value="all">All users</option>
          {(data?.profiles ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground ml-auto">{deals.length} deals · drag cards between stages</span>
      </div>

      <div className="flex gap-3 p-4 overflow-x-auto items-start">
        {stages.map((s: any) => {
          const list = deals.filter((d: any) => d.stage_id === s.id);
          const total = list.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);
          return (
            <div
              key={s.id}
              className={`min-w-[260px] w-[260px] shrink-0 rounded-lg border bg-muted/30 transition-colors ${dragOverStage === s.id ? "ring-2 ring-primary" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(s.id); }}
              onDragLeave={() => setDragOverStage((cur) => (cur === s.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const dealId = e.dataTransfer.getData("text/plain");
                if (dealId) moveDeal(dealId, s.id);
              }}
            >
              <div className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: stageColor(s.name) }} />
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">{fmtPKR(total)}</div>
              </div>
              <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                {list.map((d: any) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
                    className="rounded-md border bg-card p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow"
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <Link to="/deals/$id" params={{ id: d.id }} className="font-medium text-sm text-primary hover:underline truncate">
                        {d.deal_number}
                      </Link>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border ${d.deal_type === "renewal" ? "text-muted-foreground" : "text-primary"}`}>
                        {d.deal_type === "renewal" ? "Renewal" : "Fresh"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold tabular-nums mt-1.5">{fmtPKR(Number(d.gross_premium || 0))}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {d.insurance_company_id ? companyMap.get(d.insurance_company_id) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.assigned_do_id ? profileMap.get(d.assigned_do_id) : "Unassigned"}
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">Drop deals here</div>
                )}
              </div>
            </div>
          );
        })}
        {stages.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 w-full text-center">No pipeline stages configured.</div>
        )}
      </div>
    </div>
  );
}
