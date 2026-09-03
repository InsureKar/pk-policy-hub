import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import {
  UW_CLASSES, UW_STATUS_LABEL, uwStatusClass, agingLabel, clientLabelOf,
  type UwStatus,
} from "@/lib/underwriting";

export const Route = createFileRoute("/_app/operations/underwriting/")({
  component: UnderwritingList,
});

function UnderwritingList() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "management"]);
  const [f, setF] = useState<any>({ cls: "all", status: "all", insurer: "all", scope: "all", q: "" });

  const { data } = useQuery({
    queryKey: ["uw-list"],
    queryFn: async () => {
      const sb = supabase as any;
      const [reqs, clients, insurers, profs] = await Promise.all([
        sb.from("underwriting_requests").select("*").order("created_at", { ascending: false }),
        sb.from("clients").select("id, company_name, full_name, client_type"),
        sb.from("insurance_companies").select("id, name"),
        sb.from("profiles").select("id, full_name, email"),
      ]);
      return {
        rows: reqs.data ?? [],
        clients: new Map<string, any>((clients.data ?? []).map((c: any) => [c.id, c])),
        insurers: insurers.data ?? [],
        insurerMap: new Map<string, any>((insurers.data ?? []).map((i: any) => [i.id, i])),
        profs: new Map<string, any>((profs.data ?? []).map((p: any) => [p.id, p])),
      };
    },
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const q = f.q.trim().toLowerCase();
    return all.filter((r: any) => {
      if (f.cls !== "all" && r.insurance_class !== f.cls) return false;
      if (f.status !== "all" && r.status !== f.status) return false;
      if (f.insurer !== "all" && r.insurer_id !== f.insurer) return false;
      if (f.scope === "mine" && r.agent_id !== user?.id) return false;
      if (q) {
        const client = clientLabelOf(data?.clients.get(r.client_id));
        if (![r.request_no, client, r.product].filter(Boolean).some((v: string) => v.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [data, f, user]);

  const mine = (data?.rows ?? []).filter((r: any) => r.agent_id === user?.id);
  const kpiSource = isAdmin ? (data?.rows ?? []) : mine;
  const count = (fn: (r: any) => boolean) => kpiSource.filter(fn).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">{isAdmin ? "Underwriting Requests" : "My Underwriting Requests"}</h2>
        <div className="flex gap-2">
          {isAdmin && <ChecklistSettings />}
          <Button asChild><Link to="/operations/underwriting/new"><Plus className="w-4 h-4 mr-1" /> New Underwriting Request</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Total" value={kpiSource.length} />
        <Kpi label="Pending" value={count((r) => !["completed", "won", "policy_issued"].includes(r.status))} />
        <Kpi label="Info Required" value={count((r) => r.status === "information_required")} />
        <Kpi label="Payment Pending" value={count((r) => r.status === "payment_pending")} />
        <Kpi label="Issued" value={count((r) => r.status === "policy_issued")} />
        <Kpi label="Won" value={count((r) => r.status === "won")} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <Input placeholder="Search request / client / product" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <Select value={f.cls} onValueChange={(v) => setF({ ...f, cls: v })}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {UW_CLASSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {Object.entries(UW_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.insurer} onValueChange={(v) => setF({ ...f, insurer: v })}>
              <SelectTrigger><SelectValue placeholder="Insurer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Insurers</SelectItem>
                {(data?.insurers ?? []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.scope} onValueChange={(v) => setF({ ...f, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="mine">My Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead><TableHead>Client</TableHead><TableHead>Class</TableHead>
                <TableHead>Insurer</TableHead><TableHead className="text-right">Premium</TableHead>
                <TableHead>Stage</TableHead><TableHead>Agent</TableHead><TableHead>Aging</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.request_no}</TableCell>
                  <TableCell>{clientLabelOf(data?.clients.get(r.client_id))}</TableCell>
                  <TableCell>{UW_CLASSES.find((c) => c.value === r.insurance_class)?.label}</TableCell>
                  <TableCell>{data?.insurerMap.get(r.insurer_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPKR(Number(r.premium ?? r.estimated_premium ?? 0))}</TableCell>
                  <TableCell><Badge variant="outline" className={uwStatusClass(r.status as UwStatus)}>{UW_STATUS_LABEL[r.status as UwStatus]}</Badge></TableCell>
                  <TableCell className="text-sm">{data?.profs.get(r.agent_id)?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{agingLabel(r.created_at)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/operations/underwriting/$id" params={{ id: r.id }}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No underwriting requests yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="text-xs text-muted-foreground">Requested {fmtDate(new Date())} · {rows.length} request(s)</div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
    </CardContent></Card>
  );
}

function ChecklistSettings() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cls, setCls] = useState<string>("marine");
  const [variant, setVariant] = useState<string>("quotation");
  const [label, setLabel] = useState("");
  const [mandatory, setMandatory] = useState(true);

  const { data } = useQuery({
    queryKey: ["uw-templates"],
    queryFn: async () => (await (supabase as any).from("underwriting_requirement_templates").select("*").order("sort_order")).data ?? [],
    enabled: open,
  });

  const rows = (data ?? []).filter((t: any) => t.insurance_class === cls && (cls !== "guarantee" || t.variant === variant));

  const add = async () => {
    if (!label.trim()) return toast.error("Requirement label required");
    const { error } = await (supabase as any).from("underwriting_requirement_templates").insert({
      insurance_class: cls, variant: cls === "guarantee" ? variant : null,
      label: label.trim(), mandatory, sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    setLabel("");
    qc.invalidateQueries({ queryKey: ["uw-templates"] });
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("underwriting_requirement_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["uw-templates"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Settings2 className="w-4 h-4 mr-1" /> Checklist Settings</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Insurance Class → Requirements</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Insurance Class</Label>
              <Select value={cls} onValueChange={setCls}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{UW_CLASSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {cls === "guarantee" && (
              <div>
                <Label className="text-xs">Request Type</Label>
                <Select value={variant} onValueChange={setVariant}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quotation">Guarantee Quotation</SelectItem>
                    <SelectItem value="issuance">Guarantee Issuance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="border rounded-md divide-y max-h-64 overflow-auto">
            {rows.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{t.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={t.mandatory ? "default" : "secondary"}>{t.mandatory ? "Mandatory" : "Optional"}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="p-3 text-sm text-muted-foreground">No requirements configured.</div>}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">New Requirement</Label>
              <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Letter of Credit" />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={mandatory} onCheckedChange={setMandatory} /><span className="text-sm">Mandatory</span>
            </div>
            <Button onClick={add}>Add</Button>
          </div>
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
