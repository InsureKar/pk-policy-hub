import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR } from "@/lib/format";
import { DateField } from "@/components/DateField";

type Props = {
  defaultFrom?: string;
  defaultTo?: string;
  lockUserId?: string;
  title?: string;
};

const STAGE_COLORS: Record<string, string> = {
  created: "#c8d34a",
  "follow up": "#c76ac9",
  qualified: "#f2c6de",
  negotiation: "#e8a33d",
  approval: "#8a7f78",
  won: "#2dbf9a",
  lost: "#9aa0a6",
};

const stageColor = (name: string) =>
  STAGE_COLORS[name.trim().toLowerCase()] ?? "hsl(var(--muted-foreground))";

function firstOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}
function lastOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10);
}

export function PipelineFunnel({ defaultFrom, defaultTo, lockUserId, title }: Props) {
  const [fromDraft, setFromDraft] = useState(defaultFrom ?? firstOfYear());
  const [toDraft, setToDraft] = useState(defaultTo ?? lastOfYear());
  const [userDraft, setUserDraft] = useState<string>(lockUserId ?? "all");
  const [from, setFrom] = useState(fromDraft);
  const [to, setTo] = useState(toDraft);
  const [userId, setUserId] = useState<string>(userDraft);

  const { data } = useQuery({
    queryKey: ["pipeline-funnel"],
    queryFn: async () => {
      const [deals, stages, profiles] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, stage_id, assigned_do_id, team_lead_id, created_at, deal_type"),
        supabase.from("deal_stages").select("id, name, sort_order, is_won, is_lost").order("sort_order"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        deals: deals.data ?? [],
        stages: stages.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  const filteredDeals = useMemo(() => {
    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return (data?.deals ?? []).filter((d: any) => {
      const dt = new Date(d.created_at);
      if (isNaN(+start) || isNaN(+end)) return true;
      if (dt < start || dt > end) return false;
      if (userId !== "all") {
        if (d.assigned_do_id !== userId && d.team_lead_id !== userId) return false;
      }
      return true;
    });
  }, [data, from, to, userId]);

  const stages = data?.stages ?? [];
  const wonIds = new Set(stages.filter((s: any) => s.is_won).map((s: any) => s.id));
  const lostIds = new Set(stages.filter((s: any) => s.is_lost).map((s: any) => s.id));

  const overallTotal = filteredDeals.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);

  const apply = () => {
    setFrom(fromDraft);
    setTo(toDraft);
    setUserId(userDraft);
  };

  const sections: { key: string; label: string; deals: any[] }[] = [
    {
      key: "fresh",
      label: "Fresh",
      deals: filteredDeals.filter((d: any) => d.deal_type === "fresh"),
    },
    {
      key: "renewal",
      label: "Renewal",
      deals: filteredDeals.filter((d: any) => d.deal_type === "renewal"),
    },
    {
      key: "total",
      label: "Total",
      deals: filteredDeals,
    },
  ];

  return (
    <div className="rounded-lg border bg-card">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 border-b">
        <label className="text-sm text-muted-foreground">Date</label>
        <DateField value={fromDraft} onChange={(v) => setFromDraft(v)} className="w-[150px]"/>
        <span className="text-muted-foreground">–</span>
        <DateField value={toDraft} onChange={(v) => setToDraft(v)} className="w-[150px]"/>
        {!lockUserId && (
          <Select value={userDraft} onValueChange={setUserDraft}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {(data?.profiles ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" onClick={apply}>Apply</Button>
        <Link to="/master" search={{ tab: "pipeline" }} className="ml-auto">
          <Button variant="outline" size="sm">Setup pipelines</Button>
        </Link>
      </div>

      {title && <div className="px-4 pt-3 text-sm font-medium">{title}</div>}

      {/* Overall total */}
      <div className="text-center pt-4">
        <span className="text-xl font-semibold tabular-nums">{fmtPKR(overallTotal)}</span>
        <span className="text-muted-foreground ml-2 text-sm">· {filteredDeals.length} deals</span>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-8 overflow-x-auto">
        {sections.map((sec) => {
          const inProgress = sec.deals.filter((d: any) => d.stage_id && !wonIds.has(d.stage_id) && !lostIds.has(d.stage_id));
          const inProgressTotal = inProgress.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);
          return (
            <div key={sec.key}>
              <div className="text-center mb-2">
                <span className="text-primary font-semibold">{sec.label}</span>
                <span className="text-sm ml-3 tabular-nums font-medium">{fmtPKR(inProgressTotal)}</span>
                <span className="text-sm text-muted-foreground ml-2">· {inProgress.length} deals in progress</span>
              </div>
              <div className="flex gap-0 min-w-max">
                {stages.map((s: any, idx: number) => {
                  const list = sec.deals.filter((d: any) => d.stage_id === s.id);
                  const total = list.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);
                  const color = stageColor(s.name);
                  const isFirst = idx === 0;
                  const isLast = idx === stages.length - 1;
                  const clip = isFirst
                    ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                    : isLast
                    ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)"
                    : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
                  return (
                    <div
                      key={s.id}
                      className="relative flex-1 min-w-[130px] px-4 py-3 bg-card"
                      style={{ clipPath: clip, marginLeft: isFirst ? 0 : -12, boxShadow: "inset 0 0 0 1px var(--border)" }}
                    >
                      <div className="text-xs text-muted-foreground text-center">{s.name}</div>
                      <div className="text-base font-semibold text-center tabular-nums mt-1">{fmtPKR(total)}</div>
                      <div className="text-xs text-muted-foreground text-center mt-0.5">{list.length} deals</div>
                      <div className="h-1 mt-2 rounded-full" style={{ background: color }} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {stages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No pipeline stages configured.</div>
        )}
      </div>
    </div>
  );
}
