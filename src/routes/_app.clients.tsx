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

const EMPTY = {
  client_type: "corporate" as "individual" | "corporate",
  // corporate
  company_name: "", industry: "", ntn: "",
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
    if (!user) return;
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
      created_by: user.id,
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
      poc_name: form.client_type === "individual" ? form.full_name.trim() : null,
      poc_number: form.phone.trim(),
      poc_email: form.email.trim() || null,
      poc_address: form.address.trim() || null,
    };
    const { error } = await supabase.from("clients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Client created");
    setOpen(false);
    setForm({ ...EMPTY });
    qc.invalidateQueries({ queryKey: ["clients"] });
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2"/>New Client</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>

              <div className="mb-4">
                <Label className="text-xs">Client Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {(["corporate","individual"] as const).map((t)=>(
                    <button
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
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {form.client_type === "corporate" ? (
                  <>
                    <F label="Company Name *"><Input value={form.company_name} onChange={(e)=>set("company_name", e.target.value)}/></F>
                    <F label="Industry"><Input value={form.industry} onChange={(e)=>set("industry", e.target.value)}/></F>
                    <F label="City *"><Input value={form.city} onChange={(e)=>set("city", e.target.value)}/></F>
                    <F label="Phone *"><Input value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="+92 3XX XXXXXXX"/></F>
                    <F label="Email"><Input type="email" value={form.email} onChange={(e)=>set("email", e.target.value)}/></F>
                    <F label="NTN (Optional)"><Input value={form.ntn} onChange={(e)=>set("ntn", e.target.value)}/></F>
                    <F label="Address" full><Input value={form.address} onChange={(e)=>set("address", e.target.value)}/></F>
                  </>
                ) : (
                  <>
                    <F label="Full Name *"><Input value={form.full_name} onChange={(e)=>set("full_name", e.target.value)}/></F>
                    <F label="Date of Birth *"><Input type="date" value={form.date_of_birth} onChange={(e)=>set("date_of_birth", e.target.value)}/></F>
                    <F label="Phone *"><Input value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="+92 3XX XXXXXXX"/></F>
                    <F label="Email"><Input type="email" value={form.email} onChange={(e)=>set("email", e.target.value)}/></F>
                    <F label="CNIC (Optional)"><Input value={form.cnic} onChange={(e)=>set("cnic", e.target.value)} placeholder="12345-1234567-1"/></F>
                    <F label="City *"><Input value={form.city} onChange={(e)=>set("city", e.target.value)}/></F>
                    <F label="Address" full><Input value={form.address} onChange={(e)=>set("address", e.target.value)}/></F>
                  </>
                )}
                <F label="Notes" full><Textarea rows={3} value={form.notes} onChange={(e)=>set("notes", e.target.value)}/></F>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
                <Button onClick={submit}>Create</Button>
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
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{(c as any).client_code ?? "—"}</td>
                  <td className="px-4 py-2.5 font-medium">{c.client_type === "individual" ? (c.full_name || c.company_name) : c.company_name}</td>
                  <td className="px-4 py-2.5 capitalize">{c.client_type}</td>
                  <td className="px-4 py-2.5">{c.phone || c.poc_number || "—"}</td>
                  <td className="px-4 py-2.5">{c.email || c.poc_email || "—"}</td>
                  <td className="px-4 py-2.5">{c.city || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.cnic || c.ntn || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No clients yet.</td></tr>}
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
