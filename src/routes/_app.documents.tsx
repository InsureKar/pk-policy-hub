import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, Search, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

const DOC_TYPES = [
  { key: "invoice", label: "Invoice" },
  { key: "policy", label: "Insurance Policy" },
  { key: "cover_note", label: "Cover Note" },
  { key: "client_doc", label: "Client Document" },
  { key: "quotation", label: "Quotation" },
];

export const Route = createFileRoute("/_app/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const [docs, clients, cos] = await Promise.all([
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, company_name"),
        supabase.from("insurance_companies").select("id, name"),
      ]);
      return {
        docs: docs.data ?? [],
        clientMap: new Map((clients.data ?? []).map(c => [c.id, c.company_name])),
        coMap: new Map((cos.data ?? []).map(c => [c.id, c.name])),
        clients: clients.data ?? [],
        cos: cos.data ?? [],
      };
    },
  });

  const filtered = (data?.docs ?? []).filter(d =>
    (typeFilter === "all" || d.document_type === typeFilter) &&
    (!q || d.name.toLowerCase().includes(q.toLowerCase()) || (d.tags ?? []).some((t: string) => t.toLowerCase().includes(q.toLowerCase())))
  );

  const download = async (path: string) => {
    const { data: signed, error } = await supabase.storage.from("crm-documents").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(signed.signedUrl, "_blank");
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this document?")) return;
    await supabase.storage.from("crm-documents").remove([path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["documents"] }); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Documents" subtitle="Centralized document library — invoices, policies, cover notes, client documents and quotations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Upload className="w-4 h-4 mr-2"/>Upload</Button></DialogTrigger>
            <UploadDialog
              user={user}
              teamId={profile?.team_id ?? null}
              clients={data?.clients ?? []}
              cos={data?.cos ?? []}
              onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["documents"] }); }}
            />
          </Dialog>
        }/>
      <Card className="mb-4">
        <CardContent className="p-3 flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"/>
            <Input className="pl-8" placeholder="Search by name or tag" value={q} onChange={(e)=>setQ(e.target.value)}/>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {DOC_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-left px-4 py-2.5">Company</th>
                <th className="text-left px-4 py-2.5">Tags</th>
                <th className="text-left px-4 py-2.5">Version</th>
                <th className="text-left px-4 py-2.5">Uploaded</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground"/>{d.name}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary">{DOC_TYPES.find(t=>t.key===d.document_type)?.label ?? d.document_type}</Badge></td>
                  <td className="px-4 py-2.5">{d.client_id ? data?.clientMap.get(d.client_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-2.5">{d.company_id ? data?.coMap.get(d.company_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-2.5">{(d.tags ?? []).map((t: string) => <Badge key={t} variant="outline" className="mr-1">{t}</Badge>)}</td>
                  <td className="px-4 py-2.5">v{d.version}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(d.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="icon" onClick={()=>download(d.storage_path)}><Download className="w-4 h-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={()=>remove(d.id, d.storage_path)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No documents yet. Upload your first file.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadDialog({ user, teamId, clients, cos, onDone }: any) {
  const [name, setName] = useState("");
  const [type, setType] = useState("policy");
  const [client, setClient] = useState<string>("none");
  const [co, setCo] = useState<string>("none");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file || !name.trim() || !user) { toast.error("Name and file are required"); return; }
    setBusy(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        name, document_type: type,
        client_id: client === "none" ? null : client,
        company_id: co === "none" ? null : co,
        tags: tags.split(",").map(t=>t.trim()).filter(Boolean),
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
        team_id: teamId,
      });
      if (error) throw error;
      toast.success("Uploaded");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>File name / Title</Label><Input value={name} onChange={(e)=>setName(e.target.value)}/></div>
        <div><Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Client</Label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue placeholder="Optional"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Insurance Company</Label>
            <Select value={co} onValueChange={setCo}>
              <SelectTrigger><SelectValue placeholder="Optional"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {cos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Tags (comma-separated)</Label><Input value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="renewal, urgent, q3"/></div>
        <div><Label>File</Label><Input type="file" onChange={(e)=>setFile(e.target.files?.[0] ?? null)}/></div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy}>Upload</Button></DialogFooter>
    </DialogContent>
  );
}
