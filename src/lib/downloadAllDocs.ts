import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Download every given crm-documents file as one ZIP. Uses the viewer's own storage access. */
export async function downloadAllDocs(docs: { file_name?: string; storage_path?: string }[], zipName: string) {
  const zip = new JSZip();
  const used = new Set<string>();
  let ok = 0;
  for (const d of docs) {
    if (!d.storage_path) continue;
    const { data, error } = await supabase.storage.from("crm-documents").download(d.storage_path);
    if (error || !data) continue;
    let name = d.file_name || d.storage_path.split("/").pop() || "file";
    let n = 1;
    const base = name;
    while (used.has(name)) { const i = base.lastIndexOf("."); name = i > 0 ? `${base.slice(0, i)} (${n})${base.slice(i)}` : `${base} (${n})`; n++; }
    used.add(name);
    zip.file(name, data);
    ok++;
  }
  if (!ok) { toast.error("No files could be downloaded"); return; }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = zipName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  if (ok < docs.length) toast.warning(`Downloaded ${ok} of ${docs.length} files`);
  else toast.success(`Downloaded ${ok} files`);
}
