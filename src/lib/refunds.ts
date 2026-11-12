export interface ParsedRow {
  rowNo: number;
  name: string;
  policy_no: string;
  agent_name: string;
  premium: number;
  do_name: string;
  refunded: number;
  errors: string[];
}

export const normPolicy = (v: unknown) => String(v ?? "").trim().toLowerCase();

const FIELDS: Record<string, keyof ParsedRow> = {
  name: "name", "customername": "name", "clientname": "name",
  policyno: "policy_no", policynumber: "policy_no", policy: "policy_no",
  agentname: "agent_name", agent: "agent_name",
  premium: "premium",
  doname: "do_name", do: "do_name",
  refunded: "refunded", refundedamount: "refunded", refund: "refunded", refundamount: "refunded",
};
const key = (h: unknown) => String(h ?? "").toLowerCase().replace(/[^a-z]/g, "");

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, "").replace(/^rs\.?/i, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Parses a sheet (array of rows, first row = headers) and validates every row. */
export function parseRefundSheet(aoa: unknown[][], existingPolicies: string[]): ParsedRow[] {
  const [head = [], ...body] = aoa;
  const map = head.map((h) => FIELDS[key(h)]);
  const existing = new Set(existingPolicies);
  const seen = new Map<string, number>();
  const out: ParsedRow[] = [];
  body.forEach((cells, i) => {
    if (!cells || cells.every((c) => String(c ?? "").trim() === "")) return;
    const raw: Record<string, unknown> = {};
    map.forEach((f, j) => { if (f) raw[f] = cells[j]; });
    const r: ParsedRow = {
      rowNo: i + 2, name: String(raw.name ?? "").trim(), policy_no: String(raw.policy_no ?? "").trim(),
      agent_name: String(raw.agent_name ?? "").trim(), do_name: String(raw.do_name ?? "").trim(),
      premium: 0, refunded: 0, errors: [],
    };
    if (!r.name) r.errors.push("Name is required");
    if (!r.policy_no) r.errors.push("Policy No. is required");
    const p = num(raw.premium);
    if (p === null) r.errors.push("Premium is required");
    else if (Number.isNaN(p) || p < 0) r.errors.push("Premium must be a valid number");
    else r.premium = p;
    const rf = num(raw.refunded);
    if (rf !== null && (Number.isNaN(rf) || rf < 0)) r.errors.push("Refunded must be a valid number");
    else r.refunded = rf ?? 0;
    const k = normPolicy(r.policy_no);
    if (k) {
      if (existing.has(k)) r.errors.push("Policy No. already exists in refunds");
      if (seen.has(k)) r.errors.push(`Duplicate Policy No. in this sheet (row ${seen.get(k)})`);
      else seen.set(k, r.rowNo);
    }
    out.push(r);
  });
  return out;
}
