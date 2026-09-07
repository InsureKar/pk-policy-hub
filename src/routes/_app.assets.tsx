import { useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtPKR, fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { SubHeadTabs } from "@/components/SubHeadTabs";
import { DeleteButton } from "@/components/DeleteButton";
import { DateField } from "@/components/DateField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Boxes } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assets")({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: "Asset Register — Admin | Insurance CRM" },
      { name: "description", content: "Company asset register with purchase date, cost, depreciation and current book value." },
      { property: "og:title", content: "Asset Register — Admin" },
      { property: "og:description", content: "Track company assets, purchase cost, depreciation and current book value." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PERM = "admin.assets";

const CATEGORIES = ["IT Equipment", "Furniture & Fixtures", "Vehicle", "Office Equipment", "Building", "Software", "Other"];
const STATUSES = ["active", "in_repair", "disposed", "written_off"];
const STATUS_LABEL: Record<string, string> = {
  active: "Active", in_repair: "In Repair", disposed: "Disposed", written_off: "Written Off",
};

const SUB_HEADS = [
  { value: "register", label: "Asset Register" },
  { value: "depreciation", label: "Depreciation Schedule" },
];

interface AssetRow {
  id: string;
  name: string;
  category: string | null;
  serial_number: string | null;
  assigned_to: string | null;
  location: string | null;
  purchase_date: string;
  purchase_cost: number;
  salvage_value: number;
  useful_life_years: number;
  depreciation_method: string;
  status: string;
  notes: string | null;
}

const emptyForm = () => ({
  name: "",
  category: "IT Equipment",
  serial_number: "",
  assigned_to: "",
  location: "",
  purchase_date: new Date().toISOString().slice(0, 10),
  purchase_cost: "",
  salvage_value: "",
  useful_life_years: "5",
  depreciation_method: "straight_line",
  status: "active",
  notes: "",
});

/** Straight-line depreciation figures for one asset. */
export function depreciationOf(a: AssetRow) {
  const cost = Number(a.purchase_cost || 0);
  const salvage = Math.min(Number(a.salvage_value || 0), cost);
  const life = Math.max(1, Number(a.useful_life_years || 1));
  const perYear = (cost - salvage) / life;
  const start = new Date(a.purchase_date);
  const years = Math.max(0, (Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
  const elapsed = Math.min(years, life);
  const accumulated = Math.min(cost - salvage, perYear * elapsed);
  return {
    perYear,
    perMonth: perYear / 12,
    yearsElapsed: elapsed,
    accumulated,
    bookValue: Math.max(salvage, cost - accumulated),
    fullyDepreciated: elapsed >= life,
  };
}

function AssetsPage() {
  const { allow, levelOf, loading, user } = useAuth();
  const qc = useQueryClient();
  const [head, setHead] = useState("register");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const [assets, profiles] = await Promise.all([
        supabase.from("assets" as any).select("*").order("purchase_date", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      return {
        assets: ((assets.data ?? []) as unknown as AssetRow[]),
        profiles: (profiles.data ?? []) as { id: string; full_name: string | null; email: string }[],
      };
    },
  });

  const rows = useMemo(() => {
    const list = data?.assets ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(a =>
      [a.name, a.category, a.serial_number, a.location].some(v => (v ?? "").toLowerCase().includes(term)));
  }, [data, q]);

  const totals = useMemo(() => rows.reduce((acc, a) => {
    const d = depreciationOf(a);
    acc.cost += Number(a.purchase_cost || 0);
    acc.accumulated += d.accumulated;
    acc.book += d.bookValue;
    return acc;
  }, { cost: 0, accumulated: 0, book: 0 }), [rows]);

  if (loading) return null;
  if (!allow(PERM, "view")) return <Navigate to="/dashboard" replace />;

  const canAdd = allow(PERM, "add");
  const canEdit = allow(PERM, "edit");

  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const p = data?.profiles.find(x => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (a: AssetRow) => {
    setEditing(a);
    setForm({
      name: a.name,
      category: a.category ?? "Other",
      serial_number: a.serial_number ?? "",
      assigned_to: a.assigned_to ?? "",
      location: a.location ?? "",
      purchase_date: a.purchase_date?.slice(0, 10) ?? "",
      purchase_cost: String(a.purchase_cost ?? ""),
      salvage_value: String(a.salvage_value ?? ""),
      useful_life_years: String(a.useful_life_years ?? 5),
      depreciation_method: a.depreciation_method ?? "straight_line",
      status: a.status ?? "active",
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Asset name is required");
    if (!form.purchase_date) return toast.error("Purchase date is required");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      category: form.category || null,
      serial_number: form.serial_number.trim() || null,
      assigned_to: form.assigned_to || null,
      location: form.location.trim() || null,
      purchase_date: form.purchase_date,
      purchase_cost: Number(form.purchase_cost || 0),
      salvage_value: Number(form.salvage_value || 0),
      useful_life_years: Math.max(1, Number(form.useful_life_years || 1)),
      depreciation_method: form.depreciation_method,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const res = editing
      ? await (supabase as any).from("assets").update(payload).eq("id", editing.id)
      : await (supabase as any).from("assets").insert({ ...payload, created_by: user?.id ?? null });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Asset updated" : "Asset added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["assets"] });
  };

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      <PageHeader
        title="Assets"
        subtitle="Company asset register with purchase cost, depreciation and current book value. Visibility follows the Assets setting in Access & Permissions."
        actions={canAdd ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Asset</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Edit Asset" : "New Asset"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Asset Name</div>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dell Latitude 5540" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Serial / Tag No.</div>
                  <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Purchase Date</div>
                  <DateField value={form.purchase_date} onChange={v => setForm({ ...form, purchase_date: v })} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Purchase Cost (PKR)</div>
                  <Input type="number" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Salvage Value (PKR)</div>
                  <Input type="number" value={form.salvage_value} onChange={e => setForm({ ...form, salvage_value: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Useful Life (years)</div>
                  <Input type="number" min={1} value={form.useful_life_years} onChange={e => setForm({ ...form, useful_life_years: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Assigned To</div>
                  <Select value={form.assigned_to || "none"} onValueChange={v => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {data?.profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Location</div>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Head Office — Karachi" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Notes</div>
                  <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Asset"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <div className="mb-4"><SubHeadTabs value={head} onChange={setHead} items={SUB_HEADS} /></div>

      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Assets</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total Purchase Value</div>
          <div className="text-xl font-semibold">{fmtPKR(totals.cost)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Accumulated Depreciation</div>
          <div className="text-xl font-semibold">{fmtPKR(totals.accumulated)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Current Book Value</div>
          <div className="text-xl font-semibold">{fmtPKR(totals.book)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="w-4 h-4" /> {head === "register" ? "Asset Register" : "Depreciation Schedule"}
          </CardTitle>
          <Input className="max-w-[240px]" placeholder="Search assets…" value={q} onChange={e => setQ(e.target.value)} />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {head === "register" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Serial / Tag</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Purchase Value</TableHead>
                    <TableHead className="text-right">Book Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No assets recorded yet.</TableCell></TableRow>
                  ) : rows.map(a => {
                    const d = depreciationOf(a);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.category ?? "—"}</TableCell>
                        <TableCell>{a.serial_number ?? "—"}</TableCell>
                        <TableCell>{nameOf(a.assigned_to)}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(a.purchase_date)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(a.purchase_cost)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(d.bookValue)}</TableCell>
                        <TableCell><Badge variant={a.status === "active" ? "default" : "outline"}>{STATUS_LABEL[a.status] ?? a.status}</Badge></TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {canEdit && (
                            <Button variant="ghost" size="icon" title="Edit asset" aria-label="Edit asset" onClick={() => openEdit(a)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {allow(PERM, "delete") && (
                            <DeleteButton table="assets" id={a.id} label="asset" invalidate={["assets"]} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Salvage</TableHead>
                    <TableHead className="text-right">Life (yrs)</TableHead>
                    <TableHead className="text-right">Yearly</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-right">Accumulated</TableHead>
                    <TableHead className="text-right">Book Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No assets recorded yet.</TableCell></TableRow>
                  ) : rows.map(a => {
                    const d = depreciationOf(a);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.name}
                          {d.fullyDepreciated && <Badge variant="outline" className="ml-2">Fully depreciated</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(a.purchase_date)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(a.purchase_cost)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(a.salvage_value)}</TableCell>
                        <TableCell className="text-right">{a.useful_life_years}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(d.perYear)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(d.perMonth)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(d.accumulated)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPKR(d.bookValue)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Depreciation is straight-line: (purchase cost − salvage value) ÷ useful life. Your access level for this
            screen is <span className="font-medium">{levelOf(PERM)}</span>, set under Access &amp; Permissions → Admin → Assets.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
