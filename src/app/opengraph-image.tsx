import { ImageResponse } from "next/og";
import { event } from "@/config/event.config";
import { dateLabel } from "@/lib/format";

export const alt = `${event.brand.name} — Torneo de Baloncesto`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pull the heavy display face so the share card reads like a flyer, not default text.
async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Archivo+Black", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((.+?)\)\s*format/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image() {
  const dateStr = (event.details.date ? dateLabel() : "Próximamente").toUpperCase();
  const font = await loadFont();
  const fontFamily = font ? "Archivo Black" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          backgroundImage:
            "radial-gradient(900px 500px at 80% -10%, rgba(242,103,34,0.28), transparent 60%)",
          padding: 72,
          fontFamily,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              width: 92,
              height: 92,
              borderRadius: 999,
              background: "#F26722",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0a0a",
              fontSize: 44,
            }}
          >
            KA
          </div>
          <div style={{ display: "flex", color: "#fafafa", fontSize: 40, letterSpacing: 2 }}>
            {event.brand.name.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#fafafa", fontSize: 112, lineHeight: 1 }}>TORNEO DE</div>
          <div style={{ display: "flex", color: "#F26722", fontSize: 112, lineHeight: 1 }}>BALONCESTO</div>
          <div style={{ display: "flex", color: "#bdbdbd", fontSize: 38, marginTop: 28, letterSpacing: 6 }}>
            1 VS 1 · 2 VS 2 · 5 VS 5
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", color: "#fafafa", fontSize: 34 }}>{dateStr}</div>
          <div style={{ display: "flex", color: "#F26722", fontSize: 30 }}>{event.brand.instagramHandle}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Archivo Black", data: font, weight: 400, style: "normal" }] : undefined,
    }
  );
}
