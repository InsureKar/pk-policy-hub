import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/MoneyInput";
import B2BTakerField from "@/components/B2BTakerField";
import { useSaveGuard } from "@/lib/use-save-guard";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIELDS = "id, deal_number, gross_premium, net_premium, commission_percentage, marketing_budget_percentage, loading, b2b_commission, b2b_taker_name";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

/**
 * Stage-triggered form shown when a deal moves to Won. Saves the existing
 * Premium & Commission fields together with the Won stage; cancelling leaves
 * the deal's stage unchanged.
 */
export function WonDetailsDialog({ dealId, wonStageId, onClose, onSaved }: {
  dealId: string | null; wonStageId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const guard = useSaveGuard();
  const [f, setF] = useState<any>(null);
  const open = !!dealId && !!wonStageId;

  useEffect(() => {
    setF(null);
    if (!dealId) return;
    supabase.from("deals").select(FIELDS).eq("id", dealId).single().then(({ data, error }) => {
      if (error) { toast.error(error.message); onClose(); } else setF(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setNum = (k: string, v: string) => set(k, Number(v) || 0);

  const submit = async () => {
    if (!f || !dealId || !wonStageId) return;
    if (!(Number(f.gross_premium) > 0)) return toast.error("Gross Premium is required to mark the deal as Won");
    if (!guard.begin()) return;
    try {
      const { error } = await supabase.from("deals").update({
        gross_premium: Number(f.gross_premium) || 0,
        net_premium: Number(f.net_premium) || 0,
        commission_percentage: Number(f.commission_percentage) || 0,
        marketing_budget_percentage: Number(f.marketing_budget_percentage) || 0,
        loading: Number(f.loading) || 0,
        b2b_commission: Number(f.b2b_commission) || 0,
        b2b_taker_name: (f.b2b_taker_name ?? "").trim() || null,
        stage_id: wonStageId,
      }).eq("id", dealId);
      if (error) return toast.error(error.message);
      toast.success("Deal marked as Won");
      onSaved();
    } catch (e) { toast.error((e as { message?: string })?.message ?? "Could not save. Please retry."); }
    finally { guard.end(); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !guard.saving) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Premium & Commission Details{f?.deal_number ? ` — ${f.deal_number}` : ""}</DialogTitle>
          <DialogDescription>Enter these details to mark the deal as Won. Cancelling keeps the current stage.</DialogDescription>
        </DialogHeader>
        {!f ? <div className="py-6 text-sm text-muted-foreground">Loading…</div> : (
          <div className="grid sm:grid-cols-2 gap-4 py-2">
            <F label="Gross Premium (PKR)"><MoneyInput value={f.gross_premium} onChange={(_, raw) => setNum("gross_premium", raw)} /></F>
            <F label="Net Premium (PKR)"><MoneyInput value={f.net_premium} onChange={(_, raw) => setNum("net_premium", raw)} /></F>
            <F label="Commission %"><Input type="number" step="0.001" value={Number(f.commission_percentage) || ""} onChange={(e) => setNum("commission_percentage", e.target.value)} /></F>
            <F label="Marketing Budget %"><Input type="number" step="0.001" value={Number(f.marketing_budget_percentage) || ""} onChange={(e) => setNum("marketing_budget_percentage", e.target.value)} /></F>
            <F label="Loading (PKR)"><MoneyInput value={f.loading} onChange={(_, raw) => setNum("loading", raw)} /></F>
            <F label="B2B Commission (PKR)"><MoneyInput value={f.b2b_commission} onChange={(_, raw) => setNum("b2b_commission", raw)} /></F>
            <div className="sm:col-span-2"><F label="Name of B2B Commission Taker"><B2BTakerField value={f.b2b_taker_name ?? ""} onChange={(v) => set("b2b_taker_name", v)} /></F></div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={guard.saving} onClick={onClose}>Cancel</Button>
          <Button disabled={!f || guard.saving} aria-busy={guard.saving} onClick={submit}>
            {guard.saving && <Loader2 className="size-4 animate-spin" />}{guard.saving ? "Saving…" : "Save & Mark Won"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
