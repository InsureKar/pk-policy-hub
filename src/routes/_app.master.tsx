import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/master")({
  component: MasterDataPage,
});

const TABLES = [
  { key: "insurance_companies", label: "Insurance Companies" },
  { key: "insurance_types", label: "Insurance Types" },
  { key: "lead_sources", label: "Lead Sources" },
  { key: "deal_stages", label: "Deal Stages" },
] as const;

function MasterDataPage() {
  const { hasRole } = useAuth();
  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Master Data" subtitle="Insurance companies, types, sources and pipeline stages." />
      <div className="grid md:grid-cols-2 gap-4">
        {TABLES.map((t) => <MasterTable key={t.key} table={t.key} label={t.label} />)}
      </div>
    </div>
  );
}

function MasterTable({ table, label }: { table: string; label: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["master", table],
    queryFn: async () => {
      const { data } = await supabase.from(table as any).select("*").order(table === "deal_stages" ? "sort_order" : "name");
      return data ?? [];
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    const payload: any = { name };
    if (table === "deal_stages") payload.sort_order = ((data?.length ?? 0) + 1) * 10;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) toast.error(error.message); else { setName(""); qc.invalidateQueries({ queryKey: ["master", table] }); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["master", table] });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder={`Add ${label.toLowerCase()}...`} onKeyDown={(e)=>e.key==="Enter"&&add()}/>
          <Button onClick={add} size="icon"><Plus className="w-4 h-4"/></Button>
        </div>
        <ul className="divide-y border rounded-md">
          {(data ?? []).map((r: any) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{r.name}{table === "deal_stages" && <span className="ml-2 text-xs text-muted-foreground">(order {r.sort_order})</span>}</span>
              <Button variant="ghost" size="icon" onClick={()=>remove(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground text-center">Empty</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
