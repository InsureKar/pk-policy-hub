import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DateField } from "@/components/DateField";
import { MoneyInput } from "@/components/MoneyInput";
import { ArrowLeft, Trash2 } from "lucide-react";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import {
  UW_CLASSES, UW_STATUS_LABEL, uwStatusClass, stageFlow, clientLabelOf,
  REQ_STATUSES, REQ_STATUS_LABEL, DOC_TYPES, type UwStatus, type UwClass, type ReqStatus,
} from "@/lib/underwriting";

export const Route = createFileRoute("/_app/operations/underwriting/$id")({
  component: UnderwritingDetail,
});

function UnderwritingDetail() {
  const { id } = Route.useParams();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole(["admin", "management"]);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("Other");
  const [pay, setPay] = useState<any>({});

  const { data } = useQuery({
    queryKey: ["uw", id],
    queryFn: async () => {
      const sb = supabase as any;
      const [req, docs, acts, items, profs, insurers] = await Promise.all([
        sb.from("underwriting_requests").select("*").eq("id", id).maybeSingle(),
        sb.from("underwriting_documents").select("*").eq("request_id", id).order("created_at", { ascending: false }),
        sb.from("underwriting_activity").select("*").eq("request_id", id).order("created_at", { ascending: true }),
        sb.from("underwriting_request_requirements").select("*").eq("request_id", id).order("created_at"),
        sb.from("profiles").select("id, full_name, email"),
        sb.from("insurance_companies").select("id, name"),
      ]);
      let client: any = null;
      if (req.data?.client_id) {
        client = (await sb.from("clients").select("*").eq("id", req.data.client_id).maybeSingle()).data;
      }
      return {
        req: req.data,
        client,
        docs: docs.data ?? [],
        acts: acts.data ?? [],
        items: items.data ?? [],
        profs: new Map<string, any>((profs.data ?? []).map((p: any) => [p.id, p])),
        insurers: new Map<string, any>((insurers.data ?? []).map((i: any) => [i.id, i])),
      };
    },
  });

  const r = data?.req;
  const refresh = () => qc.invalidateQueries({ queryKey: ["uw", id] });

  const patch = async (p: any) => {
    const { error } = await (supabase as any).from("underwriting_requests").update(p).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const setStatus = async (s: UwStatus) => {
    await patch({ status: s });
    toast.success(`Stage → ${UW_STATUS_LABEL[s]}`);
  };

  const upload = async () => {
    if (!file) return;
    const path = `underwriting/${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error } = await (supabase as any).from("underwriting_documents").insert({
      request_id: id, name: file.name, doc_type: docType, file_path: path, uploaded_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setFile(null);
    toast.success("Document uploaded");
    refresh();
  };

  const openDoc = async (p: string) => {
    const { data: signed } = await supabase.storage.from("crm-documents").createSignedUrl(p, 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  const confirmPayment = async () => {
    if (!r) return;
    const premium = Number(pay.premium ?? r.premium ?? r.estimated_premium ?? 0);
    let receiptPath: string | null = null;
    if (pay.receipt) {
      const path = `underwriting/${id}/receipt-${Date.now()}-${pay.receipt.name}`;
      const { error } = await supabase.storage.from("crm-documents").upload(path, pay.receipt);
      if (!error) {
        receiptPath = path;
        await (supabase as any).from("underwriting_documents").insert({
          request_id: id, name: pay.receipt.name, doc_type: "Payment Receipt", file_path: path, uploaded_by: user?.id,
        });
      }
    }
    await patch({
      payment_received: true,
      payment_date: pay.payment_date || new Date().toISOString().slice(0, 10),
      premium,
      policy_number: pay.policy_number || r.policy_number,
      status: "won",
    });
    await (supabase as any).from("underwriting_activity").insert([
      { request_id: id, actor_id: user?.id, action: "Policy Issued", detail: pay.policy_number ? `Policy ${pay.policy_number}` : "Policy issued" },
      { request_id: id, actor_id: user?.id, action: "Lead Converted to WON", detail: `Premium ${fmtPKR(premium)}${receiptPath ? " · receipt attached" : ""}` },
    ]);
    toast.success("Payment confirmed — request completed and lead marked Won");
    setPay({});
    refresh();
  };

  if (!r) return <div className="text-muted-foreground text-sm">Loading request…</div>;

  const flow = stageFlow(r.insurance_class as UwClass, r.guarantee_request_type);
  const details = r.details ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/operations/underwriting"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <div>
            <div className="text-lg font-semibold">{r.request_no} · {clientLabelOf(data?.client)}</div>
            <div className="text-xs text-muted-foreground">
              {UW_CLASSES.find((c) => c.value === r.insurance_class)?.label}
              {r.guarantee_request_type ? ` · ${r.guarantee_request_type === "quotation" ? "Guarantee Quotation" : "Guarantee Issuance"}` : ""}
              {" · "}{data?.insurers.get(r.insurer_id)?.name ?? "No insurer"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={uwStatusClass(r.status as UwStatus)}>{UW_STATUS_LABEL[r.status as UwStatus]}</Badge>
          <Select value={r.status} onValueChange={(v) => setStatus(v as UwStatus)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{flow.map((s) => <SelectItem key={s} value={s}>{UW_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Request Information</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
              <Info label="Client Type" v={r.client_type} />
              <Info label="Product" v={r.product} />
              <Info label="Business" v={r.business_type === "renewal" ? "Renewal" : "New Business"} />
              <Info label="Request Date" v={fmtDate(r.request_date)} />
              <Info label="Required From" v={r.required_from ? fmtDate(r.required_from) : "—"} />
              <Info label="Required Until" v={r.required_until ? fmtDate(r.required_until) : "—"} />
              <Info label="Estimated Premium" v={fmtPKR(Number(r.estimated_premium || 0))} />
              <Info label="Sum Insured" v={fmtPKR(Number(r.sum_insured || 0))} />
              <Info label="Sales Agent" v={data?.profs.get(r.agent_id)?.full_name ?? "—"} />
              <Info label="Previous Insurer" v={r.previous_insurer} />
              <Info label="Existing Policy No." v={r.existing_policy_number} />
              <Info label="Client Contact" v={r.client_contact} />
              {r.coverage_required && <div className="sm:col-span-3"><Info label="Coverage Required" v={r.coverage_required} /></div>}
              {r.requirement_details && <div className="sm:col-span-3"><Info label="Client Requirement / Request Details" v={r.requirement_details} /></div>}
              {r.remarks && <div className="sm:col-span-3"><Info label="Remarks" v={r.remarks} /></div>}
            </CardContent>
          </Card>

          {details.marine && (
            <Card>
              <CardHeader><CardTitle className="text-base">Marine Details</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
                <Info label="Bank Name" v={details.marine.bank_name} />
                <Info label="Bank Location / Branch" v={details.marine.bank_branch} />
                <Info label="Commodity" v={details.marine.commodity} />
                <Info label="Incoterms" v={details.marine.incoterms} />
                <Info label="Port of Loading" v={details.marine.port_loading} />
                <Info label="Port of Discharge" v={details.marine.port_discharge} />
                {details.marine.remarks && <div className="sm:col-span-3"><Info label="Remarks" v={details.marine.remarks} /></div>}
              </CardContent>
            </Card>
          )}

          {details.fire && (
            <Card>
              <CardHeader><CardTitle className="text-base">Property Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid sm:grid-cols-3 gap-3">
                  <Info label="Name of Company" v={details.fire.company_name} />
                  <Info label="Nature of Business" v={details.fire.nature_of_business} />
                  <Info label="Building Status" v={details.fire.building_status} />
                  <div className="sm:col-span-3"><Info label="Location" v={details.fire.location} /></div>
                  <Info label="Building Value" v={fmtPKR(Number(details.fire.building_value || 0))} />
                  <Info label="Bank Name" v={details.fire.bank_name} />
                  <Info label="Previous Insurer" v={details.fire.previous_insurer} />
                  <Info label="Raw Material" v={`${details.fire.raw_type ?? "—"} · ${fmtPKR(Number(details.fire.raw_value || 0))}`} />
                  <Info label="Finished Goods" v={`${details.fire.finished_type ?? "—"} · ${fmtPKR(Number(details.fire.finished_value || 0))}`} />
                  <Info label="Total Machinery Value" v={fmtPKR(Number(details.fire.total_machinery_value || 0))} />
                </div>
                {(details.fire.machinery ?? []).length > 0 && (
                  <Table>
                    <TableHeader><TableRow><TableHead>Machinery</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {details.fire.machinery.map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{m.name}</TableCell><TableCell>{m.description}</TableCell><TableCell>{m.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtPKR(Number(m.value || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {details.fire.loss_history && <Info label="Loss History" v={details.fire.loss_history} />}
                {details.fire.other_portfolio && <Info label="Other Insurance Portfolio" v={details.fire.other_portfolio} />}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Requirement Checklist</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Required</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.items ?? []).map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.label}</TableCell>
                      <TableCell>{it.mandatory ? "Yes" : "Optional"}</TableCell>
                      <TableCell>
                        <Select value={it.status} onValueChange={async (v) => {
                          const { error } = await (supabase as any).from("underwriting_request_requirements").update({ status: v }).eq("id", it.id);
                          if (error) return toast.error(error.message);
                          refresh();
                        }}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REQ_STATUSES.map((s) => <SelectItem key={s} value={s}>{REQ_STATUS_LABEL[s as ReqStatus]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.items ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center py-4">No checklist items.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">File</Label>
                  <Input type="file" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="w-56 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={upload} disabled={!file}>Upload</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Uploaded By</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {(data?.docs ?? []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <button className="text-primary hover:underline" onClick={() => d.file_path && openDoc(d.file_path)}>{d.name}</button>
                      </TableCell>
                      <TableCell>{d.doc_type ?? "—"}</TableCell>
                      <TableCell>{data?.profs.get(d.uploaded_by)?.full_name ?? "—"}</TableCell>
                      <TableCell>{fmtDate(d.created_at)}</TableCell>
                      <TableCell><Badge variant="secondary">{d.status}</Badge></TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={async () => {
                            await (supabase as any).from("underwriting_documents").delete().eq("id", d.id);
                            refresh();
                          }}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.docs ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center py-4">No documents.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payment → Won Lead</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {r.payment_received ? (
                <div className="space-y-1">
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30" variant="outline">Payment Received</Badge>
                  <div>Date: {fmtDate(r.payment_date)}</div>
                  <div>Premium: {fmtPKR(Number(r.premium || 0))}</div>
                  <div>Policy No.: {r.policy_number ?? "—"}</div>
                </div>
              ) : (
                <>
                  <div><Label className="text-xs">Premium</Label>
                    <MoneyInput value={pay.premium ?? r.estimated_premium ?? 0} onChange={(v) => setPay({ ...pay, premium: v })} /></div>
                  <div><Label className="text-xs">Payment Date</Label>
                    <DateField value={pay.payment_date} onChange={(v) => setPay({ ...pay, payment_date: v })} /></div>
                  <div><Label className="text-xs">Policy Number</Label>
                    <Input className="mt-1" value={pay.policy_number ?? ""} onChange={(e) => setPay({ ...pay, policy_number: e.target.value })} /></div>
                  <div><Label className="text-xs">Payment Receipt</Label>
                    <Input type="file" className="mt-1" onChange={(e) => setPay({ ...pay, receipt: e.target.files?.[0] ?? null })} /></div>
                  <Button className="w-full" disabled={!isAdmin} onClick={confirmPayment}>Confirm Payment Received</Button>
                  {!isAdmin && <p className="text-xs text-muted-foreground">Only Finance (Admin / Management) can confirm payment.</p>}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="font-medium">{clientLabelOf(data?.client)}</div>
              <div className="text-muted-foreground text-xs">{data?.client?.cnic || data?.client?.ntn || "—"}</div>
              <div className="text-muted-foreground text-xs">{data?.client?.phone || data?.client?.email || "—"}</div>
              <Separator className="my-2" />
              <Button variant="outline" size="sm" asChild className="w-full"><Link to="/clients">View Client Profile</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Request Timeline</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(data?.acts ?? []).map((a: any) => (
                  <li key={a.id} className="text-sm border-l-2 border-border pl-3">
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()} — {data?.profs.get(a.actor_id)?.full_name ?? "System"}
                    </div>
                    <div className="font-medium">{a.action}</div>
                    {a.detail && <div className="text-muted-foreground">{a.detail}</div>}
                  </li>
                ))}
                {(data?.acts ?? []).length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
              </ol>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader><CardTitle className="text-base">Underwriter Note</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <NoteBox requestId={id} onDone={refresh} userId={user?.id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteBox({ requestId, onDone, userId }: { requestId: string; onDone: () => void; userId?: string }) {
  const [text, setText] = useState("");
  return (
    <>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note to the timeline (e.g. information required)" />
      <Button size="sm" onClick={async () => {
        if (!text.trim()) return;
        const { error } = await (supabase as any).from("underwriting_activity").insert({
          request_id: requestId, actor_id: userId, action: "Note", detail: text.trim(),
        });
        if (error) return toast.error(error.message);
        setText("");
        onDone();
      }}>Add Note</Button>
    </>
  );
}

function Info({ label, v }: { label: string; v?: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap">{v || "—"}</div>
    </div>
  );
}
