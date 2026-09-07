import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, APP_MODULES, MODULE_LABELS, type AppModule, type PermissionLevel, type AppRole } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/permissions")({
  component: PermissionsPage,
});

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "add", label: "Add" },
  { value: "edit", label: "Edit" },
  { value: "view", label: "View Only" },
  { value: "none", label: "No Access" },
];

const PRESETS: Record<string, Partial<Record<AppModule, PermissionLevel>>> = {
  Admin: Object.fromEntries(APP_MODULES.map(m => [m, "add"])),
  Accounts: { dashboard: "view", leads: "none", clients: "view", deals: "view", renewals: "view", accounts: "add", operations: "none", reports: "view", admin: "none", settings: "view" },
  Operations: { dashboard: "view", leads: "none", clients: "view", deals: "view", renewals: "view", accounts: "none", operations: "add", reports: "view", admin: "none", settings: "view" },
  "Sales / DO": { dashboard: "view", leads: "add", clients: "add", deals: "add", renewals: "edit", accounts: "none", operations: "none", reports: "view", admin: "none", settings: "view" },
};

function PermissionsPage() {
  const { hasRole, loading, user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data } = useQuery({
    queryKey: ["permissions-admin"],
    queryFn: async () => {
      const [profiles, roles, perms, audit] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_module_permissions" as any).select("*"),
        supabase.from("permission_audit_log" as any).select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: (roles.data ?? []) as { user_id: string; role: AppRole }[],
        perms: (perms.data ?? []) as any[],
        audit: (audit.data ?? []) as any[],
      };
    },
  });

  if (loading) return null;
  if (!hasRole(["admin", "management"])) return <Navigate to="/dashboard" replace />;

  const userId = selected || data?.profiles[0]?.id || "";
  const levelFor = (m: AppModule): PermissionLevel =>
    (data?.perms.find(p => p.user_id === userId && p.module === m)?.level as PermissionLevel) ?? "add";

  const setLevel = async (m: AppModule, level: PermissionLevel) => {
    if (!userId) return;
    if (userId === user?.id) return toast.error("You cannot change your own permissions");
    const { error } = await supabase
      .from("user_module_permissions" as any)
      .upsert({ user_id: userId, module: m, level }, { onConflict: "user_id,module" });
    if (error) return toast.error(error.message);
    toast.success(`${MODULE_LABELS[m]} → ${LEVELS.find(l => l.value === level)?.label}`);
    qc.invalidateQueries({ queryKey: ["permissions-admin"] });
  };

  const applyPreset = async (name: string) => {
    if (!userId) return;
    if (userId === user?.id) return toast.error("You cannot change your own permissions");
    const preset = PRESETS[name];
    const rows = Object.entries(preset).map(([module, level]) => ({ user_id: userId, module, level }));
    const { error } = await supabase.from("user_module_permissions" as any).upsert(rows, { onConflict: "user_id,module" });
    if (error) return toast.error(error.message);
    toast.success(`Applied "${name}" access template`);
    qc.invalidateQueries({ queryKey: ["permissions-admin"] });
  };

  const nameOf = (id: string) => data?.profiles.find(p => p.id === id)?.full_name || data?.profiles.find(p => p.id === id)?.email || "—";

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader title="User Access & Permissions" subtitle="Management-only control of module access. Enforced in the database, not just the interface." />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[260px]">
            <div className="text-xs text-muted-foreground mb-1">User</div>
            <Select value={userId} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {data?.profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Templates:</span>
            {Object.keys(PRESETS).map(name => (
              <Button key={name} size="sm" variant="outline" onClick={() => applyPreset(name)}>{name}</Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            Role: {data?.roles.filter(r => r.user_id === userId).map(r => r.role).join(", ") || "do"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Permission Matrix — {nameOf(userId)}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Module</th>
                  {LEVELS.map(l => <th key={l.value} className="p-2 text-center">{l.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {APP_MODULES.map(m => {
                  const current = levelFor(m);
                  return (
                    <tr key={m} className="border-t">
                      <td className="p-2 font-medium">{MODULE_LABELS[m]}</td>
                      {LEVELS.map(l => (
                        <td key={l.value} className="p-2 text-center">
                          <input
                            type="radio"
                            name={`perm-${m}`}
                            className="h-4 w-4 accent-primary cursor-pointer"
                            checked={current === l.value}
                            onChange={() => setLevel(m, l.value)}
                            aria-label={`${MODULE_LABELS[m]} ${l.label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Add includes Edit and View. Edit includes View. No Access blocks the module for both the interface and the API.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Permission Audit Log</CardTitle></CardHeader>
        <CardContent>
          {(data?.audit ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No permission changes recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Date &amp; Time</th>
                    <th className="text-left p-2">Changed By</th>
                    <th className="text-left p-2">User Affected</th>
                    <th className="text-left p-2">Module</th>
                    <th className="text-left p-2">Previous</th>
                    <th className="text-left p-2">New</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.audit.map(a => (
                    <tr key={a.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="p-2">{a.changed_by ? nameOf(a.changed_by) : "System"}</td>
                      <td className="p-2">{nameOf(a.user_affected)}</td>
                      <td className="p-2"><Badge variant="outline">{a.module ?? "—"}</Badge></td>
                      <td className="p-2">{a.previous_value ?? "—"}</td>
                      <td className="p-2">{a.new_value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
