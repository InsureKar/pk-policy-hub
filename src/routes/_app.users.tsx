import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

const ROLES: AppRole[] = ["admin", "management", "team_lead", "do"];

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const [profiles, roles, teams] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("teams").select("id, name"),
      ]);
      const rolesByUser = new Map<string, AppRole[]>();
      (roles.data ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role as AppRole); rolesByUser.set(r.user_id, list);
      });
      return { profiles: profiles.data ?? [], rolesByUser, teams: teams.data ?? [] };
    },
  });

  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;

  const setUserRole = async (userId: string, newRole: AppRole) => {
    // remove existing then add — keeps it single-role for simplicity
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) toast.error(error.message); else { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["users-admin"] }); }
  };

  const setTeam = async (userId: string, teamId: string) => {
    const { error } = await supabase.from("profiles").update({ team_id: teamId || null }).eq("id", userId);
    if (error) toast.error(error.message); else { toast.success("Team updated"); qc.invalidateQueries({ queryKey: ["users-admin"] }); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Users" subtitle="Manage roles, teams and DO profiles. New sign-ups default to DO." />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5">Designation</th>
                <th className="text-left px-4 py-2.5">Team</th>
                <th className="text-left px-4 py-2.5">Role</th>
              </tr>
            </thead>
            <tbody>
              {(data?.profiles ?? []).map(p => {
                const userRole = (data?.rolesByUser.get(p.id) ?? ["do"])[0];
                return <UserRow key={p.id} p={p} teams={data?.teams ?? []} role={userRole} onRole={(r: AppRole)=>setUserRole(p.id, r)} onTeam={(t: string)=>setTeam(p.id, t)} />;
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ p, teams, role, onRole, onTeam }: any) {
  const [phone, setPhone] = useState(p.phone ?? "");
  const [designation, setDesignation] = useState(p.designation ?? "");

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ phone, designation }).eq("id", p.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <tr className="border-t">
      <td className="px-4 py-2 font-medium">{p.full_name || "—"}</td>
      <td className="px-4 py-2 text-muted-foreground">{p.email}</td>
      <td className="px-4 py-2"><Input className="h-8" value={phone} onChange={(e)=>setPhone(e.target.value)} onBlur={saveProfile}/></td>
      <td className="px-4 py-2"><Input className="h-8" value={designation} onChange={(e)=>setDesignation(e.target.value)} onBlur={saveProfile}/></td>
      <td className="px-4 py-2">
        <Select value={p.team_id ?? ""} onValueChange={onTeam}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="—"/></SelectTrigger>
          <SelectContent>{teams.map((t: any)=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2">
        <Select value={role} onValueChange={onRole}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue/></SelectTrigger>
          <SelectContent>{ROLES.map(r=><SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>)}</SelectContent>
        </Select>
      </td>
    </tr>
  );
}
