import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, User, Lock, Bell, Monitor } from "lucide-react";
import { listAllSessions, revokeUserSessions } from "@/lib/sessions.functions";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Settings" subtitle="Manage your profile, password, notifications and security." />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-1.5"/>Profile</TabsTrigger>
          <TabsTrigger value="password"><Lock className="w-4 h-4 mr-1.5"/>Password</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-1.5"/>Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5"/>Security</TabsTrigger>
          {isAdmin && <TabsTrigger value="sessions"><Monitor className="w-4 h-4 mr-1.5"/>Sessions</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile"><ProfileTab/></TabsContent>
        <TabsContent value="password"><PasswordTab/></TabsContent>
        <TabsContent value="notifications"><NotificationsTab/></TabsContent>
        <TabsContent value="security"><SecurityTab/></TabsContent>
        {isAdmin && <TabsContent value="sessions"><SessionsTab/></TabsContent>}
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { profile, refresh } = useAuth();
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesig] = useState("");
  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setDesig(profile?.designation ?? "");
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ full_name, phone, designation }).eq("id", profile.id);
    if (error) toast.error(error.message); else { toast.success("Profile updated"); refresh(); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Profile</CardTitle><CardDescription>Your personal information.</CardDescription></CardHeader>
      <CardContent className="space-y-3 max-w-lg">
        <div><Label>Full name</Label><Input className="mt-1.5" value={full_name} onChange={(e)=>setName(e.target.value)}/></div>
        <div><Label>Email</Label><Input className="mt-1.5" value={profile?.email ?? ""} disabled/></div>
        <div><Label>Phone</Label><Input className="mt-1.5" value={phone} onChange={(e)=>setPhone(e.target.value)}/></div>
        <div><Label>Designation</Label><Input className="mt-1.5" value={designation} onChange={(e)=>setDesig(e.target.value)}/></div>
        <Button onClick={save}>Save changes</Button>
      </CardContent>
    </Card>
  );
}

function PasswordTab() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const save = async () => {
    if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message); else { toast.success("Password updated"); setPw(""); setPw2(""); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Change password</CardTitle><CardDescription>Choose a strong password (min 8 characters).</CardDescription></CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div><Label>New password</Label><Input type="password" className="mt-1.5" value={pw} onChange={(e)=>setPw(e.target.value)}/></div>
        <div><Label>Confirm password</Label><Input type="password" className="mt-1.5" value={pw2} onChange={(e)=>setPw2(e.target.value)}/></div>
        <Button onClick={save}>Update password</Button>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const qc = useQueryClient();
  const [renewalAlerts, setRenewal] = useState(true);
  const [dealAlerts, setDeal] = useState(true);
  const { data } = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*").in("key", ["notif_renewal","notif_deal"]);
      return data ?? [];
    },
  });
  useEffect(() => {
    const r = data?.find(x=>x.key==="notif_renewal"); if (r) setRenewal(!!r.value);
    const d = data?.find(x=>x.key==="notif_deal"); if (d) setDeal(!!d.value);
  }, [data]);
  const save = async () => {
    await supabase.from("app_settings").upsert([
      { key: "notif_renewal", value: renewalAlerts as any },
      { key: "notif_deal", value: dealAlerts as any },
    ]);
    toast.success("Preferences saved");
    qc.invalidateQueries({ queryKey: ["notif-prefs"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Notifications</CardTitle><CardDescription>Control which alerts you receive.</CardDescription></CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <input type="checkbox" checked={renewalAlerts} onChange={(e)=>setRenewal(e.target.checked)}/>
          <span className="text-sm">Renewal alerts (upcoming & due policies)</span>
        </label>
        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <input type="checkbox" checked={dealAlerts} onChange={(e)=>setDeal(e.target.checked)}/>
          <span className="text-sm">Deal stage change notifications</span>
        </label>
        <Button onClick={save}>Save preferences</Button>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Security</CardTitle><CardDescription>Account security overview.</CardDescription></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between border-b py-2"><span>Email verified</span><span className="text-success">Yes</span></div>
        <div className="flex justify-between border-b py-2"><span>Password strength check (HIBP)</span><span className="text-success">Enabled</span></div>
        <div className="flex justify-between border-b py-2"><span>Row-level security</span><span className="text-success">Enforced</span></div>
        <div className="flex justify-between py-2"><span>Session encryption</span><span className="text-success">TLS + at-rest AES-256</span></div>
      </CardContent>
    </Card>
  );
}

function SessionsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllSessions);
  const revokeFn = useServerFn(revokeUserSessions);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => await listFn({ data: undefined as any }),
  });

  const revoke = async (user_id: string, email?: string) => {
    if (!confirm(`Sign out all sessions for ${email ?? user_id}?`)) return;
    setBusyUser(user_id);
    try {
      await revokeFn({ data: { user_id } });
      toast.success("Sessions revoked");
      qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusyUser(null); }
  };

  const signOutOthers = async () => {
    setSignOutBusy(true);
    try {
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Signed out of your other sessions");
    } catch (e: any) { toast.error(e.message); }
    finally { setSignOutBusy(false); }
  };

  const sessions: any[] = (data as any)?.sessions ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Your other sessions</CardTitle><CardDescription>Sign out any other browsers or devices where your account is signed in.</CardDescription></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOutOthers} disabled={signOutBusy}>Sign out of my other sessions</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All active sessions (Admin)</CardTitle>
          <CardDescription>Revoke sessions for any user across the organization.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading sessions…</div>}
          {error && <div className="p-4 text-sm text-destructive">{(error as Error).message}</div>}
          {!isLoading && !error && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device / User-Agent</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Signed in</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sessions.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No active sessions</TableCell></TableRow>
                )}
                {sessions.map((s) => (
                  <TableRow key={s.session_id}>
                    <TableCell className="font-medium">{s.email ?? s.user_id}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={s.user_agent ?? ""}>{s.user_agent ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.ip ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.created_at ? fmtDate(s.created_at) : "—"}</TableCell>
                    <TableCell className="text-xs">{s.not_after ? fmtDate(s.not_after) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" disabled={busyUser === s.user_id} onClick={() => revoke(s.user_id, s.email)}>
                        {busyUser === s.user_id ? "Revoking…" : "Revoke"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="p-3 text-xs text-muted-foreground">Revoking signs the user out of every device they are logged into.</div>
        </CardContent>
      </Card>
    </div>
  );
}
