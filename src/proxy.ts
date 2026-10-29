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

const EXACT_TENANT_PAGES = new Set([
  "/",
  "/exam-builder",
  "/groups",
  "/students",
  "/qr-printing",
  "/excel-sheets",
  "/uploaded-files",
  "/images-to-pdf",
  "/created-exams",
  "/my-subscription",
  "/subscription",
  "/denied",
]);

function isValidTenantPagePath(pathname: string): boolean {
  if (EXACT_TENANT_PAGES.has(pathname)) return true;
  if (pathname.startsWith("/students/") && pathname.split("/").length === 3) return true;
  return false;
}

function notFound(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  // Standalone 404 page outside RootLayout (never renders Sidebar or TopHeaderBar).
  return new NextResponse(
    '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 - الصفحة غير موجودة</title></head>' +
      '<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc;padding:16px">' +
      '<div style="text-align:center;max-width:420px;background:#1e293b;border:1px solid #334155;border-radius:24px;padding:36px 28px;box-shadow:0 20px 50px rgba(0,0,0,0.4)">' +
      '<div style="font-size:56px;font-weight:900;color:#3b82f6;line-height:1;margin-bottom:12px">404</div>' +
      '<h1 style="font-size:18px;font-weight:800;margin:0 0 8px 0;color:#ffffff">هذا الرابط غير موجود في المنصة</h1>' +
      '<p style="font-size:13px;color:#94a3b8;margin:0 0 24px 0;line-height:1.6">يرجى التأكد من صحة الرابط أو الانتقال لصفحة تسجيل الدخول للمتابعة.</p>' +
      '<a href="/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 28px;border-radius:14px">الانتقال إلى تسجيل الدخول</a>' +
      "</div></body></html>",
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

  // ───────────────────────────── ADMIN DOMAIN ─────────────────────────────
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

    // Everything else (exam builder, OCR, files API, ...) does not exist on the admin domain.
    return notFound(request);
  }

  // ───────────────────────────── TENANT DOMAINS ─────────────────────────────
  if (mode === "tenant" && isAdminPath(pathname)) return notFound(request);

  // Public zero-login parent portal exemption: /s/* is directly accessible by parents without login
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  // Require an authenticated tenant or admin session for all protected API routes
  if (pathname.startsWith("/api/")) {
    if (!isTenant && !isAdmin) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول. يرجى تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/sample-textbook.svg") {
    return NextResponse.next();
  }

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

  // Local "all" mode only: admin dashboard
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (isAdmin) return NextResponse.next();
    if (isTenant) return redirectTo(request, "/denied");
    return redirectTo(request, "/login", pathname);
  }

  // Block any unknown/random path after "/" from ever entering the system layout:
  // - Unauthenticated visitors are redirected straight to /login
  // - Authenticated users get a standalone 404 screen (no Sidebar / Header)
  if (!isValidTenantPagePath(pathname)) {
    if (!isTenant && !isAdmin) return redirectTo(request, "/login");
    return notFound(request);
  }

  // All valid tenant pages require authentication
  if (!isTenant && !isAdmin) {
    return redirectTo(request, "/login", pathname === "/" ? undefined : pathname);
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
