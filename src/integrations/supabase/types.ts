export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          previous_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          client_code: string | null
          client_type: string
          cnic: string | null
          company_name: string
          created_at: string
          created_by: string
          date_of_birth: string | null
          do_id: string | null
          email: string | null
          existing_insurance_company: string | null
          full_name: string | null
          id: string
          industry: string | null
          notes: string | null
          ntn: string | null
          phone: string | null
          poc_address: string | null
          poc_email: string | null
          poc_name: string | null
          poc_number: string | null
          team_id: string | null
          team_lead_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_code?: string | null
          client_type?: string
          cnic?: string | null
          company_name: string
          created_at?: string
          created_by: string
          date_of_birth?: string | null
          do_id?: string | null
          email?: string | null
          existing_insurance_company?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          ntn?: string | null
          phone?: string | null
          poc_address?: string | null
          poc_email?: string | null
          poc_name?: string | null
          poc_number?: string | null
          team_id?: string | null
          team_lead_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_code?: string | null
          client_type?: string
          cnic?: string | null
          company_name?: string
          created_at?: string
          created_by?: string
          date_of_birth?: string | null
          do_id?: string | null
          email?: string | null
          existing_insurance_company?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          ntn?: string | null
          phone?: string | null
          poc_address?: string | null
          poc_email?: string | null
          poc_name?: string | null
          poc_number?: string | null
          team_id?: string | null
          team_lead_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payables: {
        Row: {
          beneficiary_id: string
          beneficiary_role: string
          commission_amount: number
          created_at: string
          deal_id: string
          id: string
          paid_date: string | null
          payable_date: string
          payable_number: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          proof_url: string | null
          receivable_id: string
          reference_number: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["payable_status"]
          updated_at: string
        }
        Insert: {
          beneficiary_id: string
          beneficiary_role: string
          commission_amount?: number
          created_at?: string
          deal_id: string
          id?: string
          paid_date?: string | null
          payable_date?: string
          payable_number?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          proof_url?: string | null
          receivable_id: string
          reference_number?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string
          beneficiary_role?: string
          commission_amount?: number
          created_at?: string
          deal_id?: string
          id?: string
          paid_date?: string | null
          payable_date?: string
          payable_number?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          proof_url?: string | null
          receivable_id?: string
          reference_number?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payables_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payables_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      company_commission_rates: {
        Row: {
          company_id: string
          created_at: string
          id: string
          line_of_business: Database["public"]["Enums"]["line_of_business"]
          percentage: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          line_of_business: Database["public"]["Enums"]["line_of_business"]
          percentage?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          line_of_business?: Database["public"]["Enums"]["line_of_business"]
          percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_commission_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          client_id: string | null
          created_at: string
          deal_id: string | null
          doc_type: string | null
          file_name: string
          id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          doc_type?: string | null
          file_name: string
          id?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          doc_type?: string | null
          file_name?: string
          id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_policies: {
        Row: {
          cover_note_number: string | null
          created_at: string
          deal_id: string
          gross_premium: number
          id: string
          net_premium: number
          policy_number: string | null
          policy_number_norm: string | null
          remarks: string | null
          row_number: number
          updated_at: string
        }
        Insert: {
          cover_note_number?: string | null
          created_at?: string
          deal_id: string
          gross_premium?: number
          id?: string
          net_premium?: number
          policy_number?: string | null
          policy_number_norm?: string | null
          remarks?: string | null
          row_number: number
          updated_at?: string
        }
        Update: {
          cover_note_number?: string | null
          created_at?: string
          deal_id?: string
          gross_premium?: number
          id?: string
          net_premium?: number
          policy_number?: string | null
          policy_number_norm?: string | null
          remarks?: string | null
          row_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_policies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      deals: {
        Row: {
          assigned_do_id: string | null
          b2b_commission: number
          b2b_commission_percentage: number
          b2b_commission_type: string
          b2b_net_amount: number
          b2b_taker_id: string | null
          b2b_tax_amount: number
          b2b_tax_deduct: boolean
          b2b_tax_rate: number
          b2b_transfer_date: string | null
          b2b_transfer_status: string
          base_percentage: number | null
          base_premium: number | null
          client_id: string | null
          commission_after_tax: number | null
          commission_before_tax: number | null
          commission_percentage: number
          commission_tax: number | null
          cover_note_number: string | null
          created_at: string
          created_by: string
          deal_number: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          gross_premium: number
          id: string
          income_percentage: number | null
          insurance_company_id: string | null
          insurance_company_id_payment: string | null
          insurance_type_id: string | null
          loading: number
          marketing_after_tax: number | null
          marketing_before_tax: number | null
          marketing_budget_percentage: number
          marketing_tax: number | null
          net_premium: number
          notes: string | null
          payment_destination: string
          payment_mode: string | null
          payment_receive_date: string | null
          payment_remarks: string | null
          payment_schedule: string | null
          policy_end_date: string | null
          policy_number: string | null
          policy_start_date: string | null
          policy_type: Database["public"]["Enums"]["policy_type_kind"]
          posting_status: string
          received_by: string | null
          source_id: string | null
          stage_id: string | null
          tagged_premium: number | null
          tagged_premium_percentage: number | null
          team_id: string | null
          team_lead_id: string | null
          total_income: number | null
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          assigned_do_id?: string | null
          b2b_commission?: number
          b2b_commission_percentage?: number
          b2b_commission_type?: string
          b2b_net_amount?: number
          b2b_taker_id?: string | null
          b2b_tax_amount?: number
          b2b_tax_deduct?: boolean
          b2b_tax_rate?: number
          b2b_transfer_date?: string | null
          b2b_transfer_status?: string
          base_percentage?: number | null
          base_premium?: number | null
          client_id?: string | null
          commission_after_tax?: number | null
          commission_before_tax?: number | null
          commission_percentage?: number
          commission_tax?: number | null
          cover_note_number?: string | null
          created_at?: string
          created_by: string
          deal_number?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          gross_premium?: number
          id?: string
          income_percentage?: number | null
          insurance_company_id?: string | null
          insurance_company_id_payment?: string | null
          insurance_type_id?: string | null
          loading?: number
          marketing_after_tax?: number | null
          marketing_before_tax?: number | null
          marketing_budget_percentage?: number
          marketing_tax?: number | null
          net_premium?: number
          notes?: string | null
          payment_destination?: string
          payment_mode?: string | null
          payment_receive_date?: string | null
          payment_remarks?: string | null
          payment_schedule?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          policy_type?: Database["public"]["Enums"]["policy_type_kind"]
          posting_status?: string
          received_by?: string | null
          source_id?: string | null
          stage_id?: string | null
          tagged_premium?: number | null
          tagged_premium_percentage?: number | null
          team_id?: string | null
          team_lead_id?: string | null
          total_income?: number | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          assigned_do_id?: string | null
          b2b_commission?: number
          b2b_commission_percentage?: number
          b2b_commission_type?: string
          b2b_net_amount?: number
          b2b_taker_id?: string | null
          b2b_tax_amount?: number
          b2b_tax_deduct?: boolean
          b2b_tax_rate?: number
          b2b_transfer_date?: string | null
          b2b_transfer_status?: string
          base_percentage?: number | null
          base_premium?: number | null
          client_id?: string | null
          commission_after_tax?: number | null
          commission_before_tax?: number | null
          commission_percentage?: number
          commission_tax?: number | null
          cover_note_number?: string | null
          created_at?: string
          created_by?: string
          deal_number?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          gross_premium?: number
          id?: string
          income_percentage?: number | null
          insurance_company_id?: string | null
          insurance_company_id_payment?: string | null
          insurance_type_id?: string | null
          loading?: number
          marketing_after_tax?: number | null
          marketing_before_tax?: number | null
          marketing_budget_percentage?: number
          marketing_tax?: number | null
          net_premium?: number
          notes?: string | null
          payment_destination?: string
          payment_mode?: string | null
          payment_receive_date?: string | null
          payment_remarks?: string | null
          payment_schedule?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          policy_type?: Database["public"]["Enums"]["policy_type_kind"]
          posting_status?: string
          received_by?: string | null
          source_id?: string | null
          stage_id?: string | null
          tagged_premium?: number | null
          tagged_premium_percentage?: number | null
          team_id?: string | null
          team_lead_id?: string | null
          total_income?: number | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_b2b_taker_id_fkey"
            columns: ["b2b_taker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_insurance_company_id_fkey"
            columns: ["insurance_company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_insurance_company_id_payment_fkey"
            columns: ["insurance_company_id_payment"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_insurance_type_id_fkey"
            columns: ["insurance_type_id"]
            isOneToOne: false
            referencedRelation: "insurance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string | null
          company_id: string | null
          created_at: string
          document_type: string
          id: string
          mime_type: string | null
          name: string
          policy_id: string | null
          size_bytes: number | null
          storage_path: string
          tags: string[]
          team_id: string | null
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          document_type: string
          id?: string
          mime_type?: string | null
          name: string
          policy_id?: string | null
          size_bytes?: number | null
          storage_path: string
          tags?: string[]
          team_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          document_type?: string
          id?: string
          mime_type?: string | null
          name?: string
          policy_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          tags?: string[]
          team_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          attachments: Json
          body: string | null
          client_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          invoice_id: string | null
          recipient: string
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          invoice_id?: string | null
          recipient: string
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          invoice_id?: string | null
          recipient?: string
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string
          approved_by: string | null
          attachment_url: string | null
          category_id: string | null
          created_at: string
          created_by: string
          expense_code: string
          expense_date: string
          id: string
          invoice_number: string | null
          payment_date: string | null
          payment_method: string | null
          remarks: string | null
          subcategory_id: string | null
          tax_amount: number
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_by?: string | null
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by: string
          expense_code: string
          expense_date?: string
          id?: string
          invoice_number?: string | null
          payment_date?: string | null
          payment_method?: string | null
          remarks?: string | null
          subcategory_id?: string | null
          tax_amount?: number
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_by?: string | null
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string
          expense_code?: string
          expense_date?: string
          id?: string
          invoice_number?: string | null
          payment_date?: string | null
          payment_method?: string | null
          remarks?: string | null
          subcategory_id?: string | null
          tax_amount?: number
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          paid_amount: number
          paid_at: string | null
          receivable_id: string
          remaining_amount: number
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          paid_amount?: number
          paid_at?: string | null
          receivable_id: string
          remaining_amount?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_amount?: number
          paid_at?: string | null
          receivable_id?: string
          remaining_amount?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      insurance_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          installment_index: number | null
          installment_total: number | null
          insurance_type_id: string | null
          invoice_kind: string
          invoice_number: string
          issue_date: string
          notes: string | null
          parent_invoice_id: string | null
          payment_schedule:
            | Database["public"]["Enums"]["payment_schedule_type"]
            | null
          receivable_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          installment_index?: number | null
          installment_total?: number | null
          insurance_type_id?: string | null
          invoice_kind?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          parent_invoice_id?: string | null
          payment_schedule?:
            | Database["public"]["Enums"]["payment_schedule_type"]
            | null
          receivable_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          installment_index?: number | null
          installment_total?: number | null
          insurance_type_id?: string | null
          invoice_kind?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          parent_invoice_id?: string | null
          payment_schedule?:
            | Database["public"]["Enums"]["payment_schedule_type"]
            | null
          receivable_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_insurance_type_id_fkey"
            columns: ["insurance_type_id"]
            isOneToOne: false
            referencedRelation: "insurance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: true
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      payables: {
        Row: {
          category: Database["public"]["Enums"]["payable_category"]
          commission_payable_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          expense_id: string | null
          id: string
          original_amount: number
          outstanding_amount: number | null
          paid_amount: number
          payee_name: string | null
          payee_profile_id: string | null
          payment_date: string | null
          status: string
          tax_record_id: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["payable_category"]
          commission_payable_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          expense_id?: string | null
          id?: string
          original_amount?: number
          outstanding_amount?: number | null
          paid_amount?: number
          payee_name?: string | null
          payee_profile_id?: string | null
          payment_date?: string | null
          status?: string
          tax_record_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["payable_category"]
          commission_payable_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          expense_id?: string | null
          id?: string
          original_amount?: number
          outstanding_amount?: number | null
          paid_amount?: number
          payee_name?: string | null
          payee_profile_id?: string | null
          payment_date?: string | null
          status?: string
          tax_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_commission_payable_id_fkey"
            columns: ["commission_payable_id"]
            isOneToOne: false
            referencedRelation: "commission_payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_payee_profile_id_fkey"
            columns: ["payee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_tax_record_id_fkey"
            columns: ["tax_record_id"]
            isOneToOne: false
            referencedRelation: "tax_records"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          attachment_url: string | null
          cash_voucher_number: string | null
          cheque_number: string | null
          created_at: string
          ibft_reference: string | null
          id: string
          installment_id: string | null
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          receivable_id: string
          received_by: string | null
          receiving_account: string | null
          receiving_bank: string | null
          recorded_by: string | null
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          cash_voucher_number?: string | null
          cheque_number?: string | null
          created_at?: string
          ibft_reference?: string | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          receivable_id: string
          received_by?: string | null
          receiving_account?: string | null
          receiving_bank?: string | null
          recorded_by?: string | null
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          cash_voucher_number?: string | null
          cheque_number?: string | null
          created_at?: string
          ibft_reference?: string | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          receivable_id?: string
          received_by?: string | null
          receiving_account?: string | null
          receiving_bank?: string | null
          recorded_by?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          allowances: number
          bonuses: number
          created_at: string
          created_by: string | null
          deductions: number
          gross_salary: number
          id: string
          net_salary: number
          paid_at: string | null
          payment_method: string | null
          period_month: number
          period_year: number
          profile_id: string
          reference_number: string | null
          remarks: string | null
          status: string
          tax_amount: number
          updated_at: string
        }
        Insert: {
          allowances?: number
          bonuses?: number
          created_at?: string
          created_by?: string | null
          deductions?: number
          gross_salary?: number
          id?: string
          net_salary?: number
          paid_at?: string | null
          payment_method?: string | null
          period_month: number
          period_year: number
          profile_id: string
          reference_number?: string | null
          remarks?: string | null
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Update: {
          allowances?: number
          bonuses?: number
          created_at?: string
          created_by?: string | null
          deductions?: number
          gross_salary?: number
          id?: string
          net_salary?: number
          paid_at?: string | null
          payment_method?: string | null
          period_month?: number
          period_year?: number
          profile_id?: string
          reference_number?: string | null
          remarks?: string | null
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_log: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          module: string | null
          new_value: string | null
          previous_value: string | null
          user_affected: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          module?: string | null
          new_value?: string | null
          previous_value?: string | null
          user_affected: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          module?: string | null
          new_value?: string | null
          previous_value?: string | null
          user_affected?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          client_id: string
          company_id: string | null
          created_at: string
          deal_id: string | null
          end_date: string
          id: string
          line_of_business:
            | Database["public"]["Enums"]["line_of_business"]
            | null
          owner_id: string | null
          policy_number: string
          premium: number
          start_date: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          end_date: string
          id?: string
          line_of_business?:
            | Database["public"]["Enums"]["line_of_business"]
            | null
          owner_id?: string | null
          policy_number: string
          premium?: number
          start_date: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          end_date?: string
          id?: string
          line_of_business?:
            | Database["public"]["Enums"]["line_of_business"]
            | null
          owner_id?: string | null
          policy_number?: string
          premium?: number
          start_date?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          commission_share_percentage: number
          created_at: string
          default_allowances: number | null
          default_deductions: number | null
          department: string | null
          designation: string | null
          email: string
          employment_status: string | null
          full_name: string
          id: string
          is_locked: boolean
          joining_date: string | null
          monthly_salary: number | null
          must_reset_password: boolean
          phone: string | null
          salary_tax_percentage: number | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          commission_share_percentage?: number
          created_at?: string
          default_allowances?: number | null
          default_deductions?: number | null
          department?: string | null
          designation?: string | null
          email: string
          employment_status?: string | null
          full_name?: string
          id: string
          is_locked?: boolean
          joining_date?: string | null
          monthly_salary?: number | null
          must_reset_password?: boolean
          phone?: string | null
          salary_tax_percentage?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_share_percentage?: number
          created_at?: string
          default_allowances?: number | null
          default_deductions?: number | null
          department?: string | null
          designation?: string | null
          email?: string
          employment_status?: string | null
          full_name?: string
          id?: string
          is_locked?: boolean
          joining_date?: string | null
          monthly_salary?: number | null
          must_reset_password?: boolean
          phone?: string | null
          salary_tax_percentage?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          assigned_do_id: string | null
          base_premium: number | null
          client_id: string | null
          commission_receivable: number
          created_at: string
          created_by: string | null
          deal_id: string
          excluded_from_receivable: boolean
          expected_collection_date: string | null
          first_due_date: string | null
          fully_paid_at: string | null
          gross_premium: number
          id: string
          installment_count: number
          net_premium: number
          notes: string | null
          outstanding_amount: number
          paid_amount: number
          payment_schedule: Database["public"]["Enums"]["payment_schedule_type"]
          receivable_number: string
          status: Database["public"]["Enums"]["receivable_status"]
          team_id: string | null
          team_lead_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          assigned_do_id?: string | null
          base_premium?: number | null
          client_id?: string | null
          commission_receivable?: number
          created_at?: string
          created_by?: string | null
          deal_id: string
          excluded_from_receivable?: boolean
          expected_collection_date?: string | null
          first_due_date?: string | null
          fully_paid_at?: string | null
          gross_premium?: number
          id?: string
          installment_count?: number
          net_premium?: number
          notes?: string | null
          outstanding_amount?: number
          paid_amount?: number
          payment_schedule?: Database["public"]["Enums"]["payment_schedule_type"]
          receivable_number?: string
          status?: Database["public"]["Enums"]["receivable_status"]
          team_id?: string | null
          team_lead_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          assigned_do_id?: string | null
          base_premium?: number | null
          client_id?: string | null
          commission_receivable?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string
          excluded_from_receivable?: boolean
          expected_collection_date?: string | null
          first_due_date?: string | null
          fully_paid_at?: string | null
          gross_premium?: number
          id?: string
          installment_count?: number
          net_premium?: number
          notes?: string | null
          outstanding_amount?: number
          paid_amount?: number
          payment_schedule?: Database["public"]["Enums"]["payment_schedule_type"]
          receivable_number?: string
          status?: Database["public"]["Enums"]["receivable_status"]
          team_id?: string | null
          team_lead_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          attachment_url: string | null
          category_id: string | null
          created_at: string
          created_by: string
          description: string
          employee_id: string
          expense_date: string
          id: string
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_reference: string | null
          rejection_reason: string | null
          remarks: string | null
          request_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by: string
          description: string
          employee_id: string
          expense_date: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          request_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          employee_id?: string
          expense_date?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          request_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          new_salary: number
          previous_salary: number | null
          profile_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          new_salary: number
          previous_salary?: number | null
          profile_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          new_salary?: number
          previous_salary?: number | null
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_revisions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_records: {
        Row: {
          amount: number
          base_amount: number
          client_id: string | null
          created_at: string
          deal_id: string | null
          deducted_from: string | null
          id: string
          insurance_type_id: string | null
          notes: string | null
          paid_amount: number
          period_date: string
          rate: number
          source_id: string | null
          source_type: string
          status: string
          tax_type: Database["public"]["Enums"]["tax_kind"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          base_amount?: number
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          deducted_from?: string | null
          id?: string
          insurance_type_id?: string | null
          notes?: string | null
          paid_amount?: number
          period_date?: string
          rate?: number
          source_id?: string | null
          source_type?: string
          status?: string
          tax_type: Database["public"]["Enums"]["tax_kind"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          deducted_from?: string | null
          id?: string
          insurance_type_id?: string | null
          notes?: string | null
          paid_amount?: number
          period_date?: string
          rate?: number
          source_id?: string | null
          source_type?: string
          status?: string
          tax_type?: Database["public"]["Enums"]["tax_kind"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_records_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_records_deducted_from_fkey"
            columns: ["deducted_from"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_records_insurance_type_id_fkey"
            columns: ["insurance_type_id"]
            isOneToOne: false
            referencedRelation: "insurance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          location?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      travel_posting_rows: {
        Row: {
          agent_name: string | null
          commission_percentage: number
          company_id: string | null
          created_at: string
          date_issued: string | null
          id: string
          payable_company: string | null
          policy_number: string | null
          policy_number_norm: string | null
          posting_id: string
          premium: number
          remarks: string | null
          sr_no: number
          travel_agent: string | null
        }
        Insert: {
          agent_name?: string | null
          commission_percentage?: number
          company_id?: string | null
          created_at?: string
          date_issued?: string | null
          id?: string
          payable_company?: string | null
          policy_number?: string | null
          policy_number_norm?: string | null
          posting_id: string
          premium?: number
          remarks?: string | null
          sr_no: number
          travel_agent?: string | null
        }
        Update: {
          agent_name?: string | null
          commission_percentage?: number
          company_id?: string | null
          created_at?: string
          date_issued?: string | null
          id?: string
          payable_company?: string | null
          policy_number?: string | null
          policy_number_norm?: string | null
          posting_id?: string
          premium?: number
          remarks?: string | null
          sr_no?: number
          travel_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_posting_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_posting_rows_posting_id_fkey"
            columns: ["posting_id"]
            isOneToOne: false
            referencedRelation: "travel_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_posting_transfers: {
        Row: {
          agent: string | null
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          posting_id: string
          remarks: string | null
          sr_no: number
          tid: string | null
          transfer_date: string | null
        }
        Insert: {
          agent?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          posting_id: string
          remarks?: string | null
          sr_no?: number
          tid?: string | null
          transfer_date?: string | null
        }
        Update: {
          agent?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          posting_id?: string
          remarks?: string | null
          sr_no?: number
          tid?: string | null
          transfer_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_posting_transfers_posting_id_fkey"
            columns: ["posting_id"]
            isOneToOne: false
            referencedRelation: "travel_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_postings: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          posting_from: string | null
          posting_to: string | null
          status: string
          total_policy_amount: number
          total_posting_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          posting_from?: string | null
          posting_to?: string | null
          status?: string
          total_policy_amount?: number
          total_posting_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          posting_from?: string | null
          posting_to?: string | null
          status?: string
          total_policy_amount?: number
          total_posting_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_postings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["permission_level"]
          module: Database["public"]["Enums"]["app_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["permission_level"]
          module: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["permission_level"]
          module?: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_month: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_month: string
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_month?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_renewals: {
        Row: {
          client_id: string | null
          company_id: string | null
          created_at: string | null
          deal_id: string | null
          end_date: string | null
          id: string | null
          line_of_business:
            | Database["public"]["Enums"]["line_of_business"]
            | null
          owner_id: string | null
          policy_number: string | null
          premium: number | null
          renewal_status: string | null
          start_date: string | null
          status: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          end_date?: string | null
          id?: string | null
          line_of_business?:
            | Database["public"]["Enums"]["line_of_business"]
            | null
          owner_id?: string | null
          policy_number?: string | null
          premium?: number | null
          renewal_status?: never
          start_date?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          end_date?: string | null
          id?: string | null
          line_of_business?:
            | Database["public"]["Enums"]["line_of_business"]
            | null
          owner_id?: string | null
          policy_number?: string | null
          premium?: number | null
          renewal_status?: never
          start_date?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_team: { Args: never; Returns: string }
      deal_policy_conflict: {
        Args: { _exclude_row?: string; _policy_number: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      module_allows: {
        Args: {
          _min: Database["public"]["Enums"]["permission_level"]
          _module: Database["public"]["Enums"]["app_module"]
        }
        Returns: boolean
      }
      module_level: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user: string
        }
        Returns: Database["public"]["Enums"]["permission_level"]
      }
      normalize_policy_number: { Args: { _v: string }; Returns: string }
      perm_rank: {
        Args: { _l: Database["public"]["Enums"]["permission_level"] }
        Returns: number
      }
      travel_policy_conflict: {
        Args: { _exclude_row?: string; _policy_number: string }
        Returns: Json
      }
    }
    Enums: {
      app_module:
        | "dashboard"
        | "leads"
        | "clients"
        | "deals"
        | "renewals"
        | "accounts"
        | "operations"
        | "reports"
        | "admin"
        | "settings"
      app_role: "admin" | "management" | "team_lead" | "do"
      deal_type: "fresh" | "renewal"
      installment_status: "pending" | "partial" | "paid" | "overdue"
      invoice_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "sent"
      line_of_business:
        | "group_health"
        | "motor"
        | "marine"
        | "travel"
        | "fire"
        | "misc"
      payable_category:
        | "commission"
        | "b2b_commission"
        | "tax"
        | "expense"
        | "other"
      payable_status: "pending" | "paid" | "cancelled"
      payment_method_type:
        | "cash"
        | "cheque"
        | "ibft"
        | "bank_transfer"
        | "online"
        | "other"
      payment_schedule_type: "annual" | "half_yearly" | "quarterly" | "monthly"
      permission_level: "none" | "view" | "edit" | "add"
      policy_type_kind: "single" | "bulk"
      receivable_status: "open" | "partial" | "paid" | "overdue" | "cancelled"
      tax_kind:
        | "income_tax"
        | "sales_tax"
        | "marketing_budget_tax"
        | "commission_taker_tax"
        | "b2b_commission_tax"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: [
        "dashboard",
        "leads",
        "clients",
        "deals",
        "renewals",
        "accounts",
        "operations",
        "reports",
        "admin",
        "settings",
      ],
      app_role: ["admin", "management", "team_lead", "do"],
      deal_type: ["fresh", "renewal"],
      installment_status: ["pending", "partial", "paid", "overdue"],
      invoice_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "sent",
      ],
      line_of_business: [
        "group_health",
        "motor",
        "marine",
        "travel",
        "fire",
        "misc",
      ],
      payable_category: [
        "commission",
        "b2b_commission",
        "tax",
        "expense",
        "other",
      ],
      payable_status: ["pending", "paid", "cancelled"],
      payment_method_type: [
        "cash",
        "cheque",
        "ibft",
        "bank_transfer",
        "online",
        "other",
      ],
      payment_schedule_type: ["annual", "half_yearly", "quarterly", "monthly"],
      permission_level: ["none", "view", "edit", "add"],
      policy_type_kind: ["single", "bulk"],
      receivable_status: ["open", "partial", "paid", "overdue", "cancelled"],
      tax_kind: [
        "income_tax",
        "sales_tax",
        "marketing_budget_tax",
        "commission_taker_tax",
        "b2b_commission_tax",
      ],
    },
  },
} as const
