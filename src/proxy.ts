import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAppMode, getAdminHost, getSessionCookieName } from "@/lib/app-mode";
import { verifySessionToken } from "@/lib/session-token";

/**
 * Domain / mode gate (Next.js 16 "proxy", formerly middleware).
 *
 *  - tenant mode: teacher domains. /admin and /api/admin do not exist (404).
 *  - admin mode : exambuilderadmin domain. Only /admin, /login and /api/auth/* exist.
 *  - all mode   : local development, both sides available.
 *
 * Session cookies are HMAC-signed, so a forged role is rejected here and again
 * inside every page / route / server action via getSessionUser().
 */

const TENANT_APP_PREFIXES = [
  "/exam-builder",
  "/groups",
  "/students",
  "/qr-printing",
  "/uploaded-files",
  "/images-to-pdf",
  "/created-exams",
  "/my-subscription",
  "/subscription",
];

function notFound(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  // Plain 404 (a rewrite would be proxied to https://localhost behind Nginx SSL and fail with 500).
  return new NextResponse(
    '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title></head>' +
      '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a">' +
      '<div style="text-align:center"><h1 style="font-size:48px;margin:0">404</h1><p>الصفحة غير موجودة</p></div></body></html>',
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function redirectTo(request: NextRequest, path: string, callbackUrl?: string) {
  const url = new URL(path, request.url);
  if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(url);
}

function hostOf(request: NextRequest): string {
  return (request.headers.get("host") || "").split(":")[0].trim().toLowerCase();
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = getAppMode();

  const session = verifySessionToken(request.cookies.get(getSessionCookieName())?.value);
  const isAdmin = session?.role === "SUPER_ADMIN" && mode !== "tenant";
  const isTenant = session?.role === "TENANT" && mode !== "admin";

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ADMIN DOMAIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === "admin") {
    const adminHost = getAdminHost();
    if (adminHost && hostOf(request) !== adminHost) return notFound(request);

    if (pathname.startsWith("/api/auth/")) return NextResponse.next();

    if (pathname === "/") return redirectTo(request, isAdmin ? "/admin" : "/login");

    if (pathname === "/login") {
      return isAdmin ? redirectTo(request, "/admin") : NextResponse.next();
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return isAdmin ? NextResponse.next() : redirectTo(request, "/login", pathname);
    }

    // Everything else (exam builder, OCR, files API, â€¦) does not exist on the admin domain.
    return notFound(request);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ TENANT DOMAINS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === "tenant" && isAdminPath(pathname)) return notFound(request);

  // Public zero-login parent portal exemption: /s/* is directly accessible by parents without login
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  if (pathname === "/login") {
    if (request.nextUrl.searchParams.has("blocked") || request.nextUrl.searchParams.has("logout")) {
      const response = NextResponse.next();
      response.cookies.set(getSessionCookieName(), "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      return response;
    }
    if (isAdmin) return redirectTo(request, "/admin");
    if (isTenant) return redirectTo(request, "/");
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (isAdmin) return redirectTo(request, "/admin");
    if (isTenant) return NextResponse.next();
    return redirectTo(request, "/login");
  }

  // Local "all" mode only: admin dashboard
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (isAdmin) return NextResponse.next();
    if (isTenant) return redirectTo(request, "/denied");
    return redirectTo(request, "/login", pathname);
  }

  if (TENANT_APP_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isTenant && !isAdmin) return redirectTo(request, "/login", pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     * /_next/static, /_next/image, /favicon.ico, /images/*
     * (API routes ARE matched so the admin domain can hide tenant APIs.)
     */
    "/((?!_next/static|_next/image|favicon.ico|images).*)",
  ],
};
