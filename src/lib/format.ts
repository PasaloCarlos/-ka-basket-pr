import { event } from "@/config/event.config";

export function dateLabel(): string {
  const d = event.details.date;
  if (!d) return event.details.dateLabel;
  return new Date(d).toLocaleDateString("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function timeLabel(): string | null {
  const d = event.details.date;
  if (!d) return null;
  return new Date(d).toLocaleTimeString("es-PR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function locationLabel(): string {
  return event.details.location ?? event.details.locationLabel;
}

export function priceLabel(): string {
  return event.details.price ?? event.details.priceLabel;
}

// Builds a wa.me link from the configured number, or null if not set.
export function whatsappUrl(): string | null {
  const digits = (event.brand.whatsapp ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(event.brand.whatsappMessage)}`;
}
