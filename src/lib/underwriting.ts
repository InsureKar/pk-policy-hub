export const UW_CLASSES = [
  { value: "motor", label: "Motor" },
  { value: "health", label: "Health / Group Health" },
  { value: "life", label: "Life" },
  { value: "fire", label: "Fire / Property" },
  { value: "marine", label: "Marine" },
  { value: "engineering", label: "Engineering" },
  { value: "liability", label: "Liability" },
  { value: "guarantee", label: "Insurance Guarantees" },
  { value: "misc", label: "Miscellaneous" },
  { value: "other", label: "Other" },
] as const;

export type UwClass = (typeof UW_CLASSES)[number]["value"];

export const UW_STATUSES = [
  "draft",
  "submitted",
  "underwriting_review",
  "information_required",
  "quotation_requested",
  "quotation_received",
  "quotation_shared",
  "customer_accepted",
  "proposal_requested",
  "proposal_received",
  "covernote_requested",
  "covernote_issued",
  "payment_pending",
  "payment_received",
  "policy_requested",
  "policy_issued",
  "completed",
  "won",
] as const;

export type UwStatus = (typeof UW_STATUSES)[number];

export const UW_STATUS_LABEL: Record<UwStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  underwriting_review: "Underwriting Review",
  information_required: "Information Required",
  quotation_requested: "Quotation Requested",
  quotation_received: "Quotation Received",
  quotation_shared: "Quotation Shared",
  customer_accepted: "Customer Accepted",
  proposal_requested: "Proposal Requested",
  proposal_received: "Proposal Received",
  covernote_requested: "Covernote Requested",
  covernote_issued: "Covernote Issued",
  payment_pending: "Payment Pending",
  payment_received: "Payment Received",
  policy_requested: "Policy Requested",
  policy_issued: "Policy Issued",
  completed: "Completed",
  won: "Won Lead",
};

export function uwStatusClass(s: UwStatus): string {
  if (s === "won" || s === "completed") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (s === "information_required") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  if (s === "payment_pending") return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  if (s === "draft") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary border-primary/25";
}

/** Default stage flow; classes may skip stages. */
export function stageFlow(cls: UwClass, guaranteeType?: string | null): UwStatus[] {
  const base: UwStatus[] = [
    "draft", "submitted", "underwriting_review", "information_required",
    "quotation_requested", "quotation_received", "quotation_shared", "customer_accepted",
    "proposal_requested", "proposal_received", "covernote_requested", "covernote_issued",
    "payment_pending", "payment_received", "policy_requested", "policy_issued", "completed", "won",
  ];
  if (cls === "motor") {
    return base.filter((s) => !["proposal_requested", "proposal_received"].includes(s));
  }
  if (cls === "guarantee") {
    const skip = guaranteeType === "quotation"
      ? ["proposal_requested", "proposal_received", "covernote_requested", "covernote_issued"]
      : ["proposal_requested", "proposal_received"];
    return base.filter((s) => !skip.includes(s));
  }
  return base;
}

export const REQ_STATUSES = ["pending", "received", "not_applicable", "rejected", "expired"] as const;
export type ReqStatus = (typeof REQ_STATUSES)[number];
export const REQ_STATUS_LABEL: Record<ReqStatus, string> = {
  pending: "Pending",
  received: "Received",
  not_applicable: "Not Applicable",
  rejected: "Rejected",
  expired: "Expired",
};

export const ENTITY_TYPES = [
  "Individual", "Sole Proprietorship", "Partnership", "Private Limited Company",
  "Public Limited Company", "NGO / NPO", "Trust", "Association", "Other",
];

export const DOC_TYPES = [
  "KYC", "CNIC Front", "CNIC Back", "NTN Certificate", "SECP / Registration Certificate",
  "Memorandum & Articles", "Partnership Deed", "Company Profile", "Board Resolution",
  "Performa Invoice", "Letter of Award / Contract", "Bank Statement", "PEC Certificate",
  "Client Email / Request", "Quotation", "Proposal", "Covernote", "Policy",
  "Payment Receipt", "Specifications", "Other",
];

export function agingLabel(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${Math.max(h, 0)}h`;
  return `${Math.floor(h / 24)}d`;
}

export const clientLabelOf = (c: any) =>
  c ? (c.client_type === "individual" ? c.full_name || c.company_name : c.company_name) : "—";
