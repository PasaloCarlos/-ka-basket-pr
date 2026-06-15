# This is NOT the Next.js you know

This project uses Next.js 16 (App Router) which has breaking changes — APIs,
conventions, and file structure may differ from older Next.js. Read the relevant
guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed
deprecation notices.

## Project shape

- Promo + team-registration app for a basketball event (Spanish, es).
- Stack mirrors the sibling `salidas-2026` project: Next 16 + React 19 + TS +
  Supabase (`@supabase/ssr`) + Tailwind 4 + shadcn (`base-nova`) + Server Actions.
- All editable event content lives in `src/config/event.config.ts` (single source
  of truth). Do NOT hardcode event copy in components.
- Registrants are anonymous (no accounts). Sensitive tables (`teams`, `players`)
  are RLS deny-all to the anon key; all writes/sensitive reads go through Server
  Actions using the service-role client (`src/lib/supabase/admin.ts`).
- Admin panel is gated by a single shared password + signed httpOnly cookie
  (`ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`), enforced in `requireAdmin()` inside
  every admin action AND in `src/proxy.ts`. Never trust the proxy alone.
