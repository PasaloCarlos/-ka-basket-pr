import { event } from "@/config/event.config";

export function isDeadlinePassed(now: Date = new Date()): boolean {
  const d = event.registration.deadline;
  return !!d && new Date(d) < now;
}

export function isRegistrationOpen(now: Date = new Date()): boolean {
  return event.registration.open && !isDeadlinePassed(now);
}
