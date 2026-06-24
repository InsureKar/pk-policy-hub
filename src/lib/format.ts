export const fmtPKR = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(v);
};

export const fmtNum = (n: number | null | undefined, d = 2) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-PK", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
};

export const fmtPct = (n: number | null | undefined, d = 2) => `${fmtNum(n, d)}%`;

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
};
