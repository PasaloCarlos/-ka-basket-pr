import { event } from "@/config/event.config";
import type { TeamWithDetails } from "@/types";

export type WhatsAppTemplateKey = keyof typeof event.whatsappTemplates;

export function fillTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

// Local numbers are often entered without the country code; wa.me needs it.
function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `1${digits}` : digits; // 10 digits => assume PR/US
}

export function captainWhatsappUrl(team: TeamWithDetails, key: WhatsAppTemplateKey): string | null {
  const phone = normalizePhone(team.captain_phone);
  if (!phone) return null;
  const text = fillTemplate(event.whatsappTemplates[key], {
    team: team.team_name,
    captain: team.captain_name,
    code: team.lookup_code,
    category: team.tournaments?.name ?? "",
  });
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
