"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { generateNginxConfig, generateDockerConfig, HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import {
  createTenantRecord,
  findTenantByPhone,
  updateTenantRecord,
  deleteTenantRecord,
  getTenantsList,
} from "@/lib/tenants-repository";

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
  const durationMonths = Number(data.durationMonths) || 12;
  const dueDate = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

  // Convert storage limit from GB to bytes
  const storageLimitGb = Math.max(1, Number(data.storageLimitGb) || 1);
  const storageBytes = BigInt(storageLimitGb) * BigInt(1073741824);

  // Auto-generate verification code if empty
  const vCode = data.verificationCode?.trim() || Math.floor(100000 + Math.random() * 900000).toString();

  const hashedPassword = await hashPassword(data.password);
  const cleanDomain = data.domain?.trim().toLowerCase() || null;

  try {
    // Check for existing phone
    const existing = await findTenantByPhone(cleanPhone);
    if (existing) {
      return { error: `رقم الهاتف ${cleanPhone} مسجل مسبقاً لمستأجر آخر.` };
    }

    const tenant = await createTenantRecord({
      name: data.name.trim() || "معلم جديد",
      phone: cleanPhone,
      password: hashedPassword,
      domain: cleanDomain,
      role: "TENANT",
      subscriptionStatus: "ACTIVE",
      planType: data.planType || "الخطة الاحترافية للمعلمين",
      subscriptionDueDate: dueDate,
      storageLimitBytes: storageBytes,
      examsLimit: Number(data.examsLimit) || 150,
      filesLimit: Number(data.filesLimit) || 200,
      verificationCode: vCode,
      notes: data.notes?.trim() || null,
    });

    revalidatePath("/admin");

    return {
      success: true,
      message: "تم إنشاء حساب المستأجر بنجاح وتجهيز بيئة العمل على السيرفر",
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

    const updated = await updateTenantRecord(data.tenantId, updatePayload);

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
    const all = await getTenantsList();
    const tenant = all.find((t) => t.id === tenantId);

    if (!tenant) return { error: "المستأجر غير موجود" };

    const baseDate = tenant.subscriptionDueDate ? new Date(tenant.subscriptionDueDate) : new Date();
    const newDueDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    await updateTenantRecord(tenantId, {
      subscriptionDueDate: newDueDate,
      subscriptionStatus: "ACTIVE", // Automatically reactivate if extended
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
    const all = await getTenantsList();
    const tenant = all.find((t) => t.id === tenantId);

    if (!tenant) return { error: "المستأجر غير موجود" };

    const newStatus = tenant.subscriptionStatus === "ACTIVE" ? "STOPPED" : "ACTIVE";

    await updateTenantRecord(tenantId, {
      subscriptionStatus: newStatus,
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
    await deleteTenantRecord(tenantId);
    revalidatePath("/admin");
    return { success: true, message: "تم حذف حساب المستأجر وكافة بياناته بنجاح" };
  } catch (err: any) {
    return { error: err.message || "فشل حذف حساب المستأجر" };
  }
}
