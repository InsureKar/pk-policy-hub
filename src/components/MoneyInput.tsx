import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Groups a number with commas (2 decimals max). */
export function withCommas(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
}

const UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function belowThousand(n: number): string {
  const out: string[] = [];
  if (n >= 100) { out.push(`${UNITS[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${UNITS[n % 10]}` : "")); }
  else if (n > 0) out.push(UNITS[n]);
  return out.join(" ");
}

/** Converts an amount to words (international system), e.g. "Five Hundred Thousand Rupees Only". Display only. */
export function amountInWords(value: number | string | null | undefined): string {
  let n = Math.floor(Math.abs(Number(value ?? 0)));
  if (!Number.isFinite(n) || n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  let i = 0;
  while (n > 0 && i < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${belowThousand(chunk)}${SCALES[i] ? ` ${SCALES[i]}` : ""}`);
    n = Math.floor(n / 1000);
    i++;
  }
  return `${parts.join(" ")} Rupees Only`;
}

interface MoneyInputProps {
  value: number | string | null | undefined;
  /** Emits the numeric value (0 when empty) and the raw cleaned string ("" when empty). */
  onChange: (v: number, raw: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Show the amount spelled out under the field. */
  showWords?: boolean;
}

const toDisplay = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? withCommas(n) : "";
};

/**
 * Currency input: starts empty, can be fully cleared, shows thousands
 * separators while typing and the amount in words underneath.
 */
export function MoneyInput({ value, onChange, readOnly, disabled, placeholder, className, showWords = true }: MoneyInputProps) {
  const [text, setText] = React.useState(() => toDisplay(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setText(toDisplay(value));
  }, [value, focused]);

  const handle = (raw: string) => {
    let cleaned = raw.replace(/[^0-9.]/g, "");
    const dot = cleaned.indexOf(".");
    if (dot >= 0) cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
    if (cleaned === "") { setText(""); onChange(0, ""); return; }
    const [int, dec] = cleaned.split(".");
    const intFmt = int === "" ? "0" : new Intl.NumberFormat("en-US").format(Number(int));
    setText(dec !== undefined ? `${intFmt}.${dec.slice(0, 2)}` : intFmt);
    onChange(Number(cleaned) || 0, cleaned);
  };

  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  const showText = showWords && text !== "" && Number.isFinite(numeric) && numeric !== 0;

  return (
    <div className="space-y-1">
      <Input
        inputMode="decimal"
        value={text}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder ?? ""}
        className={cn("text-right tabular-nums", className)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(toDisplay(value)); }}
        onChange={(e) => handle(e.target.value)}
      />
      {showText && <p className="text-[11px] leading-tight text-muted-foreground">{amountInWords(numeric)}</p>}
    </div>
  );
}
