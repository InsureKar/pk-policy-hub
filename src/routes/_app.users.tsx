import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, Lock, Unlock } from "lucide-react";
import { createUser, deleteUser, resetUserPassword, setUserLocked } from "@/lib/users.functions";

const ROLES: AppRole[] = ["admin", "management", "team_lead", "do"];

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const createUserFn = useServerFn(createUser);
  const deleteUserFn = useServerFn(deleteUser);
  const [open, setOpen] = useState(false);

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
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) toast.error(error.message); else { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["users-admin"] }); }
  };

  const setTeam = async (userId: string, teamId: string) => {
    const { error } = await supabase.from("profiles").update({ team_id: teamId || null }).eq("id", userId);
    if (error) toast.error(error.message); else { toast.success("Team updated"); qc.invalidateQueries({ queryKey: ["users-admin"] }); }
  };

  const onDelete = async (userId: string) => {
    if (!confirm("Permanently delete this user?")) return;
    try {
      await deleteUserFn({ data: { user_id: userId } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const resetFn = useServerFn(resetUserPassword);
  const lockFn = useServerFn(setUserLocked);

  const onReset = async (userId: string, name: string) => {
    const pw = prompt(`Set a new password for ${name}:`);
    if (!pw || pw.length < 8) { if (pw) toast.error("Password must be at least 8 characters"); return; }
    try {
      await resetFn({ data: { user_id: userId, password: pw } });
      toast.success("Password reset. User will be prompted to change on next login.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const onToggleLock = async (userId: string, locked: boolean) => {
    try {
      await lockFn({ data: { user_id: userId, locked: !locked } });
      toast.success(locked ? "Account unlocked" : "Account locked");
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Users"
        subtitle="Manage roles, teams and DO profiles. Create accounts for new agents and managers."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2"/>New User</Button>
            </DialogTrigger>
            <CreateUserDialog
              teams={data?.teams ?? []}
              onCreate={async (payload) => {
                try {
                  await createUserFn({ data: payload });
                  toast.success("User created");
                  qc.invalidateQueries({ queryKey: ["users-admin"] });
                  setOpen(false);
                } catch (e) { toast.error((e as Error).message); }
              }}
            />
          </Dialog>
        }
      />
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
                <th className="text-left px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.profiles ?? []).map(p => {
                const userRole = (data?.rolesByUser.get(p.id) ?? ["do"])[0];
                return <UserRow key={p.id} p={p} teams={data?.teams ?? []} role={userRole} onRole={(r: AppRole)=>setUserRole(p.id, r)} onTeam={(t: string)=>setTeam(p.id, t)} onDelete={()=>onDelete(p.id)} />;
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ p, teams, role, onRole, onTeam, onDelete }: any) {
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
      <td className="px-4 py-2">
        <Button variant="ghost" size="icon" onClick={onDelete} title="Delete user"><Trash2 className="w-4 h-4 text-destructive"/></Button>
      </td>
    </tr>
  );
}

function CreateUserDialog({ teams, onCreate }: { teams: any[]; onCreate: (p: any) => Promise<void> }) {
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", role: "do" as AppRole,
    team_id: "", phone: "", designation: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f)=>({...f, [k]: v}));

  const submit = async () => {
    setBusy(true);
    try {
      await onCreate({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        team_id: form.team_id || null,
        phone: form.phone || undefined,
        designation: form.designation || undefined,
      });
    } finally { setBusy(false); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New User</DialogTitle>
        <DialogDescription>Add an agent, team lead, manager or admin. They can sign in with the password you set.</DialogDescription>
      </DialogHeader>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Full Name</Label>
          <Input value={form.full_name} onChange={(e)=>set("full_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e)=>set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="text" value={form.password} onChange={(e)=>set("password", e.target.value)} placeholder="Min 8 characters"/>
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e)=>set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Designation</Label>
          <Input value={form.designation} onChange={(e)=>set("designation", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v)=>set("role", v)}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{ROLES.map(r=><SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Team</Label>
          <Select value={form.team_id} onValueChange={(v)=>set("team_id", v)}>
            <SelectTrigger><SelectValue placeholder="None"/></SelectTrigger>
            <SelectContent>{teams.map((t)=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy || !form.email || !form.password || !form.full_name}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}
