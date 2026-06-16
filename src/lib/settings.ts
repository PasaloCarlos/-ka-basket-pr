import { createAdminClient } from "@/lib/supabase/admin";

export async function getRulesBody(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rules_body")
    .maybeSingle();
  return data?.value ?? "";
}
