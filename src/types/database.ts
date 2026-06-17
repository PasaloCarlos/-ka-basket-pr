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
          max_teams: number | null;
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
          max_teams?: number | null;
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
          max_teams?: number | null;
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
          checked_in: boolean;
          checked_in_at: string | null;
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
          checked_in?: boolean;
          checked_in_at?: string | null;
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
          checked_in?: boolean;
          checked_in_at?: string | null;
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
      brackets: {
        Row: {
          id: string;
          name: string;
          tournament_id: string | null;
          status: "draft" | "active" | "completed";
          is_published: boolean;
          champion_team_id: string | null;
          champion_name: string | null;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tournament_id?: string | null;
          status?: "draft" | "active" | "completed";
          is_published?: boolean;
          champion_team_id?: string | null;
          champion_name?: string | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tournament_id?: string | null;
          status?: "draft" | "active" | "completed";
          is_published?: boolean;
          champion_team_id?: string | null;
          champion_name?: string | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bracket_teams: {
        Row: {
          bracket_id: string;
          team_id: string;
          team_name: string;
          seed: number;
        };
        Insert: {
          bracket_id: string;
          team_id: string;
          team_name: string;
          seed: number;
        };
        Update: {
          bracket_id?: string;
          team_id?: string;
          team_name?: string;
          seed?: number;
        };
        Relationships: [];
      };
      bracket_matches: {
        Row: {
          id: string;
          bracket_id: string;
          round: number;
          position: number;
          team1_id: string | null;
          team2_id: string | null;
          team1_name: string | null;
          team2_name: string | null;
          score1: number | null;
          score2: number | null;
          winner_team_id: string | null;
          winner_name: string | null;
          next_match_id: string | null;
          next_slot: number | null;
          is_bye: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bracket_id: string;
          round: number;
          position: number;
          team1_id?: string | null;
          team2_id?: string | null;
          team1_name?: string | null;
          team2_name?: string | null;
          score1?: number | null;
          score2?: number | null;
          winner_team_id?: string | null;
          winner_name?: string | null;
          next_match_id?: string | null;
          next_slot?: number | null;
          is_bye?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bracket_id?: string;
          round?: number;
          position?: number;
          team1_id?: string | null;
          team2_id?: string | null;
          team1_name?: string | null;
          team2_name?: string | null;
          score1?: number | null;
          score2?: number | null;
          winner_team_id?: string | null;
          winner_name?: string | null;
          next_match_id?: string | null;
          next_slot?: number | null;
          is_bye?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: string | null; updated_at: string };
        Insert: { key: string; value?: string | null; updated_at?: string };
        Update: { key?: string; value?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      registration_status: "pending" | "confirmed" | "cancelled";
      division_type: "female" | "male";
      bracket_status: "draft" | "active" | "completed";
    };
    CompositeTypes: Record<string, never>;
  };
};
