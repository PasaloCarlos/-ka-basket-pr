import { Database } from "./database";

export type { Database };

// Row types
export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];

// Enums
export type RegistrationStatus = Database["public"]["Enums"]["registration_status"];
export type Division = Database["public"]["Enums"]["division_type"];

// Joined query results
export type TeamWithDetails = Team & {
  tournaments: Pick<Tournament, "name" | "format" | "division"> | null;
  players: Pick<Player, "name" | "jersey_number">[];
};
