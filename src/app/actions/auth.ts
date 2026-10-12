"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionCookie, clearSessionCookie } from "@/lib/auth";

export interface LoginActionResult {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  prevState: LoginActionResult | null,
  formData: FormData
): Promise<LoginActionResult | void> {
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;

  if (!phone || !password) {
    return { error: "يرجى إدخال رقم الهاتف وكلمة المرور" };
  }

  const cleanPhone = phone.trim();

  try {
    // Find user / tenant in database
    const user = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      return { error: "بيانات تسجيل الدخول غير صحيحة" };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return { error: "بيانات تسجيل الدخول غير صحيحة" };
    }

    // Check tenant subscription status
    if (user.role === "TENANT" && user.subscriptionStatus === "STOPPED") {
      return { error: "حسابك متوقف حالياً. يرجى التواصل مع الإدارة." };
    }

    // Set session cookie
    await createSessionCookie({
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    });

    // Server-side redirection based on role:
    // SUPER_ADMIN -> /admin
    // TENANT -> /exam-builder
    if (user.role === "SUPER_ADMIN") {
      redirect("/admin");
    } else {
      redirect("/exam-builder");
    }
  } catch (err: any) {
    // If it's a redirect error thrown by Next.js, re-throw it so redirect works
    if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Login action error:", err);
    if (err?.code === "ECONNREFUSED" || err?.message?.includes("ECONNREFUSED")) {
      return { error: "تعذر الاتصال بقاعدة البيانات PostgreSQL. يرجى التأكد من تشغيل خادم قاعدة البيانات." };
    }
    return { error: err?.message || "حدث خطأ أثناء تسجيل الدخول" };
  }
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
