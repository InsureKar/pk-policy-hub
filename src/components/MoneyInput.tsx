import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Groups a number with commas (Pakistani/English style, 2 decimals max). */
export function withCommas(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(v);
}

const UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return UNITS[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${UNITS[n % 10]}` : ""}`;
}

/** Converts an amount to words using the Pakistani numbering system (Crore / Lakh / Thousand). */
export function amountInWords(value: number | string | null | undefined): string {
  let n = Math.floor(Math.abs(Number(value ?? 0)));
  if (!Number.isFinite(n) || n === 0) return "Zero Rupees";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${amountInWords(crore).replace(" Rupees", "")} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${UNITS[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return `${parts.join(" ")} Rupees`;
}

interface MoneyInputProps {
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Show the amount spelled out under the field. */
  showWords?: boolean;
}

/**
 * Currency input that displays thousands separators while typing and spells
 * the amount out in words underneath. Emits a plain number.
 */
export function MoneyInput({ value, onChange, readOnly, disabled, placeholder, className, showWords = true }: MoneyInputProps) {
  const [text, setText] = React.useState(() => (value ? withCommas(value) : ""));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setText(value ? withCommas(value) : "");
  }, [value, focused]);

  const handle = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    setText(cleaned === "" ? "" : withCommas(cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned) + (cleaned.endsWith(".") ? "." : ""));
    onChange(Number(cleaned) || 0);
  };

  return (
    <div className="space-y-1">
      <Input
        inputMode="decimal"
        value={text}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder ?? "0"}
        className={cn("text-right tabular-nums", className)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(value ? withCommas(value) : ""); }}
        onChange={(e) => handle(e.target.value)}
      />
      {showWords && <p className="text-[11px] leading-tight text-muted-foreground">{amountInWords(value)}</p>}
    </div>
  );
}
