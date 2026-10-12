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

    // Query user / tenant from PostgreSQL
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
