import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Open a file stored in the private crm-documents bucket in a new tab
 * via a short-lived signed URL, so uploaded proofs/receipts/bills can be
 * viewed at any time after upload.
 */
export async function openStorageDoc(path: string | null | undefined) {
  if (!path) return;
  const { data, error } = await supabase.storage.from("crm-documents").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    toast.error("Could not open file: " + (error?.message ?? "no access"));
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
