import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: "Insurekar CRM | Workspace" },
    { name: "description", content: "Access the Insurekar insurance CRM workspace." },
    { property: "og:title", content: "Insurekar CRM | Workspace" },
    { property: "og:description", content: "Access the Insurekar insurance CRM workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function Index() {
  const { loading, user } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  return <Navigate to={user ? "/dashboard" : "/auth"} replace />;
}
