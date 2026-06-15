import type { Metadata, Viewport } from "next";
import { Archivo_Black, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { event } from "@/config/event.config";
import "./globals.css";

const display = Archivo_Black({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: `${event.brand.name} — Torneo de Baloncesto`,
  description:
    "Torneo de baloncesto en Puerto Rico — 1v1, 2v2 y 5v5. Femenino de todas las edades y categoría masculina. Inscribe tu equipo.",
  // The site is already dark — tell the Dark Reader extension to stand down so it
  // doesn't re-tint our palette or inject attributes that break hydration.
  other: { "darkreader-lock": "ka-basket-pr" },
  // og:image is auto-wired from app/opengraph-image.tsx; this fills the rest of the card.
  openGraph: {
    title: `${event.brand.name} — Torneo de Baloncesto`,
    description: `Torneo de baloncesto 1v1 · 2v2 · 5v5 en Puerto Rico. ${event.details.paymentNote}`,
    type: "website",
    locale: "es_PR",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="grain font-sans antialiased">
        {children}
        <Toaster position="top-center" theme="dark" richColors offset={{ top: "1.5rem" }} />
      </body>
    </html>
  );
}
