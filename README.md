# KA Basket PR

Página en español para el torneo de baloncesto de la entrenadora **Kaguayo**
([@kaguayobasketpr](https://www.instagram.com/kaguayobasketpr/)): promoción del
evento + inscripción de equipos + confirmación por administración.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript · **Supabase**
(Postgres + RLS) · **Tailwind CSS 4** · Server Actions · desplegado en **Netlify**.
Mismo molde que el proyecto hermano `salidas-2026`.

## Cómo correr localmente

1. `npm install`
2. Crea un proyecto en [Supabase](https://supabase.com).
3. En el **SQL Editor** de Supabase, ejecuta en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_triggers.sql`
   - `supabase/seed.sql` (siembra las categorías; arrancan **cerradas** —
     ábrelas con `is_open = true` cuando confirmes el lineup)
4. Copia `.env.local.example` → `.env.local` y rellena los valores
   (Project Settings → API): URL, anon key, **service_role key**, y elige un
   `ADMIN_PASSWORD` + un `ADMIN_SESSION_SECRET` (hex aleatorio de 32 bytes).
5. `npm run dev` → http://localhost:3000

## Editar el contenido del evento

**Todo el contenido editable vive en `src/config/event.config.ts`.** Fecha,
lugar, precio, fecha límite y menú están en `null` y muestran "Próximamente"
hasta que les pongas valor. Las categorías (`1v1`/`2v2`/`5v5`) y los tamaños de
roster también salen de ahí — manténlas en sync con `supabase/seed.sql`.

## Rutas

| Ruta | Acceso | Qué hace |
|---|---|---|
| `/` | público | Landing: hero, info, categorías, comida, cuenta regresiva, footer |
| `/registro` | público | Formulario de inscripción de equipos |
| `/equipos` | público | Consulta de estado por código |
| `/admin/login` | público | Acceso por contraseña |
| `/admin` | protegido | Panel: confirmar / marcar pagado / cancelar / eliminar |

## Seguridad

Las inscripciones son anónimas. Las tablas `teams` y `players` tienen RLS
**deny-all** para la anon key; toda escritura/lectura sensible pasa por Server
Actions con el cliente service-role (`src/lib/supabase/admin.ts`). El panel admin
se protege con contraseña compartida + cookie firmada (`requireAdmin()` en cada
acción **y** en `src/proxy.ts`).

## Comandos

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run lint` — ESLint
- `npm run test` — pruebas unitarias (vitest)

## Deploy (Netlify)

`netlify.toml` ya está listo (`@netlify/plugin-nextjs`). En el dashboard de
Netlify añade las mismas variables de entorno; marca `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` como **secretas** (solo las
`NEXT_PUBLIC_*` llegan al navegador). Pon `NEXT_PUBLIC_APP_URL` a la URL de prod.

## Futuro

- Multi-admin / login "real": upgrade directo al patrón Supabase Auth de
  `salidas-2026` + allowlist de emails en `requireAdmin()`.
