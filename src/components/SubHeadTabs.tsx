import { cn } from "@/lib/utils";

/** Presentational sub-head selector used by the Accounts heads (Receivables, Payables, Sales, Taxes). */
export function SubHeadTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onChange(i.value)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md border transition-colors whitespace-nowrap",
            value === i.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:text-foreground",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
