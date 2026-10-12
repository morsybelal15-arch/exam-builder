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
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = getSessionFromCookie(sessionCookie);

  // 1. If accessing the Login page:
  if (pathname === "/login") {
    // If already logged in, redirect them to their respective portal
    if (session) {
      if (session.role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL("/exam-builder", request.url));
    }
    return NextResponse.next();
  }

  // 2. If accessing root (/):
  if (pathname === "/") {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.redirect(new URL("/exam-builder", request.url));
  }

  // 3. If accessing Super Admin dashboard (/admin and sub-routes):
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/denied", request.url));
    }
    return NextResponse.next();
  }

  // 4. Protected App Routes for Tenants (and Admin):
  const isProtectedAppRoute =
    pathname.startsWith("/exam-builder") ||
    pathname.startsWith("/uploaded-files") ||
    pathname.startsWith("/images-to-pdf") ||
    pathname.startsWith("/created-exams") ||
    pathname.startsWith("/my-subscription") ||
    pathname.startsWith("/subscription");

  if (isProtectedAppRoute) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/auth/* (authentication endpoints)
     * 2. /_next/static (static files)
     * 3. /_next/image (image optimization files)
     * 4. /favicon.ico, /images/*, static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)",
  ],
};
