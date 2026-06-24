import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", lead_id: "" });

  const { data } = useQuery({
    queryKey: ["teams-full"],
    queryFn: async () => {
      const [teams, profiles] = await Promise.all([
        supabase.from("teams").select("*").order("name"),
        supabase.from("profiles").select("id, full_name, email, team_id, designation, phone"),
      ]);
      return { teams: teams.data ?? [], profiles: profiles.data ?? [] };
    },
  });

  if (!hasRole(["admin", "management"])) return <Navigate to="/dashboard" replace />;
  const canEdit = hasRole("admin");

  const submit = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("teams").insert({ name: form.name, location: form.location, lead_id: form.lead_id || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Team created"); setOpen(false); setForm({ name:"", location:"", lead_id:"" });
    qc.invalidateQueries({ queryKey: ["teams-full"] });
  };

  const setLead = async (teamId: string, leadId: string) => {
    const { error } = await supabase.from("teams").update({ lead_id: leadId || null }).eq("id", teamId);
    if (error) toast.error(error.message); else { toast.success("Lead updated"); qc.invalidateQueries({ queryKey: ["teams-full"] }); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Teams" subtitle="Branches and team leads. DOs are managed in Users."
        actions={canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2"/>New Team</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Team</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label className="text-xs">Team Name</Label><Input value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}/></div>
                <div className="space-y-1.5"><Label className="text-xs">Location</Label><Input value={form.location} onChange={(e)=>setForm(f=>({...f, location:e.target.value}))}/></div>
                <div className="space-y-1.5"><Label className="text-xs">Team Lead</Label>
                  <Select value={form.lead_id} onValueChange={(v)=>setForm(f=>({...f, lead_id:v}))}>
                    <SelectTrigger><SelectValue placeholder="Select lead (optional)"/></SelectTrigger>
                    <SelectContent>{data?.profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={submit}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {(data?.teams ?? []).map((t) => {
          const members = (data?.profiles ?? []).filter(p => p.team_id === t.id);
          const lead = (data?.profiles ?? []).find(p => p.id === t.lead_id);
          return (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-lg font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.location}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{members.length} {members.length===1?"member":"members"}</div>
                </div>
                <div className="text-xs text-muted-foreground mb-1">Team Lead</div>
                {canEdit ? (
                  <Select value={t.lead_id ?? ""} onValueChange={(v)=>setLead(t.id, v)}>
                    <SelectTrigger className="mb-3"><SelectValue placeholder="Assign a team lead"/></SelectTrigger>
                    <SelectContent>{(data?.profiles ?? []).map(p=><SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <div className="text-sm mb-3">{lead?.full_name || lead?.email || "—"}</div>}
                <div className="text-xs text-muted-foreground mb-1">Members</div>
                <ul className="text-sm space-y-1">
                  {members.length === 0 ? <li className="text-muted-foreground italic">No members yet</li> :
                    members.map(m => (
                      <li key={m.id} className="flex justify-between"><span>{m.full_name || m.email}</span><span className="text-xs text-muted-foreground">{m.designation || "DO"}</span></li>
                    ))
                  }
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
