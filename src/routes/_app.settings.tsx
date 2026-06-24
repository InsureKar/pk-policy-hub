import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [basePct, setBasePct] = useState("13");

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*");
      return data ?? [];
    },
  });

  useEffect(() => {
    const s = data?.find(x => x.key === "tagged_premium_base_percentage");
    if (s) setBasePct(String(s.value));
  }, [data]);

  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;

  const save = async () => {
    const num = Number(basePct);
    if (!num || num <= 0) { toast.error("Enter a valid percentage"); return; }
    const { error } = await supabase.from("app_settings").upsert({ key: "tagged_premium_base_percentage", value: num as any });
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["settings"] }); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Global business rules used across the CRM." />
      <Card>
        <CardHeader><CardTitle className="text-base">Tagged Premium</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Base Percentage (%)</Label>
            <div className="flex gap-2 mt-1.5 max-w-xs">
              <Input type="number" step="0.01" value={basePct} onChange={(e)=>setBasePct(e.target.value)}/>
              <Button onClick={save}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tagged Premium % = (Income % ÷ Base %) × 100. Default 13%.</p>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-4">
            Commission tax (17%) and marketing tax (9%) are applied at the database level on each deal's calculations.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
