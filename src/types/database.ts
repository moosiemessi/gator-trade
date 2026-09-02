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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      games: {
        Row: {
          id: string
          is_home: boolean
          kickoff_at: string
          opponent: string
          season: number
          venue: string | null
        }
        Insert: {
          id?: string
          is_home: boolean
          kickoff_at: string
          opponent: string
          season: number
          venue?: string | null
        }
        Update: {
          id?: string
          is_home?: boolean
          kickoff_at?: string
          opponent?: string
          season?: number
          venue?: string | null
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          author_confirmed_at: string | null
          author_marked_sent_at: string | null
          cash_settled_at: string | null
          created_at: string
          id: string
          proposal_id: string
          proposer_confirmed_at: string | null
          proposer_marked_sent_at: string | null
        }
        Insert: {
          author_confirmed_at?: string | null
          author_marked_sent_at?: string | null
          cash_settled_at?: string | null
          created_at?: string
          id?: string
          proposal_id: string
          proposer_confirmed_at?: string | null
          proposer_marked_sent_at?: string | null
        }
        Update: {
          author_confirmed_at?: string | null
          author_marked_sent_at?: string | null
          cash_settled_at?: string | null
          created_at?: string
          id?: string
          proposal_id?: string
          proposer_confirmed_at?: string | null
          proposer_marked_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          proposal_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          proposal_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          proposal_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_images: {
        Row: {
          created_at: string
          id: string
          post_id: string
          s3_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          s3_key: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          s3_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_offer_items: {
        Row: {
          game_id: string
          id: string
          post_id: string
          quantity: number
          row_label: string | null
          seat_labels: string[] | null
          section_code: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type"]
        }
        Insert: {
          game_id: string
          id?: string
          post_id: string
          quantity: number
          row_label?: string | null
          seat_labels?: string[] | null
          section_code?: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type"]
        }
        Update: {
          game_id?: string
          id?: string
          post_id?: string
          quantity?: number
          row_label?: string | null
          seat_labels?: string[] | null
          section_code?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
        }
        Relationships: [
          {
            foreignKeyName: "post_offer_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_offer_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_offer_items_section_code_fkey"
            columns: ["section_code"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["code"]
          },
        ]
      }
      post_want_items: {
        Row: {
          acceptable_game_ids: string[]
          id: string
          max_tier: number | null
          min_tier: number | null
          post_id: string
          quantity: number
          require_together: boolean
        }
        Insert: {
          acceptable_game_ids: string[]
          id?: string
          max_tier?: number | null
          min_tier?: number | null
          post_id: string
          quantity: number
          require_together?: boolean
        }
        Update: {
          acceptable_game_ids?: string[]
          id?: string
          max_tier?: number | null
          min_tier?: number | null
          post_id?: string
          quantity?: number
          require_together?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "post_want_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          cash_delta_cents: number
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          cash_delta_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          cash_delta_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          created_at: string
          display_name: string
          id: string
          is_verified: boolean
          ufl_email: string
          venmo_handle: string | null
        }
        Insert: {
          avatar_key?: string | null
          created_at?: string
          display_name: string
          id: string
          is_verified?: boolean
          ufl_email: string
          venmo_handle?: string | null
        }
        Update: {
          avatar_key?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_verified?: boolean
          ufl_email?: string
          venmo_handle?: string | null
        }
        Relationships: []
      }
      proposal_items: {
        Row: {
          game_id: string
          id: string
          proposal_id: string
          quantity: number
          row_label: string | null
          seat_labels: string[] | null
          section_code: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type"]
        }
        Insert: {
          game_id: string
          id?: string
          proposal_id: string
          quantity: number
          row_label?: string | null
          seat_labels?: string[] | null
          section_code?: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type"]
        }
        Update: {
          game_id?: string
          id?: string
          proposal_id?: string
          quantity?: number
          row_label?: string | null
          seat_labels?: string[] | null
          section_code?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_section_code_fkey"
            columns: ["section_code"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["code"]
          },
        ]
      }
      proposals: {
        Row: {
          cash_delta_cents: number
          created_at: string
          id: string
          message: string | null
          post_id: string
          proposer_id: string
          status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          cash_delta_cents: number
          created_at?: string
          id?: string
          message?: string | null
          post_id: string
          proposer_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          cash_delta_cents?: number
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string
          proposer_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "proposals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          code: string
          is_student: boolean
          level: string
          tier: number
        }
        Insert: {
          code: string
          is_student?: boolean
          level: string
          tier: number
        }
        Update: {
          code?: string
          is_student?: boolean
          level?: string
          tier?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      post_status: "open" | "pending" | "completed" | "withdrawn" | "expired"
      proposal_status: "pending" | "accepted" | "declined" | "withdrawn"
      ticket_type: "assigned" | "general_admission"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      post_status: ["open", "pending", "completed", "withdrawn", "expired"],
      proposal_status: ["pending", "accepted", "declined", "withdrawn"],
      ticket_type: ["assigned", "general_admission"],
    },
  },
} as const
