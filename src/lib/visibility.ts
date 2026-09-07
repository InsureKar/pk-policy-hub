import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type VisibilityScope = {
  /** true when the viewer may see every user's data (admin / management). */
  all: boolean;
  /** User ids the viewer is allowed to see (self + team members for a team lead). */
  ids: string[];
  loading: boolean;
};

/**
 * Resolves which users' records the logged-in user is authorized to view.
 * Admin & Management: everything. Team lead: self + members of teams they lead.
 * Everyone else: only themselves.
 */
export function useVisibilityScope(): VisibilityScope {
  const { user, hasRole, profile } = useAuth();
  const all = hasRole(["admin", "management"]);
  const isLead = hasRole("team_lead");
  const uid = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["visibility-scope", uid, isLead],
    enabled: !!uid && !all && isLead,
    queryFn: async () => {
      const { data: teams } = await supabase.from("teams").select("id").eq("lead_id", uid!);
      const teamIds = (teams ?? []).map((t: any) => t.id);
      if (profile?.team_id) teamIds.push(profile.team_id);
      if (teamIds.length === 0) return [uid!];
      const { data: members } = await supabase.from("profiles").select("id").in("team_id", teamIds);
      return Array.from(new Set([uid!, ...((members ?? []).map((m: any) => m.id))]));
    },
  });

  if (all) return { all: true, ids: [], loading: false };
  if (!uid) return { all: false, ids: [], loading: true };
  if (isLead) return { all: false, ids: data ?? [uid], loading: isLoading };
  return { all: false, ids: [uid], loading: false };
}

/** True when a deal-like row (assigned_do_id / team_lead_id / created_by) is visible in scope. */
export function isVisibleRow(row: any, scope: VisibilityScope): boolean {
  if (scope.all) return true;
  const ids = scope.ids;
  return (
    (row?.assigned_do_id && ids.includes(row.assigned_do_id)) ||
    (row?.team_lead_id && ids.includes(row.team_lead_id)) ||
    (row?.created_by && ids.includes(row.created_by)) ||
    false
  );
}
