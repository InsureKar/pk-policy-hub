import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuth } from "@/lib/auth";
import { TicketTable } from "@/components/TicketTable";
import { fetchServiceDeskData } from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/team")({
  component: TeamTickets,
  head: () => ({
    meta: [
      { title: "Team Tickets | Internal Service Desk" },
      { name: "description", content: "Tickets assigned to your team or its members across the internal service desk." },
      { property: "og:title", content: "Team Tickets | Internal Service Desk" },
      { property: "og:description", content: "Tickets assigned to your team or its members across the internal service desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TeamTickets() {
  const { profile } = useAuth();
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });

  const members = useMemo(
    () => new Set((data?.profiles ?? []).filter((p: any) => p.team_id && p.team_id === profile?.team_id).map((p: any) => p.id)),
    [data, profile],
  );
  const rows = (data?.tickets ?? []).filter(
    (t) => (t.assigned_team_id && t.assigned_team_id === profile?.team_id) || (t.assigned_to && members.has(t.assigned_to)),
  );

  return <TicketTable tickets={rows} data={data} empty="No tickets are currently assigned to your team." />;
}
