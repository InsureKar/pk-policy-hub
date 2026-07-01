import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Briefcase, Users, Building2, UsersRound, Settings2, Database, LogOut,
  Shield, RefreshCw, BarChart3, KanbanSquare, FileText, DollarSign, UserCog, ChevronDown,
  ChevronRight, Sun, Moon, Plus,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useState, type ReactNode } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  search?: Record<string, string>;
};

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  roles?: AppRole[];
  expandable?: boolean; // "+" style
};

const groups: NavGroup[] = [
  {
    label: "Dashboard", icon: LayoutDashboard,
    items: [{ to: "/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Analytics", icon: BarChart3,
    items: [{ to: "/analytics", label: "Analytics", icon: BarChart3 }],
  },
  {
    label: "Sales", icon: Briefcase,
    items: [
      { to: "/deals", label: "Deals", icon: Briefcase },
      { to: "/deals/new", label: "New Deal", icon: Plus },
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { to: "/clients", label: "Clients", icon: Building2 },
    ],
  },
  {
    label: "Operations", icon: RefreshCw,
    items: [
      { to: "/renewals", label: "Renewals", icon: RefreshCw },
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/income", label: "Income", icon: DollarSign },
    ],
  },
  {
    label: "Admin", icon: UserCog, roles: ["admin", "management"],
    items: [
      { to: "/teams", label: "Teams", icon: UsersRound, roles: ["admin", "management"] },
      { to: "/agents", label: "Agents (DOs)", icon: Users, roles: ["admin", "management"] },
      { to: "/users", label: "User Management", icon: Users, roles: ["admin"] },
    ],
  },
  {
    label: "Master Data", icon: Database, roles: ["admin"], expandable: true,
    items: [
      { to: "/master", label: "Insurance Companies", icon: Building2, roles: ["admin"], search: { tab: "companies" } },
      { to: "/master", label: "Commission Settings", icon: DollarSign, roles: ["admin"], search: { tab: "commissions" } },
      { to: "/master", label: "Categories", icon: Database, roles: ["admin"], search: { tab: "categories" } },
      { to: "/master", label: "Products", icon: Database, roles: ["admin"], search: { tab: "products" } },
      { to: "/master", label: "Policy Types", icon: Database, roles: ["admin"], search: { tab: "policy_types" } },
    ],
  },
  {
    label: "Settings", icon: Settings2,
    items: [{ to: "/settings", label: "Settings", icon: Settings2 }],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, signOut, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
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
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {groups.map((g) => {
            if (g.roles && !hasRole(g.roles)) return null;
            const visibleItems = g.items.filter(i => !i.roles || hasRole(i.roles));
            if (visibleItems.length === 0) return null;
            // Single-item groups render flat (no collapsible header)
            if (visibleItems.length === 1 && !g.expandable) {
              const item = visibleItems[0];
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link key={g.label} to={item.to as string}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}>
                  <Icon className="w-4 h-4"/> {item.label}
                </Link>
              );
            }
            return <NavGroupBlock key={g.label} group={g} items={visibleItems} pathname={pathname} defaultOpen={visibleItems.some(i => pathname.startsWith(i.to.split("?")[0]))} />;
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
                <Shield className="w-3 h-3" /> {roleLabel(primaryRole)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={toggle} variant="secondary" size="sm" className="flex-1" title="Toggle theme">
              {theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </Button>
            <Button onClick={signOut} variant="secondary" size="sm" className="flex-1">
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function NavGroupBlock({ group, items, pathname, defaultOpen }: { group: NavGroup; items: NavItem[]; pathname: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = group.icon;
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs uppercase tracking-wide text-sidebar-foreground/60 hover:text-sidebar-foreground"
      >
        <span className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" /> {group.label}
        </span>
        {group.expandable
          ? (open ? <ChevronDown className="w-3.5 h-3.5"/> : <Plus className="w-3.5 h-3.5"/>)
          : (open ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>)}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {items.map((item) => {
            const base = item.to;
            const active = pathname === base || pathname.startsWith(base + "/");
            const ItemIcon = item.icon;
            return (
              <Link key={item.label} to={item.to as string} search={item.search as any}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}>
                <ItemIcon className="w-4 h-4"/> {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function roleLabel(r: AppRole) {
  return r === "admin" ? "Super Admin" : r === "team_lead" ? "Team Lead" : r === "do" ? "Development Officer" : "Management";
}
