import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

// Service-role client. Bypasses RLS — use ONLY inside Server Actions, never in
// client components or anything that reaches the browser. The service role key
// must not be exposed via a NEXT_PUBLIC_* var.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
