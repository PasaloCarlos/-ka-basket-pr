"use client";

import { QRCodeSVG } from "qrcode.react";

// Renders the lookup code as a scannable QR so captains can show it at the door.
export function LookupQr({ code, size = 132 }: { code: string; size?: number }) {
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3">
      <QRCodeSVG value={code} size={size} level="M" />
      <span className="font-display text-xs tracking-[0.3em] text-black">{code}</span>
    </div>
  );
}
