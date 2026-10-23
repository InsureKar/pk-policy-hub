import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function RefundDocuments({ refundId, canUpload }: { refundId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data: documents = [], isPending, isError } = useQuery({
    queryKey: ["refund-documents", refundId],
    queryFn: async () => {
      const { data, error } = await supabase.from("refund_documents").select("*").eq("refund_id", refundId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const upload = async (file: File, type: "refusal_letter" | "policy") => {
    if (lock.current || !canUpload) return;
    lock.current = true;
    setBusy(true); setError("");
    const path = `${refundId}/${type}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    try {
      const result = await supabase.storage.from("refund-documents").upload(path, file);
      if (result.error) throw result.error;
      const record = await supabase.from("refund_documents").insert({ refund_id: refundId, document_type: type, file_name: file.name, storage_path: path });
      if (record.error) {
        await supabase.storage.from("refund-documents").remove([path]);
        throw record.error;
      }
      await qc.invalidateQueries({ queryKey: ["refund-documents", refundId] });
      toast.success("Document uploaded");
    } catch (e) {
      const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Upload failed";
      setError(message); toast.error(message);
    } finally {
      lock.current = false; setBusy(false);
    }
  };
  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("refund-documents").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not open document");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return <section className="border-t pt-3 space-y-3">
    <h3 className="text-sm font-semibold">Documents</h3>
    {isPending && <p className="text-sm text-muted-foreground">Loading documents…</p>}
    {isError && <p className="text-sm text-destructive">Could not load documents.</p>}
    {([ ["refusal_letter", "Refusal Letter"], ["policy", "Policy"] ] as const).map(([type, label]) => <div key={type} className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {canUpload && <label className="relative">
          <Button type="button" size="sm" variant="outline" disabled={busy} asChild>
            <span><Upload className="mr-1 h-4 w-4" />{busy ? "Uploading…" : "Upload"}</span>
          </Button>
          <input aria-label={`Upload ${label}`} type="file" disabled={busy} className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file, type); }} />
        </label>}
      </div>
      {documents.filter((d) => d.document_type === type).map((d) => <Button key={d.id} variant="link" size="sm" className="h-auto max-w-full justify-start whitespace-normal break-all px-0 text-left" onClick={() => void open(d.storage_path)}><FileText className="mr-1 h-4 w-4 shrink-0" />{d.file_name}</Button>)}
      {!isPending && !isError && !documents.some((d) => d.document_type === type) && <p className="text-xs text-muted-foreground">No file uploaded.</p>}
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}