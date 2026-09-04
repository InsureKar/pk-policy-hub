import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/format";
import {
  TICKET_DEPARTMENTS, TICKET_PRIORITIES, TICKET_STATUSES, clientLabel, deptLabel,
  fetchServiceDeskData, priorityClass, priorityLabel, resolutionText, slaText,
  statusClass, statusLabel,
} from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/$id")({
  component: TicketDetail,
  head: () => ({
    meta: [
      { title: "Ticket Detail | Internal Service Desk" },
      { name: "description", content: "Internal ticket detail with activity timeline, comments, attachments and SLA status." },
      { property: "og:title", content: "Ticket Detail | Internal Service Desk" },
      { property: "og:description", content: "Internal ticket detail with activity timeline, comments, attachments and SLA status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TicketDetail() {
  const { id } = useParams({ from: "/_app/tickets/$id" });
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [mention, setMention] = useState("");

  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  const { data: detail } = useQuery({
    queryKey: ["ticket-detail", id],
    queryFn: async () => {
      const [comments, activity, attachments] = await Promise.all([
        supabase.from("ticket_comments" as any).select("*").eq("ticket_id", id).order("created_at"),
        supabase.from("ticket_activity" as any).select("*").eq("ticket_id", id).order("created_at", { ascending: false }),
        supabase.from("ticket_attachments" as any).select("*").eq("ticket_id", id).order("created_at"),
      ]);
      return {
        comments: (comments.data ?? []) as any[],
        activity: (activity.data ?? []) as any[],
        attachments: (attachments.data ?? []) as any[],
      };
    },
  });

  const ticket = useMemo(() => (data?.tickets ?? []).find((t) => t.id === id), [data, id]);
  const people = useMemo(() => new Map((data?.profiles ?? []).map((p: any) => [p.id, p.full_name])), [data]);
  const canManage = hasRole(["admin", "management"]) || ticket?.assigned_to === user?.id || ticket?.created_by === user?.id;

  if (!ticket) return <p className="text-sm text-muted-foreground">Loading ticket…</p>;

  const patch = async (values: Record<string, any>) => {
    const { error } = await supabase.from("tickets" as any).update(values as any).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["service-desk"] });
    qc.invalidateQueries({ queryKey: ["ticket-detail", id] });
    toast.success("Ticket updated");
  };

  const addComment = async () => {
    if (!comment.trim() || !user) return;
    const body = mention ? `@${people.get(mention)} ${comment.trim()}` : comment.trim();
    const { error } = await supabase.from("ticket_comments" as any).insert({
      ticket_id: id, author_id: user.id, body, mentions: mention ? [mention] : [],
    } as any);
    if (error) return toast.error(error.message);
    setComment(""); setMention("");
    qc.invalidateQueries({ queryKey: ["ticket-detail", id] });
  };

  const uploadFile = async (file?: File) => {
    if (!file || !user) return;
    const path = `tickets/${id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("crm-documents").upload(path, file);
    if (up.error) return toast.error(up.error.message);
    await supabase.from("ticket_attachments" as any).insert({
      ticket_id: id, file_name: file.name, storage_path: path, uploaded_by: user.id,
    } as any);
    qc.invalidateQueries({ queryKey: ["ticket-detail", id] });
    toast.success("Document uploaded");
  };

  const openFile = async (path: string) => {
    const { data: signed } = await supabase.storage.from("crm-documents").createSignedUrl(path, 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  const sla = slaText(ticket);
  const client = (data?.clients ?? []).find((c: any) => c.id === ticket.client_id);
  const deal = (data?.deals ?? []).find((d: any) => d.id === ticket.deal_id);
  const company = (data?.companies ?? []).find((c: any) => c.id === ticket.insurance_company_id);
  const category = (data?.categories ?? []).find((c: any) => c.id === ticket.category_id);

  return (
    <div className="space-y-6">
      <Link to="/tickets/all" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to tickets
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-primary">{ticket.ticket_number}</span>
        <h2 className="text-xl font-semibold flex-1 min-w-[220px]">{ticket.subject}</h2>
        <Badge variant="secondary" className={priorityClass(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
        <Badge variant="secondary" className={statusClass(ticket.status)}>{statusLabel(ticket.status)}</Badge>
        <span className={sla.breached ? "text-destructive text-sm font-medium" : "text-sm text-muted-foreground"}>SLA: {sla.text}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{ticket.description || "No description provided."}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Internal conversation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(detail?.comments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              {(detail?.comments ?? []).map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    {(people.get(c.author_id) as string) ?? "Employee"} · {new Date(c.created_at).toLocaleString("en-PK")}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              <div className="space-y-2 pt-2 border-t">
                <Textarea rows={3} placeholder="Add an internal comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={mention} onValueChange={setMention}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Mention employee (optional)" /></SelectTrigger>
                    <SelectContent>{(data?.profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={addComment}><Send className="w-4 h-4 mr-1" />Comment</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Activity history</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(detail?.activity ?? []).map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                  </span>
                  <span className="font-medium">{(people.get(a.actor_id) as string) ?? "System"}</span>
                  <span className="text-muted-foreground">{a.detail}</span>
                </div>
              ))}
              {(detail?.activity ?? []).length === 0 && <p className="text-sm text-muted-foreground">No activity recorded.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Manage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Status</Label>
                <Select value={ticket.status} onValueChange={(v) => patch({ status: v })} disabled={!canManage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={ticket.priority} onValueChange={(v) => patch({ priority: v })} disabled={!canManage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign to employee</Label>
                <Select value={ticket.assigned_to ?? ""} disabled={!canManage}
                  onValueChange={(v) => patch({ assigned_to: v, assigned_team_id: null, assigned_department: null, assignee_kind: "employee", status: ticket.status === "new" ? "assigned" : ticket.status })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>{(data?.profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign to team</Label>
                <Select value={ticket.assigned_team_id ?? ""} disabled={!canManage}
                  onValueChange={(v) => patch({ assigned_team_id: v, assigned_to: null, assigned_department: null, assignee_kind: "team", status: ticket.status === "new" ? "assigned" : ticket.status })}>
                  <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
                  <SelectContent>{(data?.teams ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign to department</Label>
                <Select value={ticket.assigned_department ?? ""} disabled={!canManage}
                  onValueChange={(v) => patch({ assigned_department: v, assigned_to: null, assigned_team_id: null, assignee_kind: "department", status: ticket.status === "new" ? "assigned" : ticket.status })}>
                  <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
                  <SelectContent>{TICKET_DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Department" value={deptLabel(ticket.department)} />
              <Row label="Category" value={category?.name ?? "—"} />
              <Row label="Service / Module" value={ticket.service_module ?? "—"} />
              <Row label="Created by" value={(people.get(ticket.created_by) as string) ?? "—"} />
              <Row label="Created" value={new Date(ticket.created_at).toLocaleString("en-PK")} />
              <Row label="Due date" value={ticket.due_date ? fmtDate(ticket.due_date) : "—"} />
              <Row label="Resolution time" value={resolutionText(ticket.resolution_minutes)} />
              <Row label="Client" value={client ? clientLabel(client) : "—"} />
              <Row label="Deal" value={deal?.deal_number ?? "—"} />
              <Row label="Policy no." value={ticket.policy_number ?? "—"} />
              <Row label="Insurance company" value={company?.name ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Paperclip className="w-4 h-4" />Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(detail?.attachments ?? []).map((a) => (
                <button key={a.id} onClick={() => openFile(a.storage_path)} className="block text-sm text-primary hover:underline text-left">
                  {a.file_name}
                </button>
              ))}
              {(detail?.attachments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No documents.</p>}
              <Input type="file" onChange={(e) => uploadFile(e.target.files?.[0])} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
