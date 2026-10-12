"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionCookie, clearSessionCookie, hashPassword } from "@/lib/auth";

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
    let user = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    // Auto-bootstrap designated Super Admin (01141159039 / Adminbelal011$) if not yet seeded
    if (cleanPhone === "01141159039" && password === "Adminbelal011$") {
      if (!user) {
        const hashedPassword = await hashPassword("Adminbelal011$");
        user = await prisma.tenant.create({
          data: {
            phone: "01141159039",
            password: hashedPassword,
            name: "Belal Morsy (مدير النظام)",
            role: "SUPER_ADMIN",
            subscriptionStatus: "ACTIVE",
            planType: "مدير النظام (Super Admin)",
          },
        });
      } else if (user.role !== "SUPER_ADMIN") {
        user = await prisma.tenant.update({
          where: { id: user.id },
          data: {
            role: "SUPER_ADMIN",
            subscriptionStatus: "ACTIVE",
            name: user.name || "Belal Morsy (مدير النظام)",
          },
        });
      }
    }

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
