import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canManagePostingStatus, matchesPostingStatus, type PostingStatusFilter } from "@/lib/travel-posting-status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TravelPostingStatus } from "@/components/TravelPostingStatus";
import { fmtDate } from "@/lib/format";

export function TravelPostingList({ deals }: { deals: { id: string; deal_number: string }[] }) {
  const { roles, user } = useAuth();
  const allowed = canManagePostingStatus(roles);
  const [filter, setFilter] = useState<PostingStatusFilter>("all");
  const { data, isPending, error } = useQuery({
    queryKey: ["travel-posting-status-list", user?.id], enabled: allowed,
    queryFn: async () => {
      const result = await supabase.from("travel_postings").select("id, deal_id, posting_from, posting_to, travel_posting_delivery_status(sent_status)").order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return result.data;
    },
  });
  if (!allowed) return null;
  const dealMap = new Map(deals.map(d => [d.id, d.deal_number]));
  const rows = (data ?? []).filter(p => dealMap.has(p.deal_id) && matchesPostingStatus(p.travel_posting_delivery_status?.sent_status, filter));
  return <section className="mt-6 border-t pt-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Travel Postings</h2>
      <Select value={filter} onValueChange={value => { if (value === "all" || value === "sent" || value === "unsent") setFilter(value); }}>
        <SelectTrigger aria-label="Filter Posting Status" className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="unsent">Unsent</SelectItem></SelectContent>
      </Select>
    </div>
    {error ? <p className="text-sm text-destructive">Could not load Travel Postings. Please refresh.</p> : isPending ? <p className="text-sm text-muted-foreground">Loading Travel Postings…</p> : <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground"><tr><th className="text-left p-3">Deal #</th><th className="text-left p-3">From</th><th className="text-left p-3">To</th><th className="text-left p-3">Posting Status</th></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id} className="border-b"><td className="p-3"><Link to="/deals/$id" params={{ id: p.deal_id }} className="font-medium text-primary hover:underline">{dealMap.get(p.deal_id)}</Link></td><td className="p-3">{fmtDate(p.posting_from)}</td><td className="p-3">{fmtDate(p.posting_to)}</td><td className="p-3"><TravelPostingStatus postingId={p.id} /></td></tr>)}</tbody>
      </table>
      {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No Travel Postings found.</p>}
    </div>}
  </section>;
}