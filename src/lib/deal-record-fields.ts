// Live-schema input fields only; generated amounts and audit identities remain system-owned.
export const dealRecordFields: Record<string, { key: string; type: string; required: boolean; defaulted: boolean }[]> = {
  "commission_payables": [
    {
      "key": "payable_number",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "receivable_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "deal_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "beneficiary_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "beneficiary_role",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "commission_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payable_date",
      "type": "date",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_method",
      "type": "payment_method_type",
      "required": false,
      "defaulted": false
    },
    {
      "key": "reference_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "proof_url",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "status",
      "type": "payable_status",
      "required": true,
      "defaulted": true
    },
    {
      "key": "remarks",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "deal_documents": [
    {
      "key": "deal_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "file_name",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "storage_path",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "doc_type",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "deal_installments": [
    {
      "key": "deal_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "installment_number",
      "type": "int4",
      "required": true,
      "defaulted": false
    },
    {
      "key": "label",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "due_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "paid_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "underwritten_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "tagged_month",
      "type": "int4",
      "required": false,
      "defaulted": false
    },
    {
      "key": "tagged_year",
      "type": "int4",
      "required": false,
      "defaulted": false
    },
    {
      "key": "gross_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "net_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "commission",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "marketing_budget",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "loading",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "commission_percentage",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_commission",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_taker_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_status",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payment_mode",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_receive_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "transaction_reference",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_remarks",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "deal_policies": [
    {
      "key": "deal_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "row_number",
      "type": "int4",
      "required": true,
      "defaulted": false
    },
    {
      "key": "cover_note_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "policy_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "gross_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "net_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "remarks",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "policy_number_norm",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "deals": [
    {
      "key": "deal_number",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cover_note_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "policy_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "source_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "insurance_company_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "insurance_type_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "stage_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "assigned_do_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "team_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "gross_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "net_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "commission_percentage",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "marketing_budget_percentage",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "loading",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_commission",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "policy_start_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "policy_end_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "notes",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "base_premium",
      "type": "numeric",
      "required": false,
      "defaulted": false
    },
    {
      "key": "team_lead_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_receive_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_schedule",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_mode",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "transaction_reference",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "received_by",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_remarks",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "deal_type",
      "type": "deal_type",
      "required": true,
      "defaulted": true
    },
    {
      "key": "policy_type",
      "type": "policy_type_kind",
      "required": true,
      "defaulted": true
    },
    {
      "key": "posting_status",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "insurance_company_id_payment",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "base_percentage",
      "type": "numeric",
      "required": false,
      "defaulted": false
    },
    {
      "key": "b2b_taker_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "b2b_commission_type",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_commission_percentage",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_tax_deduct",
      "type": "bool",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_tax_rate",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_tax_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_net_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_transfer_status",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_transfer_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_destination",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payment_proof_url",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_year",
      "type": "int4",
      "required": false,
      "defaulted": false
    },
    {
      "key": "underwritten_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "b2b_taker_name",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "dispatch_records": [
    {
      "key": "record_kind",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "client_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "dispatch_date",
      "type": "date",
      "required": true,
      "defaulted": true
    },
    {
      "key": "tracking_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "document_status",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "document_type",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "description",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "dispatcher_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "receiver_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "card_count",
      "type": "int4",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cheque_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cheque_payee",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cheque_amount",
      "type": "numeric",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cheque_status",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "documents": [
    {
      "key": "name",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "document_type",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "policy_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "company_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "storage_path",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "mime_type",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "size_bytes",
      "type": "int8",
      "required": false,
      "defaulted": false
    },
    {
      "key": "version",
      "type": "int4",
      "required": true,
      "defaulted": true
    },
    {
      "key": "team_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    }
  ],
  "installments": [
    {
      "key": "receivable_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "installment_number",
      "type": "int4",
      "required": true,
      "defaulted": false
    },
    {
      "key": "due_date",
      "type": "date",
      "required": true,
      "defaulted": false
    },
    {
      "key": "amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "remaining_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "status",
      "type": "installment_status",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_at",
      "type": "timestamptz",
      "required": false,
      "defaulted": false
    }
  ],
  "invoices": [
    {
      "key": "invoice_number",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "receivable_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "deal_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "issue_date",
      "type": "date",
      "required": true,
      "defaulted": true
    },
    {
      "key": "due_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "total_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "notes",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "status",
      "type": "invoice_status",
      "required": true,
      "defaulted": true
    },
    {
      "key": "approved_by",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "approved_at",
      "type": "timestamptz",
      "required": false,
      "defaulted": false
    },
    {
      "key": "rejected_by",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "rejected_at",
      "type": "timestamptz",
      "required": false,
      "defaulted": false
    },
    {
      "key": "rejection_reason",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "invoice_kind",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "sent_at",
      "type": "timestamptz",
      "required": false,
      "defaulted": false
    },
    {
      "key": "insurance_type_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_schedule",
      "type": "payment_schedule_type",
      "required": false,
      "defaulted": false
    },
    {
      "key": "description",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "parent_invoice_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "installment_index",
      "type": "int4",
      "required": false,
      "defaulted": false
    },
    {
      "key": "installment_total",
      "type": "int4",
      "required": false,
      "defaulted": false
    }
  ],
  "payables": [
    {
      "key": "category",
      "type": "payable_category",
      "required": true,
      "defaulted": false
    },
    {
      "key": "payee_profile_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payee_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "deal_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "expense_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "tax_record_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "commission_payable_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "description",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "original_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "due_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payment_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "status",
      "type": "text",
      "required": true,
      "defaulted": true
    }
  ],
  "payments": [
    {
      "key": "receivable_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "installment_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "amount",
      "type": "numeric",
      "required": true,
      "defaulted": false
    },
    {
      "key": "payment_date",
      "type": "date",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payment_method",
      "type": "payment_method_type",
      "required": true,
      "defaulted": true
    },
    {
      "key": "transaction_reference",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "ibft_reference",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cheque_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "cash_voucher_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "receiving_bank",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "receiving_account",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "received_by",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "attachment_url",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "notes",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "policies": [
    {
      "key": "policy_number",
      "type": "text",
      "required": true,
      "defaulted": false
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "deal_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "company_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "line_of_business",
      "type": "line_of_business",
      "required": false,
      "defaulted": false
    },
    {
      "key": "premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "start_date",
      "type": "date",
      "required": true,
      "defaulted": false
    },
    {
      "key": "end_date",
      "type": "date",
      "required": true,
      "defaulted": false
    },
    {
      "key": "status",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "owner_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "team_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    }
  ],
  "receivables": [
    {
      "key": "receivable_number",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "deal_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "team_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "assigned_do_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "team_lead_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "gross_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "base_premium",
      "type": "numeric",
      "required": false,
      "defaulted": false
    },
    {
      "key": "net_premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "commission_receivable",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payment_schedule",
      "type": "payment_schedule_type",
      "required": true,
      "defaulted": true
    },
    {
      "key": "installment_count",
      "type": "int4",
      "required": true,
      "defaulted": true
    },
    {
      "key": "total_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "outstanding_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "first_due_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "expected_collection_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "fully_paid_at",
      "type": "timestamptz",
      "required": false,
      "defaulted": false
    },
    {
      "key": "status",
      "type": "receivable_status",
      "required": true,
      "defaulted": true
    },
    {
      "key": "notes",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "excluded_from_receivable",
      "type": "bool",
      "required": true,
      "defaulted": true
    }
  ],
  "tax_records": [
    {
      "key": "tax_type",
      "type": "tax_kind",
      "required": true,
      "defaulted": false
    },
    {
      "key": "deal_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "client_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "team_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "insurance_type_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "deducted_from",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "source_type",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "source_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "base_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "rate",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "paid_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "status",
      "type": "text",
      "required": true,
      "defaulted": true
    },
    {
      "key": "period_date",
      "type": "date",
      "required": true,
      "defaulted": true
    },
    {
      "key": "notes",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "travel_posting_rows": [
    {
      "key": "posting_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "sr_no",
      "type": "int4",
      "required": true,
      "defaulted": false
    },
    {
      "key": "travel_agent",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "date_issued",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "policy_number",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "premium",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "commission_percentage",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payable_company",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "agent_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "company_id",
      "type": "uuid",
      "required": false,
      "defaulted": false
    },
    {
      "key": "remarks",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payable_own",
      "type": "numeric",
      "required": false,
      "defaulted": false
    },
    {
      "key": "payable_insurance",
      "type": "numeric",
      "required": false,
      "defaulted": false
    }
  ],
  "travel_posting_transfers": [
    {
      "key": "posting_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "sr_no",
      "type": "int4",
      "required": true,
      "defaulted": true
    },
    {
      "key": "transfer_date",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "bank_name",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "tid",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "agent",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "remarks",
      "type": "text",
      "required": false,
      "defaulted": false
    },
    {
      "key": "agent_payment_destination",
      "type": "bool",
      "required": true,
      "defaulted": true
    },
    {
      "key": "payment_destination",
      "type": "text",
      "required": false,
      "defaulted": false
    }
  ],
  "travel_postings": [
    {
      "key": "deal_id",
      "type": "uuid",
      "required": true,
      "defaulted": false
    },
    {
      "key": "total_policy_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "total_posting_amount",
      "type": "numeric",
      "required": true,
      "defaulted": true
    },
    {
      "key": "posting_from",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "posting_to",
      "type": "date",
      "required": false,
      "defaulted": false
    },
    {
      "key": "status",
      "type": "text",
      "required": true,
      "defaulted": true
    }
  ]
};
