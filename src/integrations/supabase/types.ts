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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      board_results: {
        Row: {
          created_at: string
          id: string
          kill_condition: string
          lens: string
          rationale: string
          risks: Json
          run_id: string
          score: number
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          kill_condition: string
          lens: string
          rationale: string
          risks: Json
          run_id: string
          score: number
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          kill_condition?: string
          lens?: string
          rationale?: string
          risks?: Json
          run_id?: string
          score?: number
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cfo_results: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          outputs: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          outputs: Json
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          outputs?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cfo_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          business_model: string | null
          cfo_inputs: Json
          country: string
          created_at: string
          currency: string
          followup_answers: Json
          followup_questions: Json
          id: string
          idea_text: string
          model_confidence: number | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_model?: string | null
          cfo_inputs?: Json
          country: string
          created_at?: string
          currency: string
          followup_answers?: Json
          followup_questions?: Json
          id?: string
          idea_text: string
          model_confidence?: number | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_model?: string | null
          cfo_inputs?: Json
          country?: string
          created_at?: string
          currency?: string
          followup_answers?: Json
          followup_questions?: Json
          id?: string
          idea_text?: string
          model_confidence?: number | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      panel_answers: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          objection: string | null
          persona: Json
          persona_index: number
          price_cheap: number | null
          price_expensive: number | null
          price_too_cheap: number | null
          price_too_expensive: number | null
          reason: string | null
          run_id: string
          status: string
          updated_at: string
          would_buy: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          objection?: string | null
          persona: Json
          persona_index: number
          price_cheap?: number | null
          price_expensive?: number | null
          price_too_cheap?: number | null
          price_too_expensive?: number | null
          reason?: string | null
          run_id: string
          status?: string
          updated_at?: string
          would_buy?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          objection?: string | null
          persona?: Json
          persona_index?: number
          price_cheap?: number | null
          price_expensive?: number | null
          price_too_cheap?: number | null
          price_too_expensive?: number | null
          reason?: string | null
          run_id?: string
          status?: string
          updated_at?: string
          would_buy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panel_answers_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_results: {
        Row: {
          completed_responses: number
          created_at: string
          id: string
          indifference_price: number
          optimal_price_point: number
          point_of_marginal_cheapness: number
          point_of_marginal_expensiveness: number
          run_id: string
        }
        Insert: {
          completed_responses: number
          created_at?: string
          id?: string
          indifference_price: number
          optimal_price_point: number
          point_of_marginal_cheapness: number
          point_of_marginal_expensiveness: number
          run_id: string
        }
        Update: {
          completed_responses?: number
          created_at?: string
          id?: string
          indifference_price?: number
          optimal_price_point?: number
          point_of_marginal_cheapness?: number
          point_of_marginal_expensiveness?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          buy_rate: number
          conditions: Json
          created_at: string
          id: string
          next_tests: Json
          run_id: string
          summary: string
          user_id: string
          verdict: string
        }
        Insert: {
          buy_rate: number
          conditions: Json
          created_at?: string
          id?: string
          next_tests: Json
          run_id: string
          summary: string
          user_id: string
          verdict: string
        }
        Update: {
          buy_rate?: number
          conditions?: Json
          created_at?: string
          id?: string
          next_tests?: Json
          run_id?: string
          summary?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      runs: {
        Row: {
          buyer_target: number
          buyers_completed: number
          created_at: string
          credits_cost: number
          credits_refunded: boolean
          error_message: string | null
          id: string
          idea_id: string
          mode: string
          stage: string
          stage_progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_target: number
          buyers_completed?: number
          created_at?: string
          credits_cost: number
          credits_refunded?: boolean
          error_message?: string | null
          id?: string
          idea_id: string
          mode: string
          stage?: string
          stage_progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_target?: number
          buyers_completed?: number
          created_at?: string
          credits_cost?: number
          credits_refunded?: boolean
          error_message?: string | null
          id?: string
          idea_id?: string
          mode?: string
          stage?: string
          stage_progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_credits: {
        Args: { _amount: number; _target_user_id: string }
        Returns: number
      }
      claim_panel_batch: {
        Args: { _batch_size: number; _run_id: string }
        Returns: {
          answer_id: string
          persona: Json
          persona_index: number
        }[]
      }
      fail_run_and_refund: {
        Args: { _message: string; _run_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      start_idea_run: {
        Args: { _idea_id: string; _mode: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
