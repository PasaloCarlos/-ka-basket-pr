export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: string;
          slug: string;
          name: string;
          format: string;
          roster_min: number;
          roster_max: number;
          division: "female" | "male";
          age_bracket: string | null;
          sort_order: number | null;
          is_open: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          format: string;
          roster_min?: number;
          roster_max?: number;
          division: "female" | "male";
          age_bracket?: string | null;
          sort_order?: number | null;
          is_open?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          format?: string;
          roster_min?: number;
          roster_max?: number;
          division?: "female" | "male";
          age_bracket?: string | null;
          sort_order?: number | null;
          is_open?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          tournament_id: string;
          team_name: string;
          division: "female" | "male";
          age_bracket: string | null;
          captain_name: string;
          captain_phone: string;
          captain_email: string | null;
          notes: string | null;
          status: "pending" | "confirmed" | "cancelled";
          paid: boolean;
          paid_at: string | null;
          lookup_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          team_name: string;
          division: "female" | "male";
          age_bracket?: string | null;
          captain_name: string;
          captain_phone: string;
          captain_email?: string | null;
          notes?: string | null;
          status?: "pending" | "confirmed" | "cancelled";
          paid?: boolean;
          paid_at?: string | null;
          lookup_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          team_name?: string;
          division?: "female" | "male";
          age_bracket?: string | null;
          captain_name?: string;
          captain_phone?: string;
          captain_email?: string | null;
          notes?: string | null;
          status?: "pending" | "confirmed" | "cancelled";
          paid?: boolean;
          paid_at?: string | null;
          lookup_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          jersey_number: number | null;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          jersey_number?: number | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          jersey_number?: number | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      registration_status: "pending" | "confirmed" | "cancelled";
      division_type: "female" | "male";
    };
    CompositeTypes: Record<string, never>;
  };
};
