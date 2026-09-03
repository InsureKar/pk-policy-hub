import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { DateField } from "@/components/DateField";
import { MoneyInput } from "@/components/MoneyInput";
import { toast } from "sonner";
import { Plus, Trash2, Check, AlertTriangle, ArrowLeft } from "lucide-react";
import { UW_CLASSES, ENTITY_TYPES, clientLabelOf, type UwClass } from "@/lib/underwriting";
import { fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/operations/underwriting/new")({
  component: NewUnderwriting,
});

type Machine = { name: string; description: string; quantity: string; value: string };

function NewUnderwriting() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [kyc, setKyc] = useState<any>({ entity_type: "Individual", client_type: "individual" });
  const [files, setFiles] = useState<{ file: File; doc_type: string }[]>([]);

  const [cls, setCls] = useState<UwClass>("motor");
  const [guaranteeType, setGuaranteeType] = useState("quotation");
  const [form, setForm] = useState<any>({
    request_date: new Date().toISOString().slice(0, 10),
    business_type: "new",
    estimated_premium: 0,
    sum_insured: 0,
  });
  const [marine, setMarine] = useState<any>({});
  const [fire, setFire] = useState<any>({ building_status: "owned" });
  const [machines, setMachines] = useState<Machine[]>([{ name: "", description: "", quantity: "", value: "" }]);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["uw-new-refs"],
    queryFn: async () => {
      const sb = supabase as any;
      const [clients, insurers, templates] = await Promise.all([
        sb.from("clients").select("id, company_name, full_name, client_type, cnic, ntn, client_code, email, phone, city, address, poc_name, poc_number, poc_email").order("created_at", { ascending: false }),
        sb.from("insurance_companies").select("id, name").order("name"),
        sb.from("underwriting_requirement_templates").select("*").eq("active", true).order("sort_order"),
      ]);
      return { clients: clients.data ?? [], insurers: insurers.data ?? [], templates: templates.data ?? [] };
    },
  });

  const clients = data?.clients ?? [];
  const selected = clients.find((c: any) => c.id === clientId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 15);
    return clients.filter((c: any) =>
      [c.company_name, c.full_name, c.cnic, c.ntn, c.client_code].filter(Boolean).some((v: string) => v.toLowerCase().includes(q)),
    ).slice(0, 15);
  }, [clients, search]);

  const isIndividual = kyc.client_type === "individual";
  const kycChecks = useMemo(() => {
    if (clientMode === "existing") {
      return [
        { label: "Client Information", ok: !!selected },
        { label: "Contact Details", ok: !!(selected?.email || selected?.phone) },
        { label: "CNIC / NTN", ok: !!(selected?.cnic || selected?.ntn) },
        { label: "Address", ok: !!selected?.address },
      ];
    }
    if (isIndividual) {
      return [
        { label: "Full Name", ok: !!kyc.full_name },
        { label: "CNIC", ok: !!kyc.cnic },
        { label: "Date of Birth", ok: !!kyc.date_of_birth },
        { label: "Mobile Number", ok: !!kyc.phone },
        { label: "Residential Address", ok: !!kyc.address },
        { label: "KYC Documents", ok: files.length > 0 },
      ];
    }
    return [
      { label: "Legal Name", ok: !!kyc.company_name },
      { label: "Entity Type", ok: !!kyc.entity_type },
      { label: "NTN", ok: !!kyc.ntn },
      { label: "Registration Number", ok: !!kyc.registration_number },
      { label: "Registered Address", ok: !!kyc.address },
      { label: "Authorized Person", ok: !!kyc.poc_name },
      { label: "Supporting Documents", ok: files.length > 0 },
    ];
  }, [clientMode, selected, kyc, files, isIndividual]);

  const kycPct = Math.round((kycChecks.filter((c) => c.ok).length / kycChecks.length) * 100);
  const kycComplete = kycPct === 100;

  const templates = (data?.templates ?? []).filter(
    (t: any) => t.insurance_class === cls && (!t.variant || (cls === "guarantee" && t.variant === guaranteeType)),
  );

  const totalMachinery = machines.reduce((s, m) => s + Number(m.value || 0), 0);

  const submit = async (asDraft: boolean) => {
    if (!kycComplete && !asDraft) return toast.error("Please complete the missing KYC requirements before proceeding.");
    setSaving(true);
    try {
      let cid = clientId;
      if (clientMode === "new") {
        const { data: created, error } = await (supabase as any).from("clients").insert({
          client_type: isIndividual ? "individual" : "corporate",
          company_name: isIndividual ? kyc.full_name : kyc.company_name,
          full_name: kyc.full_name || null,
          cnic: kyc.cnic || null,
          ntn: kyc.ntn || null,
          date_of_birth: kyc.date_of_birth || null,
          email: kyc.email || null,
          phone: kyc.phone || null,
          address: kyc.address || null,
          city: kyc.city || null,
          industry: kyc.nature_of_business || null,
          poc_name: kyc.poc_name || null,
          poc_designation: kyc.poc_designation || null,
          poc_number: kyc.poc_number || null,
          poc_email: kyc.poc_email || null,
          created_by: user?.id,
          do_id: user?.id,
        }).select("id").single();
        if (error) throw error;
        cid = created.id;
      }
      if (!cid) throw new Error("Please select a client");

      const details: any = { kyc: clientMode === "new" ? kyc : null };
      if (cls === "marine") details.marine = marine;
      if (cls === "fire") details.fire = { ...fire, machinery: machines.filter((m) => m.name), total_machinery_value: totalMachinery };

      const { data: req, error: rErr } = await (supabase as any).from("underwriting_requests").insert({
        client_id: cid,
        client_type: clientMode === "new" ? (isIndividual ? "individual" : "corporate") : selected?.client_type,
        insurance_class: cls,
        guarantee_request_type: cls === "guarantee" ? guaranteeType : null,
        product: form.product || null,
        insurer_id: form.insurer_id || null,
        agent_id: user?.id,
        created_by: user?.id,
        request_date: form.request_date,
        required_from: form.required_from || null,
        required_until: form.required_until || null,
        estimated_premium: Number(form.estimated_premium || 0),
        sum_insured: Number(form.sum_insured || 0),
        coverage_required: form.coverage_required || null,
        previous_insurer: form.previous_insurer || null,
        existing_policy_number: form.existing_policy_number || null,
        business_type: form.business_type,
        client_contact: form.client_contact || null,
        remarks: form.remarks || null,
        requirement_details: form.requirement_details || null,
        details,
        status: asDraft ? "draft" : "submitted",
      }).select("id").single();
      if (rErr) throw rErr;

      if (templates.length) {
        await (supabase as any).from("underwriting_request_requirements").insert(
          templates.map((t: any) => ({ request_id: req.id, label: t.label, mandatory: t.mandatory })),
        );
      }

      for (const f of files) {
        const path = `underwriting/${req.id}/${Date.now()}-${f.file.name}`;
        const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, f.file);
        if (upErr) continue;
        await (supabase as any).from("underwriting_documents").insert({
          request_id: req.id, name: f.file.name, doc_type: f.doc_type, file_path: path, uploaded_by: user?.id,
        });
      }

      toast.success(asDraft ? "Saved as draft" : "Underwriting request submitted");
      navigate({ to: "/operations/underwriting/$id", params: { id: req.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/operations/underwriting"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <h2 className="text-lg font-semibold">New Underwriting Request</h2>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {["Client & KYC", "Insurance Class", "Request Details", "Documents"].map((s, i) => (
            <span key={s} className={i + 1 === step ? "text-foreground font-medium" : ""}>{i + 1}. {s}</span>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Client Selection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={clientMode} onValueChange={(v) => setClientMode(v as any)} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="existing" /> Existing Client</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="new" /> New Client</label>
            </RadioGroup>

            {clientMode === "existing" ? (
              <div className="space-y-3">
                <Input placeholder="Search Client Name / CNIC / NTN / Client ID" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="border rounded-md divide-y max-h-72 overflow-auto">
                  {filtered.map((c: any) => (
                    <button key={c.id} onClick={() => setClientId(c.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${clientId === c.id ? "bg-muted" : ""}`}>
                      <div className="font-medium">{clientLabelOf(c)}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.client_type} · {c.cnic || c.ntn || c.client_code || "—"} · {c.phone || c.email || "—"}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && <div className="p-3 text-sm text-muted-foreground">No clients found.</div>}
                </div>
                {selected && (
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{clientLabelOf(selected)}</div>
                      <Button variant="outline" size="sm" asChild><Link to="/clients">View Client Profile</Link></Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      KYC, documents and previous history are loaded automatically from the client profile.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <Field label="Client Type">
                    <Select value={kyc.client_type} onValueChange={(v) => setKyc({ ...kyc, client_type: v, entity_type: v === "individual" ? "Individual" : "Private Limited Company" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Entity Type">
                    <Select value={kyc.entity_type} onValueChange={(v) => setKyc({ ...kyc, entity_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ENTITY_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>

                {isIndividual ? (
                  <div className="grid md:grid-cols-3 gap-3">
                    <Text label="Full Name" v={kyc.full_name} on={(v) => setKyc({ ...kyc, full_name: v })} />
                    <Text label="Father / Husband Name" v={kyc.father_name} on={(v) => setKyc({ ...kyc, father_name: v })} />
                    <Text label="CNIC" v={kyc.cnic} on={(v) => setKyc({ ...kyc, cnic: v })} />
                    <Field label="Date of Birth"><DateField value={kyc.date_of_birth} onChange={(v) => setKyc({ ...kyc, date_of_birth: v })} /></Field>
                    <Field label="Gender">
                      <Select value={kyc.gender} onValueChange={(v) => setKyc({ ...kyc, gender: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                      </Select>
                    </Field>
                    <Text label="Mobile Number" v={kyc.phone} on={(v) => setKyc({ ...kyc, phone: v })} />
                    <Text label="Email" v={kyc.email} on={(v) => setKyc({ ...kyc, email: v })} />
                    <Text label="City" v={kyc.city} on={(v) => setKyc({ ...kyc, city: v })} />
                    <Text label="Occupation" v={kyc.occupation} on={(v) => setKyc({ ...kyc, occupation: v })} />
                    <Text label="Nationality" v={kyc.nationality} on={(v) => setKyc({ ...kyc, nationality: v })} />
                    <div className="md:col-span-3"><Text label="Residential Address" v={kyc.address} on={(v) => setKyc({ ...kyc, address: v })} /></div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-3">
                    <Text label="Legal Name" v={kyc.company_name} on={(v) => setKyc({ ...kyc, company_name: v })} />
                    <Text label="Business / Trading Name" v={kyc.trading_name} on={(v) => setKyc({ ...kyc, trading_name: v })} />
                    <Text label="NTN" v={kyc.ntn} on={(v) => setKyc({ ...kyc, ntn: v })} />
                    <Text label="Registration Number" v={kyc.registration_number} on={(v) => setKyc({ ...kyc, registration_number: v })} />
                    <Field label="Date of Incorporation"><DateField value={kyc.incorporation_date} onChange={(v) => setKyc({ ...kyc, incorporation_date: v })} /></Field>
                    <Text label="Nature of Business" v={kyc.nature_of_business} on={(v) => setKyc({ ...kyc, nature_of_business: v })} />
                    <div className="md:col-span-3"><Text label="Registered Address" v={kyc.address} on={(v) => setKyc({ ...kyc, address: v })} /></div>
                    <div className="md:col-span-3"><Text label="Business Address" v={kyc.business_address} on={(v) => setKyc({ ...kyc, business_address: v })} /></div>
                    <Text label="Contact Person" v={kyc.poc_name} on={(v) => setKyc({ ...kyc, poc_name: v })} />
                    <Text label="Designation" v={kyc.poc_designation} on={(v) => setKyc({ ...kyc, poc_designation: v })} />
                    <Text label="Mobile" v={kyc.poc_number} on={(v) => setKyc({ ...kyc, poc_number: v })} />
                    <Text label="Email" v={kyc.poc_email} on={(v) => setKyc({ ...kyc, poc_email: v })} />
                    <Text label="Website" v={kyc.website} on={(v) => setKyc({ ...kyc, website: v })} />
                    <Text label="Principal Business Activity" v={kyc.principal_activity} on={(v) => setKyc({ ...kyc, principal_activity: v })} />
                    <Text label="City" v={kyc.city} on={(v) => setKyc({ ...kyc, city: v })} />
                  </div>
                )}

                <FileList files={files} setFiles={setFiles} title="KYC Documents" />
              </div>
            )}

            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">KYC Completion</div>
                <div className="text-sm tabular-nums">{kycPct}% Complete</div>
              </div>
              <Progress value={kycPct} className="h-2" />
              <div className="mt-3 grid sm:grid-cols-2 gap-1 text-sm">
                {kycChecks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2">
                    {c.ok ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                  </div>
                ))}
              </div>
              {!kycComplete && (
                <p className="text-xs text-amber-600 mt-2">Please complete the missing KYC requirements before proceeding.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button disabled={!kycComplete} onClick={() => setStep(2)}>Continue to Underwriting Request →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Insurance Class</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {UW_CLASSES.map((c) => (
                <button key={c.value} onClick={() => setCls(c.value)}
                  className={`rounded-md border px-3 py-3 text-sm text-left transition-colors ${cls === c.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}>
                  {c.label}
                </button>
              ))}
            </div>
            {cls === "guarantee" && (
              <div>
                <Label className="text-xs">Request Type</Label>
                <RadioGroup value={guaranteeType} onValueChange={setGuaranteeType} className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="quotation" /> Guarantee Quotation</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="issuance" /> Guarantee Issuance</label>
                </RadioGroup>
              </div>
            )}
            {templates.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Document / Information Checklist</div>
                <Table>
                  <TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Required</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {templates.map((t: any) => (
                      <TableRow key={t.id}><TableCell>{t.label}</TableCell><TableCell>{t.mandatory ? "Yes" : "Optional"}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Request Information</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <Text label="Insurance Product" v={form.product} on={(v) => setForm({ ...form, product: v })} />
              <Field label="Insurer">
                <Select value={form.insurer_id} onValueChange={(v) => setForm({ ...form, insurer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select insurer" /></SelectTrigger>
                  <SelectContent>{(data?.insurers ?? []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="New Business / Renewal">
                <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="new">New Business</SelectItem><SelectItem value="renewal">Renewal</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Request Date"><DateField value={form.request_date} onChange={(v) => setForm({ ...form, request_date: v })} /></Field>
              <Field label="Required From"><DateField value={form.required_from} onChange={(v) => setForm({ ...form, required_from: v })} /></Field>
              <Field label="Required Until"><DateField value={form.required_until} onChange={(v) => setForm({ ...form, required_until: v })} /></Field>
              <Field label="Estimated Premium"><MoneyInput value={form.estimated_premium} onChange={(v) => setForm({ ...form, estimated_premium: v })} /></Field>
              <Field label="Sum Insured"><MoneyInput value={form.sum_insured} onChange={(v) => setForm({ ...form, sum_insured: v })} /></Field>
              <Text label="Client Contact" v={form.client_contact} on={(v) => setForm({ ...form, client_contact: v })} />
              <Text label="Previous Insurer" v={form.previous_insurer} on={(v) => setForm({ ...form, previous_insurer: v })} />
              <Text label="Existing Policy Number" v={form.existing_policy_number} on={(v) => setForm({ ...form, existing_policy_number: v })} />
              <div className="md:col-span-3">
                <Label className="text-xs">Coverage Required</Label>
                <Textarea value={form.coverage_required ?? ""} onChange={(e) => setForm({ ...form, coverage_required: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Client Requirement / Request Details</Label>
                <Textarea rows={5} value={form.requirement_details ?? ""} onChange={(e) => setForm({ ...form, requirement_details: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Remarks</Label>
                <Textarea value={form.remarks ?? ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          {cls === "marine" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Marine Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <Text label="Bank Name" v={marine.bank_name} on={(v) => setMarine({ ...marine, bank_name: v })} />
                <Text label="Bank Location / Branch" v={marine.bank_branch} on={(v) => setMarine({ ...marine, bank_branch: v })} />
                <Text label="Commodity" v={marine.commodity} on={(v) => setMarine({ ...marine, commodity: v })} />
                <Text label="Incoterms" v={marine.incoterms} on={(v) => setMarine({ ...marine, incoterms: v })} />
                <Text label="Port of Loading" v={marine.port_loading} on={(v) => setMarine({ ...marine, port_loading: v })} />
                <Text label="Port of Discharge" v={marine.port_discharge} on={(v) => setMarine({ ...marine, port_discharge: v })} />
                <div className="md:col-span-3">
                  <Label className="text-xs">Additional Remarks (shipment details, special conditions)</Label>
                  <Textarea value={marine.remarks ?? ""} onChange={(e) => setMarine({ ...marine, remarks: e.target.value })} />
                </div>
                <p className="md:col-span-3 text-xs text-muted-foreground">Upload the Performa Invoice and supporting documents in the next step.</p>
              </CardContent>
            </Card>
          )}

          {cls === "fire" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Property Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <Text label="Name of Company" v={fire.company_name} on={(v) => setFire({ ...fire, company_name: v })} />
                  <Text label="Nature of Business" v={fire.nature_of_business} on={(v) => setFire({ ...fire, nature_of_business: v })} />
                  <Field label="Building Status">
                    <Select value={fire.building_status} onValueChange={(v) => setFire({ ...fire, building_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="owned">Owned</SelectItem><SelectItem value="rented">Rented</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <div className="md:col-span-3"><Text label="Location / Complete Address" v={fire.location} on={(v) => setFire({ ...fire, location: v })} /></div>
                  {fire.building_status === "owned" && (
                    <Field label="Building Value"><MoneyInput value={fire.building_value ?? 0} onChange={(v) => setFire({ ...fire, building_value: v })} /></Field>
                  )}
                  <Text label="Bank Name (if any)" v={fire.bank_name} on={(v) => setFire({ ...fire, bank_name: v })} />
                  <Text label="Previous Insurance Company" v={fire.previous_insurer} on={(v) => setFire({ ...fire, previous_insurer: v })} />
                  <div className="md:col-span-3">
                    <Label className="text-xs">Loss History (if any)</Label>
                    <Textarea value={fire.loss_history ?? ""} onChange={(e) => setFire({ ...fire, loss_history: e.target.value })} />
                  </div>
                </div>

                <Separator />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Raw Materials</div>
                    <Text label="Type of Stock" v={fire.raw_type} on={(v) => setFire({ ...fire, raw_type: v })} />
                    <Field label="Value of Stock (PKR)"><MoneyInput value={fire.raw_value ?? 0} onChange={(v) => setFire({ ...fire, raw_value: v })} /></Field>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Finished Goods</div>
                    <Text label="Type of Stock" v={fire.finished_type} on={(v) => setFire({ ...fire, finished_type: v })} />
                    <Field label="Value of Stock (PKR)"><MoneyInput value={fire.finished_value ?? 0} onChange={(v) => setFire({ ...fire, finished_value: v })} /></Field>
                  </div>
                </div>

                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Machinery Details</div>
                    <Button size="sm" variant="outline" onClick={() => setMachines([...machines, { name: "", description: "", quantity: "", value: "" }])}>
                      <Plus className="w-4 h-4 mr-1" /> Add Machinery
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Machinery</TableHead><TableHead>Description</TableHead><TableHead>Quantity</TableHead><TableHead>Value</TableHead><TableHead /></TableRow>
                    </TableHeader>
                    <TableBody>
                      {machines.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell><Input value={m.name} onChange={(e) => upd(i, "name", e.target.value)} /></TableCell>
                          <TableCell><Input value={m.description} onChange={(e) => upd(i, "description", e.target.value)} /></TableCell>
                          <TableCell><Input value={m.quantity} onChange={(e) => upd(i, "quantity", e.target.value)} /></TableCell>
                          <TableCell><Input value={m.value} onChange={(e) => upd(i, "value", e.target.value)} /></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setMachines(machines.filter((_, x) => x !== i))}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="text-sm mt-2 text-right">Total Machinery Value: <span className="font-semibold tabular-nums">{fmtPKR(totalMachinery)}</span></div>
                </div>

                <div>
                  <Label className="text-xs">Other Insurance Portfolio / Existing Covers</Label>
                  <Textarea value={fire.other_portfolio ?? ""} onChange={(e) => setFire({ ...fire, other_portfolio: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FileList files={files} setFiles={setFiles} title="Upload Documents" />
            {templates.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium mb-2">Checklist for this request</div>
                <div className="space-y-1 text-sm">
                  {templates.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <span>{t.label}</span>
                      <Badge variant={t.mandatory ? "default" : "secondary"}>{t.mandatory ? "Mandatory" : "Optional"}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Underwriting will mark each requirement as Received, Pending, Not Applicable, Rejected or Expired.</p>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={saving} onClick={() => submit(true)}>Save as Draft</Button>
                <Button disabled={saving} onClick={() => submit(false)}>Submit Underwriting</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  function upd(i: number, k: keyof Machine, v: string) {
    setMachines(machines.map((m, x) => (x === i ? { ...m, [k]: v } : m)));
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}

function Text({ label, v, on }: { label: string; v?: string; on: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" value={v ?? ""} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function FileList({ files, setFiles, title }: { files: { file: File; doc_type: string }[]; setFiles: (f: any) => void; title: string }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      <Input type="file" multiple onChange={(e) => {
        const list = Array.from(e.target.files ?? []).map((file) => ({ file, doc_type: "Other" }));
        setFiles([...files, ...list]);
        e.currentTarget.value = "";
      }} />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded border px-2 py-1">
              <span className="truncate">{f.file.name}</span>
              <Button size="icon" variant="ghost" onClick={() => setFiles(files.filter((_, x) => x !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
