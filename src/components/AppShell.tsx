import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Users, Building2, UsersRound, Settings2, Database, LogOut, Shield, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/deals", label: "Deals", icon: Briefcase, roles: null },
  { to: "/clients", label: "Clients", icon: Building2, roles: null },
  { to: "/renewals", label: "Renewals", icon: RefreshCw, roles: null },
  { to: "/teams", label: "Teams", icon: UsersRound, roles: ["admin", "management"] as const },
  { to: "/users", label: "Users", icon: Users, roles: ["admin"] as const },
  { to: "/master", label: "Master Data", icon: Database, roles: ["admin"] as const },
  { to: "/settings", label: "Settings", icon: Settings2, roles: ["admin"] as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, signOut, hasRole } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const primaryRole = roles[0] ?? "do";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">IB</div>
            <div>
              <div className="font-semibold leading-tight">InsureBroker</div>
              <div className="text-xs text-sidebar-foreground/60">CRM &amp; ERP</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map((item) => {
            if (item.roles && !hasRole([...item.roles])) return null;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent grid place-items-center text-sm font-semibold">
              {(profile?.full_name || profile?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm truncate">{profile?.full_name || profile?.email}</div>
              <div className="text-[11px] text-sidebar-foreground/60 flex items-center gap-1">
                <Shield className="w-3 h-3" /> {primaryRole.replace("_", " ")}
              </div>
            </div>
          </div>
          <Button onClick={signOut} variant="secondary" size="sm" className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
