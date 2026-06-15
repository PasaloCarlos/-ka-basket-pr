import { NextResponse, type NextRequest } from "next/server";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin-session";

// UX gate only — real enforcement lives in requireAdmin() inside every admin
// Server Action. Never trust the proxy alone.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea =
    pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (isAdminArea) {
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!(await verifySession(cookie))) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
