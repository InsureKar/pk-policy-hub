import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { TicketTable } from "@/components/TicketTable";
import { fetchServiceDeskData } from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/all")({
  component: AllTickets,
  head: () => ({
    meta: [
      { title: "All Tickets | Internal Service Desk" },
      { name: "description", content: "Browse, filter and search every internal ticket raised across departments." },
      { property: "og:title", content: "All Tickets | Internal Service Desk" },
      { property: "og:description", content: "Browse, filter and search every internal ticket raised across departments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AllTickets() {
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  return <TicketTable tickets={data?.tickets ?? []} data={data} />;
}
