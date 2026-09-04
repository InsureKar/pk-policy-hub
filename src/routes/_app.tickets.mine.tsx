import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { TicketTable } from "@/components/TicketTable";
import { fetchServiceDeskData } from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/mine")({
  component: MyTickets,
  head: () => ({
    meta: [
      { title: "My Tickets | Internal Service Desk" },
      { name: "description", content: "Tickets assigned to you or raised by you inside the internal service desk." },
      { property: "og:title", content: "My Tickets | Internal Service Desk" },
      { property: "og:description", content: "Tickets assigned to you or raised by you inside the internal service desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MyTickets() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  const mine = (data?.tickets ?? []).filter((t) => t.assigned_to === user?.id || t.created_by === user?.id);
  return <TicketTable tickets={mine} data={data} empty="You have no tickets assigned or raised." />;
}
