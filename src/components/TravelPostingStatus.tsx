import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canManagePostingStatus, postingSentStatus } from "@/lib/travel-posting-status";
import { useSaveGuard } from "@/lib/use-save-guard";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

export function TravelPostingStatus({ postingId }: { postingId: string }) {
  const { roles, user } = useAuth();
  const allowed = canManagePostingStatus(roles);
  const qc = useQueryClient();
  const guard = useSaveGuard();
  const { data, isPending, error } = useQuery({
    queryKey: ["travel-posting-sent-status", user?.id, postingId],
    enabled: allowed,
    queryFn: async () => {
      const result = await supabase.from("travel_posting_delivery_status").select("sent_status").eq("posting_id", postingId).maybeSingle();
      if (result.error) throw result.error;
      return postingSentStatus(result.data?.sent_status);
    },
  });
  if (!allowed) return null;
  if (error) return <span className="text-destructive text-xs">Posting Status unavailable</span>;
  if (isPending) return <Loader2 aria-label="Loading Posting Status" className="size-4 animate-spin text-muted-foreground" />;
  const status = postingSentStatus(data);
  const save = async (value: string) => {
    if (!allowed || !guard.begin()) return;
    try {
      const result = await supabase.from("travel_posting_delivery_status").upsert({ posting_id: postingId, sent_status: value }, { onConflict: "posting_id" }).select("sent_status").single();
      if (result.error) throw result.error;
      qc.setQueryData(["travel-posting-sent-status", user?.id, postingId], postingSentStatus(result.data.sent_status));
      await qc.invalidateQueries({ queryKey: ["travel-posting-status-list"] });
      toast.success(`Posting marked ${value === "sent" ? "Sent" : "Unsent"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update Posting Status. Please retry.");
    } finally { guard.end(); }
  };
  return <div className="flex flex-wrap items-center gap-2 text-sm">
    <span className="text-muted-foreground">Posting Status</span>
    <Badge variant={status === "sent" ? "default" : "secondary"} className="gap-1">
      {status === "sent" ? <Check className="size-3" /> : <Clock className="size-3" />}{status === "sent" ? "Sent" : "Unsent"}
    </Badge>
    <Select value={status} disabled={guard.saving} onValueChange={save}>
      <SelectTrigger aria-label="Change Posting Status" className="w-28 h-8"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="sent">Sent</SelectItem><SelectItem value="unsent">Unsent</SelectItem></SelectContent>
    </Select>
    {guard.saving && <Loader2 aria-label="Saving Posting Status" className="size-4 animate-spin" />}
  </div>;
}