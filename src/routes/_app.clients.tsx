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
import { DateField } from "@/components/DateField";
import { DeleteButton } from "@/components/DeleteButton";
import { changedClientFields } from "@/lib/client-edit";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
  head: () => ({ meta: [
    { title: "Clients | Insurekar CRM" },
    { name: "description", content: "View and manage corporate and individual client information in Insurekar." },
    { property: "og:title", content: "Clients | Insurekar CRM" },
    { property: "og:description", content: "View and manage corporate and individual client information in Insurekar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const EMPTY = {
  client_type: "corporate" as "individual" | "corporate",
  // corporate
  company_name: "", industry: "", ntn: "",
  poc_name: "", poc_designation: "", poc_department: "",
  // individual
  full_name: "", date_of_birth: "", cnic: "",
  // shared
  phone: "", email: "", city: "", address: "", notes: "",
};

const PHONE_RE = /^[+0-9\s\-()]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNIC_RE = /^\d{5}-?\d{7}-?\d$/;

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<{ id: string; code: string; original: typeof EMPTY } | null>(null);
  const [saving, setSaving] = useState(false);
  const editClient = (client: NonNullable<typeof data>["clients"][number]) => {
    const values = { ...EMPTY };
    for (const key of Object.keys(EMPTY) as (keyof typeof EMPTY)[]) {
      Object.assign(values, { [key]: client[key] ?? EMPTY[key] });
    }
    values.phone = client.phone ?? client.poc_number ?? "";
    values.email = client.email ?? client.poc_email ?? "";
    values.address = client.address ?? client.poc_address ?? "";
    setEditing({ id: client.id, code: String((client as any).client_code ?? ""), original: values });
    setForm({ ...values });
    setOpen(true);
  };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { data } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      return { clients: data ?? [] };
    },
  });

  const submit = async () => {
    if (!user || saving) return;
    // Validation
    if (form.client_type === "corporate") {
      if (!form.company_name.trim()) return toast.error("Company name is required");
    } else {
      if (!form.full_name.trim()) return toast.error("Full name is required");
      if (!form.date_of_birth) return toast.error("Date of birth is required");
    }
    if (!form.phone.trim() || !PHONE_RE.test(form.phone.trim())) return toast.error("A valid phone number is required");
    if (form.email && !EMAIL_RE.test(form.email.trim())) return toast.error("Invalid email");
    if (form.client_type === "individual" && form.cnic && !CNIC_RE.test(form.cnic.trim()))
      return toast.error("CNIC must look like 12345-1234567-1");
    if (!form.city.trim()) return toast.error("City is required");

    const payload = {
      client_type: form.client_type,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      city: form.city.trim(),
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      // Corporate
      company_name: form.client_type === "corporate" ? form.company_name.trim() : form.full_name.trim(),
      industry: form.client_type === "corporate" ? (form.industry.trim() || null) : null,
      ntn: form.client_type === "corporate" ? (form.ntn.trim() || null) : null,
      // Individual
      full_name: form.client_type === "individual" ? form.full_name.trim() : null,
      date_of_birth: form.client_type === "individual" ? form.date_of_birth : null,
      cnic: form.client_type === "individual" ? (form.cnic.trim() || null) : null,
      // POC mirrors (back-compat)
      poc_name: form.client_type === "individual" ? form.full_name.trim() : (form.poc_name.trim() || null),
      poc_designation: form.poc_designation.trim() || null,
      poc_department: form.poc_department.trim() || null,
      poc_number: form.phone.trim(),
      poc_email: form.email.trim() || null,
      poc_address: form.address.trim() || null,
    };
    setSaving(true);
    try {
    if (editing) {
      const changed = changedClientFields(editing.original, form);
      const fields = new Set<string>(Object.keys(changed));
      if (fields.has("client_type")) Object.keys(payload).forEach((key) => fields.add(key));
      if (fields.has("full_name") || fields.has("company_name")) fields.add("company_name");
      if (fields.has("full_name") && form.client_type === "individual") fields.add("poc_name");
      if (fields.has("phone")) fields.add("poc_number");
      if (fields.has("email")) fields.add("poc_email");
      if (fields.has("address")) fields.add("poc_address");
      const update = Object.fromEntries(Object.entries(payload).filter(([key]) => fields.has(key))) as Partial<typeof payload>;
      if (Object.keys(update).length > 0) {
        const { data: saved, error } = await supabase.from("clients").update(update).eq("id", editing.id).select("id").maybeSingle();
        if (error) return toast.error(error.message);
        if (!saved) return toast.error("You do not have permission to edit this client.");
      }
    } else {
      const { error } = await supabase.from("clients").insert({ ...payload, created_by: user.id });
      if (error) return toast.error(error.message);
    }
    toast.success(editing ? "Client updated" : "Client created");
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY });
    qc.invalidateQueries({ queryKey: ["clients"] });
    } catch {
      toast.error("Unable to save client. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = (data?.clients ?? []).filter((c) => {
    if (tab !== "all" && c.client_type !== tab) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return [c.company_name, c.full_name, c.poc_name, c.email, c.poc_email, c.phone, c.poc_number, c.cnic, c.ntn, c.industry, c.city]
      .some((x) => x && String(x).toLowerCase().includes(needle));
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Clients" subtitle="Corporates and individuals you own."
        actions={
          <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
            <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm({ ...EMPTY }); }}><Plus className="w-4 h-4 mr-2"/>New Client</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? `Edit Client ${editing.code}` : "New Client"}</DialogTitle></DialogHeader>

              <fieldset disabled={saving}>

              <div className="mb-4">
                <Label className="text-xs">Client Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {(["corporate","individual"] as const).map((t)=>(
                    <Button
                      key={t}
                      type="button"
                      onClick={()=>set("client_type", t)}
                      className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                        form.client_type===t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      {t === "corporate" ? "Corporate" : "Individual"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {form.client_type === "corporate" ? (
                  <>
                    <F label="Company Name *"><Input value={form.company_name} onChange={(e)=>set("company_name", e.target.value)}/></F>
                    <F label="Industry"><Input value={form.industry} onChange={(e)=>set("industry", e.target.value)}/></F>
                    <F label="POC Name"><Input value={form.poc_name} onChange={(e)=>set("poc_name", e.target.value)}/></F>
                    <F label="POC Designation"><Input value={form.poc_designation} onChange={(e)=>set("poc_designation", e.target.value)}/></F>
                    <F label="POC Department"><Input value={form.poc_department} onChange={(e)=>set("poc_department", e.target.value)}/></F>
                    <F label="City *"><Input value={form.city} onChange={(e)=>set("city", e.target.value)}/></F>
                    <F label="Phone *"><Input value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="+92 3XX XXXXXXX"/></F>
                    <F label="Email"><Input type="email" value={form.email} onChange={(e)=>set("email", e.target.value)}/></F>
                    <F label="NTN (Optional)"><Input value={form.ntn} onChange={(e)=>set("ntn", e.target.value)}/></F>
                    <F label="Address" full><Input value={form.address} onChange={(e)=>set("address", e.target.value)}/></F>
                  </>
                ) : (
                  <>
                    <F label="Full Name *"><Input value={form.full_name} onChange={(e)=>set("full_name", e.target.value)}/></F>
                    <F label="Date of Birth *"><DateField value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)}/></F>
                    <F label="Phone *"><Input value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="+92 3XX XXXXXXX"/></F>
                    <F label="Email"><Input type="email" value={form.email} onChange={(e)=>set("email", e.target.value)}/></F>
                    <F label="CNIC (Optional)"><Input value={form.cnic} onChange={(e)=>set("cnic", e.target.value)} placeholder="12345-1234567-1"/></F>
                    <F label="City *"><Input value={form.city} onChange={(e)=>set("city", e.target.value)}/></F>
                    <F label="Address" full><Input value={form.address} onChange={(e)=>set("address", e.target.value)}/></F>
                  </>
                )}
                <F label="Notes" full><Textarea rows={3} value={form.notes} onChange={(e)=>set("notes", e.target.value)}/></F>
              </div>
              </fieldset>
              <DialogFooter>
                <Button variant="ghost" disabled={saving} onClick={()=>setOpen(false)}>Cancel</Button>
                <Button disabled={saving} onClick={submit}>{saving ? "Saving…" : editing ? "Save Changes" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-3">
        <TabsList>
          <TabsTrigger value="all">All ({(data?.clients ?? []).length})</TabsTrigger>
          <TabsTrigger value="corporate">Corporate ({(data?.clients ?? []).filter(c => c.client_type === "corporate").length})</TabsTrigger>
          <TabsTrigger value="individual">Individual ({(data?.clients ?? []).filter(c => c.client_type === "individual").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"/>
            <Input className="pl-8" placeholder="Search name, phone, email, CNIC, NTN, city" value={q} onChange={(e)=>setQ(e.target.value)}/>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Code</th>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">City</th>
                <th className="text-left px-4 py-2.5">Ref</th>
                <th className="text-left px-4 py-2.5">Created</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs"><Button variant="link" className="h-auto p-0 font-mono text-xs" aria-label={`Edit client ${(c as any).client_code ?? c.company_name}`} onClick={() => editClient(c)}>{(c as any).client_code ?? "—"}</Button></td>
                  <td className="px-4 py-2.5 font-medium">{c.client_type === "individual" ? (c.full_name || c.company_name) : c.company_name}</td>
                  <td className="px-4 py-2.5 capitalize">{c.client_type}</td>
                  <td className="px-4 py-2.5">{c.phone || c.poc_number || "—"}</td>
                  <td className="px-4 py-2.5">{c.email || c.poc_email || "—"}</td>
                  <td className="px-4 py-2.5">{c.city || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.cnic || c.ntn || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-2.5 text-right"><DeleteButton table="clients" id={c.id} label="client" invalidate={["clients"]} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No clients yet.</td></tr>}
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
