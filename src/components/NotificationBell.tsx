import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Notif = {
  id: string; kind: string; title: string; message: string | null;
  entity_type: string | null; entity_id: string | null; is_read: boolean; created_at: string;
};

export function linkFor(type: string | null, id: string | null): { to: string; params?: any } | null {
  switch (type) {
    case "deal": return id ? { to: "/deals/$id", params: { id } } : { to: "/deals" };
    case "client": return { to: "/clients" };
    case "task": return { to: "/tasks" };
    case "payment": return { to: "/accounts/payments" };
    case "invoice": return { to: "/accounts/invoices" };
    case "receivable": return { to: "/accounts/receivables" };
    case "payable": return { to: "/accounts/payables" };
    case "tax": return { to: "/accounts/tax" };
    case "expense": return { to: "/operations/expenses" };
    case "reimbursement": return { to: "/operations/reimbursements" };
    case "policy": case "travel": case "document": return { to: "/deals" };
    default: return null;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications" as any)
      .select("id, kind, title, message, entity_type, entity_id, is_read, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setItems((data ?? []) as any);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (supabase.rpc as any)("generate_my_reminders").then(() => load());
    const ch = supabase.channel("notif-" + user.id)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    const t = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [user, load]);

  const setRead = async (id: string, is_read: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, is_read } : x)));
    await supabase.from("notifications" as any).update({ is_read }).eq("id", id);
  };
  const markAll = async () => {
    if (!user) return;
    setItems((xs) => xs.map((x) => ({ ...x, is_read: true })));
    await supabase.from("notifications" as any).update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };
  const openItem = async (n: Notif) => {
    if (!n.is_read) setRead(n.id, true);
    const l = linkFor(n.entity_type, n.entity_id);
    if (l) { setOpen(false); navigate(l as any); }
  };

  const unread = items.filter((x) => !x.is_read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold grid place-items-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all as read
          </Button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>}
          {items.map((n) => (
            <div key={n.id} className={cn("flex gap-2 px-3 py-2 border-b last:border-0 hover:bg-muted/50", !n.is_read && "bg-primary/5")}>
              <button className="flex-1 text-left min-w-0" onClick={() => openItem(n)}>
                <div className="flex items-center gap-2">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  <span className="text-sm font-medium truncate">{n.title}</span>
                  <span className="text-[10px] uppercase text-muted-foreground ml-auto shrink-0">{n.kind}</span>
                </div>
                {n.message && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>}
                <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("en-PK")}</div>
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title={n.is_read ? "Mark as unread" : "Mark as read"}
                onClick={() => setRead(n.id, !n.is_read)}>
                {n.is_read ? <Mail className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
