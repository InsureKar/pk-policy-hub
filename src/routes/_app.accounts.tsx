import { createFileRoute, Link, Outlet, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/accounts")({
  component: AccountsLayout,
});

const tabs = [
  { to: "/accounts", label: "Dashboard", exact: true, perm: "accounts.dashboard" },
  { to: "/accounts/receivables", label: "Premium Receivables", perm: "accounts.receivables" },
  { to: "/accounts/payables", label: "Payables", perm: "accounts.payables" },
  { to: "/accounts/sales", label: "Sales", perm: "accounts.sales" },
  { to: "/accounts/tax", label: "Tax", perm: "accounts.taxes" },
  { to: "/accounts/b2b", label: "B2B Commission", perm: "accounts.b2b" },
  { to: "/accounts/installments", label: "Installments", perm: "accounts.installments" },
  { to: "/accounts/invoices", label: "Invoices", perm: "operations.invoice_issue" },
  { to: "/accounts/approvals", label: "Invoice Approvals", perm: "operations.invoice_issue" },
  { to: "/accounts/payments", label: "Payments", perm: "operations.payments" },
  { to: "/accounts/reports", label: "Reports", perm: "accounts.dashboard" },
];

function AccountsLayout() {
  const { hasRole, loading, allow } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return null;
  if (!hasRole(["admin", "management", "team_lead", "do"])) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">Receivables, payables, invoices, installments and finance reports.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b mb-6 overflow-x-auto">
        {tabs.filter((t) => !t.perm || allow(t.perm)).map((t) => {
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
