import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

/**
 * Picker for the B2B commission taker name.
 * Each user maintains their own private list (RLS scoped to auth.uid()).
 * The chosen value is stored as plain text on the deal / instalment.
 */
export default function B2BTakerField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("b2b_commission_takers")
      .select("name")
      .order("name", { ascending: true });
    setNames((data ?? []).map((r: { name: string }) => r.name));
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    const name = draft.trim();
    if (!name) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      toast.error("You must be signed in.");
      return;
    }
    const { error } = await supabase
      .from("b2b_commission_takers")
      .insert({ name, user_id: auth.user.id });
    setSaving(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    setAdding(false);
    await load();
    onChange(name);
  };

  const options = value && !names.includes(value) ? [value, ...names] : names;

  return (
    <div className={className}>
      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={draft}
            placeholder="Enter name"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
          />
          <Button type="button" size="sm" disabled={saving} onClick={() => void add()}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select commission taker" />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No commission takers yet</div>
              ) : (
                options.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="outline" onClick={() => setAdding(true)} title="Add commission taker">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
