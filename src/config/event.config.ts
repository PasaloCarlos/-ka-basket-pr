// ============================================================
// EVENT CONFIG — ÚNICA FUENTE DE VERDAD
// ============================================================
// Edita SOLO este archivo para cambiar textos, fechas, precios y categorías.
// Mientras un dato esté en `null`, la página muestra "Próximamente".
//
// NOTA: los slugs/formatos de `categories` deben mantenerse en sincronía con
// la tabla `tournaments` (ver supabase/seed.sql).
// ============================================================

export type CategoryFormat = "1v1" | "2v2" | "5v5";
export type DivisionKey = "female" | "male";

export const event = {
  brand: {
    name: "KA Basket PR",
    coach: "Kaguayo",
    instagram: "https://www.instagram.com/kaguayobasketpr/",
    instagramHandle: "@kaguayobasketpr",
    tagline:
      "Entrenadora, jugadora y árbitro de baloncesto. Clínicas individualizadas. Desarrollando el valor del deporte en la niñez y juventud de Puerto Rico.",
    logo: "/logo-ka.jpg",
    // Canal de preguntas por WhatsApp. Incluye el código de país (1 para PR);
    // whatsappUrl() le quita todo lo que no sea dígito. null = oculta el botón.
    whatsapp: "1 (939) 332-5639" as string | null,
    whatsappMessage: "¡Hola! Tengo una pregunta sobre el torneo de baloncesto 🏀",
  },

  // Detalles del evento. Deja en `null` lo que aún no esté confirmado.
  details: {
    date: null as string | null, // ISO string (ej. "2026-08-15T09:00:00-04:00")
    dateLabel: "Próximamente",
    location: null as string | null,
    locationLabel: "Próximamente",
    locationMapUrl: null as string | null,
    price: null as string | null, // ej. "$10 por persona"
    priceLabel: "Próximamente",
    paymentNote: "El pago se realiza en la entrada (puerta).",
  },

  registration: {
    open: true,
    deadline: null as string | null, // ISO string; null = sin fecha límite
    deadlineLabel: "Próximamente",
  },

  // Las categorías controlan el tamaño del roster en el formulario.
  categories: [
    { slug: "1v1" as CategoryFormat, name: "1 vs 1", rosterMin: 1, rosterMax: 1, blurb: "Mano a mano. Pura técnica." },
    { slug: "2v2" as CategoryFormat, name: "2 vs 2", rosterMin: 2, rosterMax: 3, blurb: "Tú y tu dúo. Hasta un suplente." },
    { slug: "5v5" as CategoryFormat, name: "5 vs 5", rosterMin: 5, rosterMax: 8, blurb: "El equipo completo en la cancha." },
  ],

  divisions: {
    female: {
      label: "Femenino",
      brackets: ["Sub-10", "Sub-12", "Sub-14", "Sub-16", "Juvenil", "Abierta"],
    },
    male: {
      label: "Masculino",
      brackets: ["Abierta"],
    },
  },

  food: {
    title: "Comida en el evento",
    teaser: "Pronto revelaremos el menú.",
  },

  countdown: { enabled: true }, // sólo se muestra si details.date tiene valor

  // Tokens de marca (documentación / reuso en TS).
  // Los valores aplicados viven en src/app/globals.css (@theme). Mantener en sync.
  theme: {
    background: "#000000", // negro
    foreground: "#FFFFFF", // blanco
    accent: "#F26722", // naranja baloncesto
    accentAlt: "#EE6B2F",
  },
} as const;

export type EventConfig = typeof event;
