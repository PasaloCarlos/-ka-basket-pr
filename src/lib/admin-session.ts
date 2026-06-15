// Signed admin session token: "<expiresAtMs>.<hmacHex>".
// Uses Web Crypto (available in both the Node server-action runtime and the
// edge proxy runtime) so a single implementation works everywhere.

const TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET no está configurado");
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(payload)
  );
  return toHex(sig);
}

export async function signSession(now: number = Date.now()): Promise<string> {
  const exp = now + TTL_MS;
  return `${exp}.${await sign(String(exp))}`;
}

export async function verifySession(
  token: string | undefined | null,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expStr = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;

  const expectedSig = await sign(expStr);
  // length-safe constant-time-ish comparison
  if (expectedSig.length !== providedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ providedSig.charCodeAt(i);
  }
  return diff === 0;
}

export const ADMIN_COOKIE = "ka_admin";
