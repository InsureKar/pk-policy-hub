import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "management" | "team_lead" | "do";

export const APP_MODULES = [
  "dashboard", "leads", "clients", "deals", "renewals",
  "accounts", "operations", "reports", "admin", "settings",
] as const;
export type AppModule = (typeof APP_MODULES)[number];

export type PermissionLevel = "none" | "view" | "edit" | "add";
export const PERMISSION_RANK: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2, add: 3 };
export const MODULE_LABELS: Record<AppModule, string> = {
  dashboard: "Dashboard", leads: "Leads", clients: "Clients", deals: "Deals",
  renewals: "Renewals", accounts: "Accounts", operations: "Operations",
  reports: "Reports", admin: "Admin", settings: "Settings",
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  team_id: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: Profile | null;
  permissions: Record<AppModule, PermissionLevel>;
  can: (m: AppModule, min?: PermissionLevel) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (r: AppRole | AppRole[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const defaultPermissions = () =>
  Object.fromEntries(APP_MODULES.map((m) => [m, "add" as PermissionLevel])) as Record<AppModule, PermissionLevel>;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Record<AppModule, PermissionLevel>>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  const loadRolesAndProfile = async (uid: string) => {
    const [{ data: roleRows }, { data: prof }, { data: perms }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_module_permissions" as any).select("module, level").eq("user_id", uid),
    ]);
    setRoles((roleRows ?? []).map((r: { role: AppRole }) => r.role));
    setProfile(prof as Profile | null);
    const map = defaultPermissions();
    ((perms ?? []) as any[]).forEach((p) => { map[p.module as AppModule] = p.level as PermissionLevel; });
    setPermissions(map);
  };


  useEffect(() => {
    // Set listener FIRST then fetch session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadRolesAndProfile(sess.user.id), 0);
      } else {
        setRoles([]);
        setProfile(null);
        setPermissions(defaultPermissions());
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadRolesAndProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (session?.user) await loadRolesAndProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const hasRole = (r: AppRole | AppRole[]) => {
    const arr = Array.isArray(r) ? r : [r];
    return arr.some((x) => roles.includes(x));
  };

  const can = (m: AppModule, min: PermissionLevel = "view") =>
    PERMISSION_RANK[permissions[m] ?? "add"] >= PERMISSION_RANK[min];

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, roles, profile, permissions, can, loading, refresh, signOut, hasRole }}>

      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
