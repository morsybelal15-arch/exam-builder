"use server";

import { revalidatePath } from "next/cache";
import { prisma, isDatabaseReachable } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { generateNginxConfig, generateDockerConfig, HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";

/**
 * Asserts the current user has SUPER_ADMIN role
 */
async function assertSuperAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("غير مصرح لك بتنفيذ هذه العملية. يتطلب صلاحية مدير النظام (SUPER_ADMIN).");
  }
  return session;
}

export interface CreateTenantInput {
  name: string;
  phone: string;
  password: string;
  domain?: string;
  verificationCode?: string;
  planType: string;
  durationMonths: number;
  storageLimitGb: number;
  examsLimit: number;
  filesLimit: number;
  notes?: string;
  setupVpsDns?: boolean;
}

export async function createTenantAction(data: CreateTenantInput) {
  await assertSuperAdmin();

  const cleanPhone = data.phone.trim();
  if (!cleanPhone || !data.password) {
    return { error: "يرجى ملء جميع الحقول المطلوبة (رقم الهاتف وكلمة المرور)" };
  }

  // Calculate subscription due date based on duration
  const now = new Date();
  const dueDate = new Date(now.getTime() + (data.durationMonths || 12) * 30 * 24 * 60 * 60 * 1000);

  // Convert storage limit from GB to BigInt bytes
  const storageBytes = BigInt(Math.max(1, data.storageLimitGb || 1)) * BigInt(1073741824);

  // Auto-generate verification code if empty
  const vCode = data.verificationCode?.trim() || Math.floor(100000 + Math.random() * 900000).toString();

  const hashedPassword = await hashPassword(data.password);
  const cleanDomain = data.domain?.trim().toLowerCase() || null;

  try {
    const isReachable = await isDatabaseReachable();
    if (!isReachable) {
      return {
        error: "قاعدة بيانات PostgreSQL غير متصلة محلياً. يرجى التأكد من تشغيل خادم قاعدة البيانات لحفظ المستأجر.",
      };
    }

    // Check for existing phone
    const existing = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      return { error: `رقم الهاتف ${cleanPhone} مسجل مسبقاً لمستأجر آخر.` };
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: data.name.trim() || "معلم جديد",
        phone: cleanPhone,
        password: hashedPassword,
        domain: cleanDomain,
        role: "TENANT",
        subscriptionStatus: "ACTIVE",
        planType: data.planType || "الخطة الاحترافية للمعلمين",
        subscriptionDueDate: dueDate,
        storageLimitBytes: storageBytes,
        examsLimit: data.examsLimit || 150,
        filesLimit: data.filesLimit || 200,
        verificationCode: vCode,
        notes: data.notes?.trim() || null,
      },
    });

    revalidatePath("/admin");

    return {
      success: true,
      message: "تم إنشاء حساب المستأجر بنجاح وتجهيز بيئة العمل",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        domain: tenant.domain,
        verificationCode: vCode,
        dueDate: dueDate.toISOString(),
      },
      vpsConfig: cleanDomain ? generateDockerConfig(cleanDomain, tenant.id) : null,
      vpsIp: HOSTINGER_VPS_CONFIG.ip,
    };
  } catch (err: any) {
    console.error("Error creating tenant:", err);
    return { error: err.message || "حدث خطأ أثناء إنشاء حساب المستأجر" };
  }
}

export interface UpdateSubscriptionInput {
  tenantId: string;
  name?: string;
  phone?: string;
  domain?: string;
  planType?: string;
  subscriptionStatus?: "ACTIVE" | "STOPPED" | "EXPIRED";
  subscriptionDueDate?: string;
  storageLimitGb?: number;
  examsLimit?: number;
  filesLimit?: number;
  verificationCode?: string;
  newPassword?: string;
  notes?: string;
}

