import { createFileRoute, Link, Outlet, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/operations")({
  component: OperationsLayout,
});

const tabs = [
  { to: "/operations", label: "Dashboard", exact: true, adminOnly: true },
  { to: "/operations/payroll", label: "Payroll", adminOnly: true },
  { to: "/operations/commissions", label: "Commissions", adminOnly: true },
  { to: "/operations/performance", label: "Performance", adminOnly: true },
  { to: "/operations/expenses", label: "Expenses", adminOnly: true },
  { to: "/operations/reimbursements", label: "Reimbursements", adminOnly: false },
  { to: "/operations/reports", label: "Reports", adminOnly: true },
];

function OperationsLayout() {
  const { hasRole, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return null;
  if (!hasRole(["admin", "management", "team_lead", "do"])) {
    return <Navigate to="/dashboard" replace />;
  }
  const isAdmin = hasRole(["admin", "management"]);
  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="text-sm text-muted-foreground mt-1">Payroll, expenses, reimbursements, and workforce analytics.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b mb-6 overflow-x-auto">
        {tabs.filter(t => !t.adminOnly || isAdmin).map((t) => {
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
