import { cookies } from "next/headers";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin-session";

// Throws "No autorizado" when the signed admin cookie is missing/invalid.
// Called at the top of every admin DATA action — never trust the proxy alone.
// (adminLogin/adminLogout manage the session itself and are deliberate exceptions.)
export async function requireAdmin(): Promise<void> {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await verifySession(cookie))) {
    throw new Error("No autorizado");
  }
}
