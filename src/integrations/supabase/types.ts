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
          base_premium: number | null
          client_id: string | null
          commission_after_tax: number | null
          commission_before_tax: number | null
          commission_percentage: number
          cover_note_number: string | null
          created_at: string
          created_by: string
          deal_number: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          gross_premium: number
          id: string
          income_percentage: number | null
          insurance_company_id: string | null
          insurance_type_id: string | null
          loading: number
          marketing_after_tax: number | null
          marketing_before_tax: number | null
          marketing_budget_percentage: number
          net_premium: number
          notes: string | null
          payment_mode: string | null
          payment_receive_date: string | null
          payment_remarks: string | null
          payment_schedule: string | null
          policy_end_date: string | null
          policy_number: string | null
          policy_start_date: string | null
          received_by: string | null
          source_id: string | null
          stage_id: string | null
          team_id: string | null
          team_lead_id: string | null
          total_income: number | null
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          assigned_do_id?: string | null
          b2b_commission?: number
          base_premium?: number | null
          client_id?: string | null
          commission_after_tax?: number | null
          commission_before_tax?: number | null
          commission_percentage?: number
          cover_note_number?: string | null
          created_at?: string
          created_by: string
          deal_number?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          gross_premium?: number
          id?: string
          income_percentage?: number | null
          insurance_company_id?: string | null
          insurance_type_id?: string | null
          loading?: number
          marketing_after_tax?: number | null
          marketing_before_tax?: number | null
          marketing_budget_percentage?: number
          net_premium?: number
          notes?: string | null
          payment_mode?: string | null
          payment_receive_date?: string | null
          payment_remarks?: string | null
          payment_schedule?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          received_by?: string | null
          source_id?: string | null
          stage_id?: string | null
          team_id?: string | null
          team_lead_id?: string | null
          total_income?: number | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          assigned_do_id?: string | null
          b2b_commission?: number
          base_premium?: number | null
          client_id?: string | null
          commission_after_tax?: number | null
          commission_before_tax?: number | null
          commission_percentage?: number
          cover_note_number?: string | null
          created_at?: string
          created_by?: string
          deal_number?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          gross_premium?: number
          id?: string
          income_percentage?: number | null
          insurance_company_id?: string | null
          insurance_type_id?: string | null
          loading?: number
          marketing_after_tax?: number | null
          marketing_before_tax?: number | null
          marketing_budget_percentage?: number
          net_premium?: number
          notes?: string | null
          payment_mode?: string | null
          payment_receive_date?: string | null
          payment_remarks?: string | null
          payment_schedule?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          received_by?: string | null
          source_id?: string | null
          stage_id?: string | null
          team_id?: string | null
          team_lead_id?: string | null
          total_income?: number | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          designation: string | null
          email: string
          full_name: string
          id: string
          is_locked: boolean
          must_reset_password: boolean
          phone: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email: string
          full_name?: string
          id: string
          is_locked?: boolean
          must_reset_password?: boolean
          phone?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string
          full_name?: string
          id?: string
          is_locked?: boolean
          must_reset_password?: boolean
          phone?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "management" | "team_lead" | "do"
      deal_type: "fresh" | "renewal"
      line_of_business:
        | "group_health"
        | "motor"
        | "marine"
        | "travel"
        | "fire"
        | "misc"
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
      app_role: ["admin", "management", "team_lead", "do"],
      deal_type: ["fresh", "renewal"],
      line_of_business: [
        "group_health",
        "motor",
        "marine",
        "travel",
        "fire",
        "misc",
      ],
    },
  },
} as const
