"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionCookie, clearSessionCookie, hashPassword } from "@/lib/auth";
import { findTenantByPhone } from "@/lib/tenants-repository";

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
    // 1. Designated Super Admin master verification (works even if DB is offline)
    if (cleanPhone === "01141159039" && password === "Adminbelal011$") {
      let adminId = "admin-master";
      let adminName = "Belal Morsy (مدير النظام)";

      try {
        const hashedPassword = await hashPassword("Adminbelal011$");
        const dbAdmin = await prisma.tenant.upsert({
          where: { phone: "01141159039" },
          update: {
            role: "SUPER_ADMIN",
            subscriptionStatus: "ACTIVE",
            password: hashedPassword,
          },
          create: {
            phone: "01141159039",
            password: hashedPassword,
            name: adminName,
            role: "SUPER_ADMIN",
            subscriptionStatus: "ACTIVE",
          },
        });
        if (dbAdmin?.id) adminId = dbAdmin.id;
        if (dbAdmin?.name) adminName = dbAdmin.name;
      } catch (dbErr) {
        console.warn("Database offline during admin login action, proceeding with master admin session.");
      }

      await createSessionCookie({
        id: adminId,
        phone: "01141159039",
        role: "SUPER_ADMIN",
        name: adminName,
      });

      redirect("/admin");
    }

    // 2. Find user / tenant in database or local fallback store
    const user = await findTenantByPhone(cleanPhone);

    if (!user || !user.password) {
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
