"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, hashPassword } from "@/lib/auth";
import { generateDockerConfig, HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import {
  createTenantRecord,
  findTenantByPhone,
  updateTenantRecord,
  deleteTenantRecord,
  getTenantsList,
} from "@/lib/tenants-repository";
import { syncTenantsToVps, provisionTenantDomain } from "@/lib/vps-sync";

/**
 * Asserts the current user has SUPER_ADMIN role AND this process runs in admin mode.
 * (Server actions can be invoked directly by ID, so the proxy route block alone is not enough.)
 */
async function assertSuperAdmin() {
  return requireSuperAdmin();
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

    // Push the new account to the live VPS app, then make sure the domain is routed to it
    const vpsSync = await syncTenantsToVps();
    const domainSetup = cleanDomain ? await provisionTenantDomain(cleanDomain) : null;

    revalidatePath("/admin");

    return {
      success: true,
      message: vpsSync.synced
        ? "تم إنشاء حساب المستأجر ومزامنته مع خادم VPS بنجاح"
        : "تم إنشاء حساب المستأجر محلياً (تحقق من المزامنة مع السيرفر)",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        domain: tenant.domain,
        verificationCode: vCode,
        dueDate: dueDate.toISOString(),
      },
      vpsSync,
      domainSetup,
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
    const vpsSync = await syncTenantsToVps();
    const domainSetup = updatePayload.domain ? await provisionTenantDomain(updatePayload.domain) : null;

    revalidatePath("/admin");
    return {
      success: true,
      message: vpsSync.synced
        ? "تم تحديث بيانات وخطة المستأجر ومزامنتها مع السيرفر"
        : "تم تحديث البيانات محلياً (تعذرت المزامنة مع السيرفر)",
      tenant: updated,
      vpsSync,
      domainSetup,
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

    const vpsSync = await syncTenantsToVps();

    revalidatePath("/admin");
    return {
      success: true,
      message: `تم تمديد الاشتراك بنجاح بمقدار ${daysToAdd} يوم`,
      newDueDate: newDueDate.toISOString(),
      vpsSync,
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

    const vpsSync = await syncTenantsToVps();

    revalidatePath("/admin");
    return { success: true, newStatus, vpsSync };
  } catch (err: any) {
    return { error: err.message || "فشل تغيير حالة الحساب" };
  }
}

export async function deleteTenantAction(tenantId: string) {
  await assertSuperAdmin();

  try {
    await deleteTenantRecord(tenantId);
    const vpsSync = await syncTenantsToVps();
    revalidatePath("/admin");
    return { success: true, message: "تم حذف حساب المستأجر وكافة بياناته بنجاح", vpsSync };
  } catch (err: any) {
    return { error: err.message || "فشل حذف حساب المستأجر" };
  }
}
