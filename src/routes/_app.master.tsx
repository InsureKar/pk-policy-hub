import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Search = { tab?: string };

export const Route = createFileRoute("/_app/master")({
  validateSearch: (s: Record<string, unknown>): Search => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  component: MasterDataPage,
});

const LINES = [
  { key: "group_health", label: "Group Health" },
  { key: "motor", label: "Motor" },
  { key: "marine", label: "Marine" },
  { key: "travel", label: "Travel" },
  { key: "fire", label: "Fire" },
  { key: "misc", label: "Miscellaneous" },
] as const;

function MasterDataPage() {
  const { hasRole } = useAuth();
  const search = useSearch({ from: "/_app/master" });
  const [tab, setTab] = useState(search.tab ?? "companies");
  useEffect(() => { if (search.tab) setTab(search.tab); }, [search.tab]);

  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Master Data" subtitle="Insurance companies, commission rates, categories, products and pipeline configuration." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="companies">Insurance Companies</TabsTrigger>
          <TabsTrigger value="commissions">Commission Settings</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="policy_types">Policy Types</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Stages</TabsTrigger>
          <TabsTrigger value="sources">Lead Sources</TabsTrigger>
          <TabsTrigger value="premium">Tagged Premium</TabsTrigger>
        </TabsList>

        <TabsContent value="companies"><CompaniesTab/></TabsContent>
        <TabsContent value="commissions"><CommissionsTab/></TabsContent>
        <TabsContent value="categories"><SimpleTab table="insurance_types" label="Category" description="Insurance categories (used as deal category)."/></TabsContent>
        <TabsContent value="products"><SimpleTab table="insurance_types" label="Product" description="Insurance products offered."/></TabsContent>
        <TabsContent value="policy_types"><SimpleTab table="insurance_types" label="Policy Type" description="Policy classification types."/></TabsContent>
        <TabsContent value="pipeline"><SimpleTab table="deal_stages" label="Pipeline Stage" description="Order controls the Kanban columns." ordered/></TabsContent>
        <TabsContent value="sources"><SimpleTab table="lead_sources" label="Lead Source" description="Where leads come from."/></TabsContent>
        <TabsContent value="premium"><TaggedPremiumTab/></TabsContent>
      </Tabs>
    </div>
  );
}

function CompaniesTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["ic"],
    queryFn: async () => (await supabase.from("insurance_companies").select("*").order("name")).data ?? [],
  });
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("insurance_companies").insert({ name });
    if (error) toast.error(error.message);
    else {
      setName("");
      // seed commission rows for the new company
      const { data: created } = await supabase.from("insurance_companies").select("id").eq("name", name).single();
      if (created) {
        await supabase.from("company_commission_rates").insert(
          LINES.map(l => ({ company_id: created.id, line_of_business: l.key, percentage: 0 }))
        );
      }
      qc.invalidateQueries({ queryKey: ["ic"] });
      qc.invalidateQueries({ queryKey: ["ccr"] });
    }
  };
  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("insurance_companies").update({ active: !active }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["ic"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this insurance company and all its commission settings?")) return;
    const { error } = await supabase.from("insurance_companies").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["ic"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Insurance Companies</CardTitle><CardDescription>Add, activate, deactivate or remove insurers.</CardDescription></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3 max-w-md">
          <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Company name" onKeyDown={(e)=>e.key==="Enter"&&add()}/>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1"/>Add</Button>
        </div>
        <div className="border rounded-md divide-y">
          {(data ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="font-medium">{c.name}</span>
                <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={()=>toggle(c.id, c.active)}>{c.active ? "Deactivate" : "Activate"}</Button>
                <Button variant="ghost" size="icon" onClick={()=>remove(c.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No companies yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function CommissionsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ccr"],
    queryFn: async () => {
      const [cos, rates] = await Promise.all([
        supabase.from("insurance_companies").select("id, name").order("name"),
        supabase.from("company_commission_rates").select("*"),
      ]);
      return { cos: cos.data ?? [], rates: rates.data ?? [] };
    },
  });

  const set = async (company_id: string, line: string, value: string) => {
    const num = Number(value);
    if (isNaN(num)) return;
    const { error } = await supabase.from("company_commission_rates")
      .upsert({ company_id, line_of_business: line as any, percentage: num }, { onConflict: "company_id,line_of_business" });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["ccr"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Commission Settings</CardTitle><CardDescription>Percentage per line of business, per insurance company. Applied automatically across deals.</CardDescription></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Company</th>
              {LINES.map(l => <th key={l.key} className="text-right px-3 py-2">{l.label} %</th>)}
            </tr>
          </thead>
          <tbody>
            {(data?.cos ?? []).map(c => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                {LINES.map(l => {
                  const rate = data?.rates.find(r => r.company_id === c.id && r.line_of_business === l.key);
                  return (
                    <td key={l.key} className="px-3 py-1.5">
                      <Input type="number" step="0.01" className="h-8 w-20 ml-auto text-right"
                        defaultValue={rate?.percentage ?? 0}
                        onBlur={(e)=>set(c.id, l.key, e.target.value)}/>
                    </td>
                  );
                })}
              </tr>
            ))}
            {(data?.cos ?? []).length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Add an insurance company first.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function SimpleTab({ table, label, description, ordered }: { table: string; label: string; description: string; ordered?: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["m", table],
    queryFn: async () => (await supabase.from(table as any).select("*").order(ordered ? "sort_order" : "name")).data ?? [],
  });
  const add = async () => {
    if (!name.trim()) return;
    const payload: any = { name };
    if (ordered) payload.sort_order = ((data?.length ?? 0) + 1) * 10;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) toast.error(error.message); else { setName(""); qc.invalidateQueries({ queryKey: ["m", table] }); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["m", table] });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}s</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3 max-w-md">
          <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder={`Add ${label.toLowerCase()}...`} onKeyDown={(e)=>e.key==="Enter"&&add()}/>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1"/>Add</Button>
        </div>
        <ul className="divide-y border rounded-md">
          {(data ?? []).map((r: any) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{r.name}{ordered && <span className="ml-2 text-xs text-muted-foreground">(order {r.sort_order})</span>}</span>
              <Button variant="ghost" size="icon" onClick={()=>remove(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground text-center">Empty</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function TaggedPremiumTab() {
  const qc = useQueryClient();
  const [basePct, setBasePct] = useState("13");
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*")).data ?? [],
  });
  useEffect(() => {
    const s = data?.find(x => x.key === "tagged_premium_base_percentage");
    if (s) setBasePct(String(s.value));
  }, [data]);
  const save = async () => {
    const num = Number(basePct);
    if (!num || num <= 0) { toast.error("Enter a valid percentage"); return; }
    const { error } = await supabase.from("app_settings").upsert({ key: "tagged_premium_base_percentage", value: num as any });
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["settings"] }); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tagged Premium Base</CardTitle><CardDescription>Global base percentage used across all deals to compute tagged premium.</CardDescription></CardHeader>
      <CardContent className="space-y-3 max-w-sm">
        <div>
          <Label className="text-xs">Base Percentage (%)</Label>
          <div className="flex gap-2 mt-1.5">
            <Input type="number" step="0.01" value={basePct} onChange={(e)=>setBasePct(e.target.value)}/>
            <Button onClick={save}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Tagged Premium = (Income % ÷ Base %) × Gross Premium. Default 13%.</p>
        </div>
      </CardContent>
    </Card>
  );
}
