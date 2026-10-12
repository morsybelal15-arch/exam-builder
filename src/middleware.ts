import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "exam_builder_session";

/**
 * Parses and validates the session payload directly from the cookie
 * Runs at the edge with zero database calls for maximum performance.
 */
function getSessionFromCookie(cookieValue?: string): { role?: string; id?: string; phone?: string } | null {
  if (!cookieValue) return null;
  try {
    const decoded = typeof atob === "function"
      ? atob(cookieValue)
      : Buffer.from(cookieValue, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Intercept any request trying to access paths starting with /admin
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = getSessionFromCookie(sessionCookie);

    // If not logged in at all -> redirect to /login
    if (!session || !session.id) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // If logged in, but role is NOT SUPER_ADMIN -> redirect to /denied
    if (session.role !== "SUPER_ADMIN") {
      const deniedUrl = new URL("/denied", request.url);
      return NextResponse.redirect(deniedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
  ],
};
