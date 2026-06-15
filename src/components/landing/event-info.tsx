import { CalendarDays, MapPin, Ticket, Clock } from "lucide-react";
import { event } from "@/config/event.config";
import { dateLabel, timeLabel, locationLabel, priceLabel } from "@/lib/format";

function InfoRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-border py-5 last:border-0">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="font-display text-2xl uppercase text-foreground">{value}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function EventInfo() {
  return (
    <section id="info" className="relative px-6 py-20">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">El evento</p>
          <h2 className="mt-2 font-display text-4xl font-black sm:text-6xl">Día de juego</h2>
          <p className="mt-5 max-w-md text-muted-foreground">
            Reúne tu equipo y vive un día de baloncesto en Puerto Rico. {event.details.paymentNote}{" "}
            Habrá comida en el evento.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 px-6 backdrop-blur-sm">
          <InfoRow
            icon={<CalendarDays className="size-6" />}
            label="Fecha"
            value={dateLabel()}
            sub={timeLabel()}
          />
          <InfoRow icon={<Clock className="size-6" />} label="Hora" value={timeLabel() ?? "Próximamente"} />
          <InfoRow icon={<MapPin className="size-6" />} label="Lugar" value={locationLabel()} />
          <InfoRow
            icon={<Ticket className="size-6" />}
            label="Entrada"
            value={priceLabel()}
            sub="Se paga en la puerta"
          />
        </div>
      </div>
    </section>
  );
}