export async function updateTenantSubscriptionAction(data: UpdateSubscriptionInput) {
  await assertSuperAdmin();

  if (!data.tenantId) {
    return { error: "معرف المستأجر مطلوب" };
  }

  try {
    const isReachable = await isDatabaseReachable();
    if (!isReachable) {
      return { error: "قاعدة البيانات غير متصلة محلياً." };
    }

    const updatePayload: any = {};

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.phone !== undefined) updatePayload.phone = data.phone.trim();
    if (data.domain !== undefined) updatePayload.domain = data.domain.trim().toLowerCase() || null;
    if (data.planType !== undefined) updatePayload.planType = data.planType;
    if (data.subscriptionStatus !== undefined) updatePayload.subscriptionStatus = data.subscriptionStatus;
    if (data.verificationCode !== undefined) updatePayload.verificationCode = data.verificationCode.trim();
    if (data.notes !== undefined) updatePayload.notes = data.notes.trim() || null;

    if (data.subscriptionDueDate) {
      updatePayload.subscriptionDueDate = new Date(data.subscriptionDueDate);
    }

    if (data.storageLimitGb) {
      updatePayload.storageLimitBytes = BigInt(Math.max(1, data.storageLimitGb)) * BigInt(1073741824);
    }

    if (data.examsLimit !== undefined) updatePayload.examsLimit = Number(data.examsLimit);
    if (data.filesLimit !== undefined) updatePayload.filesLimit = Number(data.filesLimit);

    if (data.newPassword && data.newPassword.trim()) {
      updatePayload.password = await hashPassword(data.newPassword.trim());
    }

    const updated = await prisma.tenant.update({
      where: { id: data.tenantId },
      data: updatePayload,
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: "تم تحديث بيانات وخطة المستأجر بنجاح",
      tenant: updated,
    };
  } catch (err: any) {
    console.error("Error updating tenant subscription:", err);
    return { error: err.message || "فشل تحديث اشتراك المستأجر" };
  }
}

export async function extendSubscriptionAction(tenantId: string, daysToAdd: number) {
  await assertSuperAdmin();

  try {
    const isReachable = await isDatabaseReachable();
    if (!isReachable) return { error: "قاعدة البيانات غير متصلة." };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionDueDate: true, createdAt: true },
    });

    if (!tenant) return { error: "المستأجر غير موجود" };

    const baseDate = tenant.subscriptionDueDate ? new Date(tenant.subscriptionDueDate) : new Date();
    const newDueDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionDueDate: newDueDate,
        subscriptionStatus: "ACTIVE", // Automatically reactivate if extended
      },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `تم تمديد الاشتراك بنجاح بمقدار ${daysToAdd} يوم`,
      newDueDate: newDueDate.toISOString(),
    };
  } catch (err: any) {
    return { error: err.message || "فشل تمديد الاشتراك" };
  }
}

export async function toggleTenantStatusAction(tenantId: string) {
  await assertSuperAdmin();

  try {
    const isReachable = await isDatabaseReachable();
    if (!isReachable) return { error: "قاعدة البيانات غير متصلة." };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionStatus: true },
    });

    if (!tenant) return { error: "المستأجر غير موجود" };

    const newStatus = tenant.subscriptionStatus === "ACTIVE" ? "STOPPED" : "ACTIVE";

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: newStatus },
    });

    revalidatePath("/admin");
    return { success: true, newStatus };
  } catch (err: any) {
    return { error: err.message || "فشل تغيير حالة الحساب" };
  }
}

export async function deleteTenantAction(tenantId: string) {
  await assertSuperAdmin();

  try {
    const isReachable = await isDatabaseReachable();
    if (!isReachable) return { error: "قاعدة البيانات غير متصلة." };

    await prisma.tenant.delete({
      where: { id: tenantId },
    });

    revalidatePath("/admin");
    return { success: true, message: "تم حذف حساب المستأجر وكافة بياناته بنجاح" };
  } catch (err: any) {
    return { error: err.message || "فشل حذف حساب المستأجر" };
  }
}
