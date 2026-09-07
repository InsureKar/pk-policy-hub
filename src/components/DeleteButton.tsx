import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  table: string;
  id: string;
  /** Query keys to refresh after delete. Any prefix works. */
  invalidate?: (string | unknown[])[];
  label?: string;
  idColumn?: string;
  onDeleted?: () => void;
}

/** Delete control visible only to Admin and Management. */
export function DeleteButton({ table, id, invalidate = [], label = "record", idColumn = "id", onDeleted }: Props) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!hasRole(["admin", "management"])) return null;

  const remove = async () => {
    setBusy(true);
    const { error } = await (supabase as any).from(table).delete().eq(idColumn, id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted ${label}`);
    setOpen(false);
    if (invalidate.length === 0) {
      qc.invalidateQueries();
    } else {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }));
    }
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        title={`Delete ${label}`}
        aria-label={`Delete ${label}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {label}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); remove(); }}>
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
