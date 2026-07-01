import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const [clients, teams] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("teams").select("id, name"),
      ]);
      return { clients: clients.data ?? [], teams: teams.data ?? [] };
    },
  });

  const [form, setForm] = useState({
    company_name: "", poc_name: "", poc_number: "", poc_email: "", poc_address: "",
    industry: "", ntn: "", existing_insurance_company: "", notes: "", team_id: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm(f=>({ ...f, [k]: v }));

  const submit = async () => {
    if (!user) return;
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    const { error } = await supabase.from("clients").insert({
      ...form, created_by: user.id, team_id: form.team_id || profile?.team_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Client created");
    setOpen(false);
    setForm({ company_name:"", poc_name:"", poc_number:"", poc_email:"", poc_address:"", industry:"", ntn:"", existing_insurance_company:"", notes:"", team_id:"" });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const filtered = (data?.clients ?? []).filter((c) =>
    !q || [c.company_name, c.poc_name, c.poc_email, c.industry, c.ntn].some((x) => x && x.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Clients" subtitle="Companies you've onboarded or are pitching."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2"/>New Client</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>
              <div className="grid sm:grid-cols-2 gap-3">
                <F label="Company Name *"><Input value={form.company_name} onChange={(e)=>set("company_name", e.target.value)}/></F>
                <F label="Industry"><Input value={form.industry} onChange={(e)=>set("industry", e.target.value)}/></F>
                <F label="POC Name"><Input value={form.poc_name} onChange={(e)=>set("poc_name", e.target.value)}/></F>
                <F label="POC Number"><Input value={form.poc_number} onChange={(e)=>set("poc_number", e.target.value)}/></F>
                <F label="POC Email"><Input type="email" value={form.poc_email} onChange={(e)=>set("poc_email", e.target.value)}/></F>
                <F label="NTN"><Input value={form.ntn} onChange={(e)=>set("ntn", e.target.value)}/></F>
                <F label="POC Address" full><Input value={form.poc_address} onChange={(e)=>set("poc_address", e.target.value)}/></F>
                <F label="Existing Insurance Company" full><Input value={form.existing_insurance_company} onChange={(e)=>set("existing_insurance_company", e.target.value)}/></F>
                <F label="Team" full>
                  <Select value={form.team_id} onValueChange={(v)=>set("team_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Assign team (defaults to your team)"/></SelectTrigger>
                    <SelectContent>{data?.teams.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Notes" full><Textarea rows={3} value={form.notes} onChange={(e)=>set("notes", e.target.value)}/></F>
              </div>
              <DialogFooter><Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={submit}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"/>
            <Input className="pl-8" placeholder="Search clients by name, POC, industry or NTN" value={q} onChange={(e)=>setQ(e.target.value)}/>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Company</th>
                <th className="text-left px-4 py-2.5">POC</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Industry</th>
                <th className="text-left px-4 py-2.5">NTN</th>
                <th className="text-left px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{c.company_name}</td>
                  <td className="px-4 py-2.5">{c.poc_name || "—"}</td>
                  <td className="px-4 py-2.5">{c.poc_number || "—"}</td>
                  <td className="px-4 py-2.5">{c.poc_email || "—"}</td>
                  <td className="px-4 py-2.5">{c.industry || "—"}</td>
                  <td className="px-4 py-2.5">{c.ntn || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No clients yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`space-y-1.5 ${full?"sm:col-span-2":""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
