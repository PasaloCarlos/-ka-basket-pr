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
  // `blurb` = descripción de la tarjeta · `detail` = línea de detalle.
  // rosterMin/rosterMax SÍ se usan para validar el formulario — no los borres.
  categories: [
    { slug: "1v1" as CategoryFormat, name: "1 vs 1", rosterMin: 1, rosterMax: 1, blurb: "Poner descripción aquí.", detail: "Detalle aquí." },
    { slug: "2v2" as CategoryFormat, name: "2 vs 2", rosterMin: 2, rosterMax: 3, blurb: "Poner descripción aquí.", detail: "Detalle aquí." },
    { slug: "5v5" as CategoryFormat, name: "5 vs 5", rosterMin: 5, rosterMax: 8, blurb: "Poner descripción aquí.", detail: "Detalle aquí." },
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

  // Contador de equipos inscritos por categoría (prueba social + urgencia).
  // El conteo sale de la base de datos; estas son solo las etiquetas.
  counter: {
    enabled: true,
    scarcityLabel: "cupos limitados", // se muestra junto al conteo
    emptyLabel: "Sé el primer equipo", // cuando aún no hay inscritos
    oneLabel: "equipo inscrito",
    manyLabel: "equipos inscritos",
    fullLabel: "Cupo lleno",
    spotsLeftLabel: "cupos disponibles",
  },

  // Auspiciadores. Pon los logos en public/sponsors/ y referéncialos aquí.
  // Mientras `items` esté vacío, se muestra una invitación a auspiciar.
  sponsors: {
    enabled: true,
    title: "Auspiciadores",
    intro: "Gracias a quienes hacen posible este torneo.",
    ctaText: "¿Quieres auspiciar este evento?",
    items: [] as { name: string; logo: string; url?: string | null }[],
  },

  // Precio numérico OPCIONAL para el panel admin (cálculo de recaudo).
  // Distinto de details.price (texto público). amount=null oculta el recaudo.
  pricing: {
    amount: null as number | null, // ej. 10
    basis: "team" as "team" | "player", // ¿el precio es por equipo o por jugador?
    currency: "$",
  },

  // Plantillas de WhatsApp para escribir a capitanes desde /admin.
  // Variables disponibles: {team} {captain} {code} {category}
  whatsappTemplates: {
    confirmacion:
      '¡Hola {captain}! Tu equipo "{team}" ({category}) quedó confirmado para el torneo 🏀. El pago se realiza en la entrada. Tu código es {code}.',
    pago:
      '¡Hola {captain}! Recordatorio: el pago de "{team}" se realiza en la puerta el día del evento. ¡Nos vemos!',
    seguimiento:
      '¡Hola {captain}! Te escribo sobre la inscripción de tu equipo "{team}" en el torneo 🏀.',
  },

  // Página pública del torneo (/torneo): brackets en vivo + reglas.
  tournament: {
    enabled: true, // muestra /torneo y el enlace "Torneo" en el nav
    navLabel: "Torneo",
    pageTitle: "El Torneo",
    pageIntro: "Brackets en vivo y reglas del torneo.",
    rulesTitle: "Reglas del torneo",
    bracketsEmptyLabel: "Los brackets se publicarán pronto.",
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
