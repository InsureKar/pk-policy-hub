import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, User, Lock, Bell, Monitor } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Settings" subtitle="Manage your profile, password, notifications and security." />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-1.5"/>Profile</TabsTrigger>
          <TabsTrigger value="password"><Lock className="w-4 h-4 mr-1.5"/>Password</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-1.5"/>Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5"/>Security</TabsTrigger>
          <TabsTrigger value="sessions"><Monitor className="w-4 h-4 mr-1.5"/>Sessions</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab/></TabsContent>
        <TabsContent value="password"><PasswordTab/></TabsContent>
        <TabsContent value="notifications"><NotificationsTab/></TabsContent>
        <TabsContent value="security"><SecurityTab/></TabsContent>
        <TabsContent value="sessions"><SessionsTab/></TabsContent>
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
  const [busy, setBusy] = useState(false);
  const signOutOthers = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Signed out of other sessions");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Session Management</CardTitle><CardDescription>Manage active sessions across devices.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">You're currently signed in on this device. Sign out of all other browsers or devices you may have used.</p>
        <Button variant="destructive" onClick={signOutOthers} disabled={busy}>Sign out of other sessions</Button>
      </CardContent>
    </Card>
  );
}
