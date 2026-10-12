import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionCookie, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { error: "يرجى إدخال رقم الهاتف وكلمة المرور" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();

    // 1. Designated Super Admin master verification (works even if DB is offline)
    if (cleanPhone === "01141159039" && password === "Adminbelal011$") {
      let adminId = "admin-master";
      let adminName = "Belal Morsy (مدير النظام)";

      // Attempt to sync / upsert in PostgreSQL if available
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
        console.warn("Database offline during admin login, proceeding with master admin session.");
      }

      await createSessionCookie({
        id: adminId,
        phone: "01141159039",
        role: "SUPER_ADMIN",
        name: adminName,
      });

      return NextResponse.json({
        success: true,
        message: "تم تسجيل الدخول بنجاح كمدير للنظام",
        role: "SUPER_ADMIN",
        redirectUrl: "/admin",
      });
    }

    // 2. Query user / tenant from PostgreSQL for general tenants
    const user = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      return NextResponse.json(
        { error: "بيانات تسجيل الدخول غير صحيحة" },
        { status: 401 }
      );
    }

    // Verify Password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "بيانات تسجيل الدخول غير صحيحة" },
        { status: 401 }
      );
    }

    // Check subscription status for tenants
    if (user.role === "TENANT" && user.subscriptionStatus === "STOPPED") {
      return NextResponse.json(
        { error: "حسابك متوقف حالياً. يرجى التواصل مع الإدارة لتجديد الاشتراك." },
        { status: 403 }
      );
    }

    // Establish authenticated session cookie
    await createSessionCookie({
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    });

    // Server-side Role Detection & Dynamic Routing:
    // If SUPER_ADMIN -> redirect to /admin
    // If TENANT -> redirect to standard app dashboard (/exam-builder)
    let redirectUrl = "/exam-builder";
    if (user.role === "SUPER_ADMIN") {
      redirectUrl = "/admin";
    } else {
      redirectUrl = "/exam-builder";
    }

    return NextResponse.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      role: user.role,
      redirectUrl,
    });
  } catch (error: any) {
    console.error("Login authentication error:", error);
    if (error?.code === "ECONNREFUSED" || error?.message?.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: "تعذر الاتصال بقاعدة البيانات PostgreSQL. يرجى التأكد من تشغيل خادم قاعدة البيانات (PostgreSQL)." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
