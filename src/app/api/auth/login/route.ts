import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, verifyPassword } from "@/lib/auth";
import { getAppMode } from "@/lib/app-mode";
import { isAdminConfigured, verifyAdminCredentials } from "@/lib/admin-credentials";
import { findTenantByPhone, getTenantAccessBlock } from "@/lib/tenants-repository";

const INVALID = "بيانات تسجيل الدخول غير صحيحة";

// Simple in-memory brute-force protection (per process): 10 failed attempts / 15 min per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

function isLocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || entry.resetAt < Date.now()) {
    failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  if (isLocked(key)) {
    return NextResponse.json(
      { error: "تم تجاوز عدد محاولات الدخول المسموح بها. حاول مرة أخرى بعد 15 دقيقة." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!phone || !password) {
      return NextResponse.json({ error: "يرجى إدخال رقم الهاتف وكلمة المرور" }, { status: 400 });
    }

    const mode = getAppMode();

    // 1. Super Admin — only on the admin process (or local "all" mode), credentials from env.
    if (mode !== "tenant") {
      const admin = verifyAdminCredentials(phone, password);
      if (admin) {
        failures.delete(key);
        await createSessionCookie({ id: admin.id, phone: admin.phone, role: "SUPER_ADMIN", name: admin.name });
        return NextResponse.json({
          success: true,
          message: "تم تسجيل الدخول بنجاح كمدير للنظام",
          role: "SUPER_ADMIN",
          redirectUrl: "/admin",
        });
      }
      if (mode === "admin") {
        recordFailure(key);
        const error = isAdminConfigured() ? INVALID : "حساب مدير النظام غير مضبوط على الخادم (ADMIN_PHONE / ADMIN_PASSWORD_HASH).";
        return NextResponse.json({ error }, { status: 401 });
      }
    }

    // 2. Tenants — never on the admin process.
    const user = await findTenantByPhone(phone);
    if (!user || !user.password || user.role !== "TENANT") {
      recordFailure(key);
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      recordFailure(key);
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // Check subscription status for tenants (stopped / expired / past due date)
    const blockReason = getTenantAccessBlock(user);
    if (blockReason) {
      return NextResponse.json({ error: blockReason }, { status: 403 });
    }

    failures.delete(key);
    await createSessionCookie({ id: user.id, phone: user.phone, role: "TENANT", name: user.name });

    return NextResponse.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      role: "TENANT",
      redirectUrl: "/",
    });
  } catch (error: any) {
    console.error("Login authentication error:", error);
    return NextResponse.json({ error: error?.message || "حدث خطأ أثناء تسجيل الدخول" }, { status: 500 });
  }
}
