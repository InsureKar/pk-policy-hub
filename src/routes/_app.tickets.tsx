import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { fetchServiceDeskData } from "@/lib/tickets";
import { TicketDialog } from "@/components/TicketDialog";

export const Route = createFileRoute("/_app/tickets")({
  component: ServiceDeskLayout,
});

const tabs = [
  { to: "/tickets", label: "Dashboard", exact: true },
  { to: "/tickets/all", label: "Tickets" },
  { to: "/tickets/mine", label: "My Tickets" },
  { to: "/tickets/team", label: "Team Tickets" },
  { to: "/tickets/sla", label: "SLA" },
  { to: "/tickets/reports", label: "Reports" },
];

function ServiceDeskLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { loading } = useAuth();
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  if (loading) return null;

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Internal Service Desk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal-only tickets for Operations, Accounts, Technology and Sales. No client-facing portal.
          </p>
        </div>
        <TicketDialog data={data} />
      </div>
      <nav className="flex flex-wrap gap-1 border-b mb-6 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to}
              className={cn(
                "px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px whitespace-nowrap transition-colors",
                active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
