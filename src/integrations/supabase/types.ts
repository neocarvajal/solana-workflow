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
      pending_actions: {
        Row: {
          action: string | null
          amount: string | null
          created_at: string | null
          id: number
          status: string | null
          wallet_address: string | null
        }
        Insert: {
          action?: string | null
          amount?: string | null
          created_at?: string | null
          id?: number
          status?: string | null
          wallet_address?: string | null
        }
        Update: {
          action?: string | null
          amount?: string | null
          created_at?: string | null
          id?: number
          status?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      user_vaults: {
        Row: {
          created_at: string
          destination: string | null
          execution_mode: string
          expires_at: string | null
          id: string
          input_mint: string | null
          max_per_run: number | null
          max_total: number | null
          min_interval_seconds: number | null
          output_mint: string | null
          owner_wallet: string
          policy_address: string | null
          status: string
          updated_at: string
          vault_address: string
          vault_authority: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string
          destination?: string | null
          execution_mode?: string
          expires_at?: string | null
          id?: string
          input_mint?: string | null
          max_per_run?: number | null
          max_total?: number | null
          min_interval_seconds?: number | null
          output_mint?: string | null
          owner_wallet: string
          policy_address?: string | null
          status?: string
          updated_at?: string
          vault_address: string
          vault_authority?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string
          destination?: string | null
          execution_mode?: string
          expires_at?: string | null
          id?: string
          input_mint?: string | null
          max_per_run?: number | null
          max_total?: number | null
          min_interval_seconds?: number | null
          output_mint?: string | null
          owner_wallet?: string
          policy_address?: string | null
          status?: string
          updated_at?: string
          vault_address?: string
          vault_authority?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          amount_in: number | null
          amount_out: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          logs: Json | null
          scheduled_for: string
          status: string
          tx_signature: string | null
          workflow_id: string | null
        }
        Insert: {
          amount_in?: number | null
          amount_out?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json | null
          scheduled_for: string
          status: string
          tx_signature?: string | null
          workflow_id?: string | null
        }
        Update: {
          amount_in?: number | null
          amount_out?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json | null
          scheduled_for?: string
          status?: string
          tx_signature?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          amount_in: number | null
          amount_out: number | null
          created_at: string
          error: string | null
          execution_mode: string | null
          id: string
          output: Json | null
          scheduled_for: string | null
          status: string
          trigger_data: Json | null
          tx_signature: string | null
          workflow_id: string | null
        }
        Insert: {
          amount_in?: number | null
          amount_out?: number | null
          created_at?: string
          error?: string | null
          execution_mode?: string | null
          id?: string
          output?: Json | null
          scheduled_for?: string | null
          status: string
          trigger_data?: Json | null
          tx_signature?: string | null
          workflow_id?: string | null
        }
        Update: {
          amount_in?: number | null
          amount_out?: number | null
          created_at?: string
          error?: string | null
          execution_mode?: string | null
          id?: string
          output?: Json | null
          scheduled_for?: string | null
          status?: string
          trigger_data?: Json | null
          tx_signature?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          automation_status: string
          cid: string | null
          claimed_by: string | null
          created_at: string
          enabled: boolean
          execution_mode: string
          failure_count: number
          id: string
          json: Json
          last_error: string | null
          last_run_at: string | null
          lease_until: string | null
          name: string
          next_run_at: string | null
          onchain_account: string | null
          onchain_signature: string | null
          owner_wallet: string
          policy_address: string | null
          schedule: string
          schedule_seconds: number
          updated_at: string
          vault_address: string | null
          vault_authority: string | null
          workflow_hash: string | null
          workflow_id: string | null
        }
        Insert: {
          automation_status?: string
          cid?: string | null
          claimed_by?: string | null
          created_at?: string
          enabled?: boolean
          execution_mode?: string
          failure_count?: number
          id?: string
          json: Json
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          name?: string
          next_run_at?: string | null
          onchain_account?: string | null
          onchain_signature?: string | null
          owner_wallet: string
          policy_address?: string | null
          schedule?: string
          schedule_seconds?: number
          updated_at?: string
          vault_address?: string | null
          vault_authority?: string | null
          workflow_hash?: string | null
          workflow_id?: string | null
        }
        Update: {
          automation_status?: string
          cid?: string | null
          claimed_by?: string | null
          created_at?: string
          enabled?: boolean
          execution_mode?: string
          failure_count?: number
          id?: string
          json?: Json
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          name?: string
          next_run_at?: string | null
          onchain_account?: string | null
          onchain_signature?: string | null
          owner_wallet?: string
          policy_address?: string | null
          schedule?: string
          schedule_seconds?: number
          updated_at?: string
          vault_address?: string | null
          vault_authority?: string | null
          workflow_hash?: string | null
          workflow_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_due_workflows: {
        Args: { p_limit?: number; p_worker?: string }
        Returns: {
          execution_mode: string
          id: string
          name: string
          next_run_at: string
          owner_wallet: string
          schedule: string
          schedule_seconds: number
          scheduled_for: string
          workflow_id: string
          workflow_json: Json
        }[]
      }
      dispatch_due_workflows: { Args: never; Returns: undefined }
      finish_workflow_run: {
        Args: { p_error?: string; p_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
