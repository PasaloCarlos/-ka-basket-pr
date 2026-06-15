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
  title: `${event.brand.name} — Torneo de Baloncesto`,
  description: `${event.brand.coach}: ${event.brand.tagline}`,
  // The site is already dark — tell the Dark Reader extension to stand down so it
  // doesn't re-tint our palette or inject attributes that break hydration.
  other: { "darkreader-lock": "ka-basket-pr" },
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
