import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const secret = searchParams.get("secret");

    // Optional admin security secret check
    const adminSecret = process.env.ADMIN_BOOTSTRAP_SECRET || "upgrade-super-admin-secret-2026";
    if (secret && secret !== adminSecret) {
      return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required. Usage: /api/admin/upgrade-role?phone=01xxxxxxxxx" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();

    // Check if user already exists
    const existing = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      const updated = await prisma.tenant.update({
        where: { phone: cleanPhone },
        data: { role: "SUPER_ADMIN" },
      });
      return NextResponse.json({
        success: true,
        message: `تم ترقية المستخدم ذو رقم الهاتف ${cleanPhone} إلى SUPER_ADMIN بنجاح.`,
        tenant: {
          id: updated.id,
          phone: updated.phone,
          role: updated.role,
        },
      });
    }

    // If user does not exist yet, create them directly as SUPER_ADMIN
    const created = await prisma.tenant.create({
      data: {
        phone: cleanPhone,
        password: "admin_temp_password_change_me", // In production, hash with bcrypt
        name: "Super Admin",
        role: "SUPER_ADMIN",
        subscriptionStatus: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم إنشاء حساب Super Admin جديد برقم الهاتف ${cleanPhone} بنجاح.`,
      tenant: {
        id: created.id,
        phone: created.phone,
        role: created.role,
      },
    });
  } catch (error: any) {
    console.error("Upgrade Super Admin error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upgrade user role" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, secret } = body;

    const adminSecret = process.env.ADMIN_BOOTSTRAP_SECRET || "upgrade-super-admin-secret-2026";
    if (secret && secret !== adminSecret) {
      return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
    }

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    const existing = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      const updated = await prisma.tenant.update({
        where: { phone: cleanPhone },
        data: { role: "SUPER_ADMIN" },
      });
      return NextResponse.json({
        success: true,
        message: `تم ترقية المستخدم ذو رقم الهاتف ${cleanPhone} إلى SUPER_ADMIN بنجاح.`,
        tenant: {
          id: updated.id,
          phone: updated.phone,
          role: updated.role,
        },
      });
    }

    const created = await prisma.tenant.create({
      data: {
        phone: cleanPhone,
        password: "admin_temp_password_change_me",
        name: "Super Admin",
        role: "SUPER_ADMIN",
        subscriptionStatus: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم إنشاء حساب Super Admin جديد برقم الهاتف ${cleanPhone} بنجاح.`,
      tenant: {
        id: created.id,
        phone: created.phone,
        role: created.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to upgrade user role" },
      { status: 500 }
    );
  }
}
