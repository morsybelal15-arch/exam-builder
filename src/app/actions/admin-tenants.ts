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
import {
  SubscriptionCategory,
  normalizeEnabledFeatures,
  getDefaultFeaturesForCategory,
} from "@/lib/app-features";

/**
 * Asserts the current user has SUPER_ADMIN role AND this process runs in admin mode.
 */
async function assertSuperAdmin() {
  return requireSuperAdmin();
}

export interface CreateTenantInput {
  name: string;
  phone: string;
  password: string;
  domain?: string;
  subscriptionType: SubscriptionCategory;
  subscriptionStartDate?: string;
  subscriptionDueDate?: string;
  durationMonths?: number;
  enabledFeatures: string[];
  planType?: string;
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

  const subscriptionType: SubscriptionCategory =
    data.subscriptionType === "معلم" ? "معلم" : "سنتر";

  const startDate = data.subscriptionStartDate
    ? new Date(data.subscriptionStartDate)
    : new Date();
  startDate.setHours(0, 0, 0, 0);

  let dueDate: Date;
  if (data.subscriptionDueDate) {
    dueDate = new Date(data.subscriptionDueDate);
    dueDate.setHours(23, 59, 59, 999);
  } else {
    const durationMonths = Number(data.durationMonths) || 12;
    dueDate = new Date(startDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
    dueDate.setHours(23, 59, 59, 999);
  }

  if (dueDate.getTime() < startDate.getTime()) {
    return { error: "تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ بداية الاشتراك." };
  }

  const enabledFeatures = normalizeEnabledFeatures(
    data.enabledFeatures && data.enabledFeatures.length > 0
      ? data.enabledFeatures
      : getDefaultFeaturesForCategory(subscriptionType)
  );

  // Convert storage limit from GB to bytes
  const storageLimitGb = Math.max(1, Number(data.storageLimitGb) || 1);
  const storageBytes = BigInt(storageLimitGb) * BigInt(1073741824);

  const hashedPassword = await hashPassword(data.password);
  const cleanDomain =
    data.domain
      ?.trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "") || null;

  const computedPlanType =
    data.planType?.trim() ||
    (subscriptionType === "سنتر" ? "باقة إدارة السنتر المتكاملة" : "باقة المعلم الذكي");

  try {
    // Check for existing phone
    const existing = await findTenantByPhone(cleanPhone);
    if (existing) {
      return { error: `رقم الهاتف ${cleanPhone} مسجل مسبقاً لعميل آخر.` };
    }

    const tenant = await createTenantRecord({
      name: data.name.trim() || (subscriptionType === "سنتر" ? "سنتر تعليمي" : "معلم جديد"),
      phone: cleanPhone,
      password: hashedPassword,
      domain: cleanDomain,
      role: "TENANT",
      subscriptionStatus: "ACTIVE",
      planType: computedPlanType,
      subscriptionType,
      subscriptionStartDate: startDate,
      subscriptionDueDate: dueDate,
      enabledFeatures,
      storageLimitBytes: storageBytes,
      examsLimit: Number(data.examsLimit) || 150,
      filesLimit: Number(data.filesLimit) || 200,
      notes: data.notes?.trim() || null,
    });

    // Automatically push the new account & isolated DB structure to the live VPS app and provision its domain
    const vpsSync = await syncTenantsToVps({ force: true });
    const domainSetup = cleanDomain ? await provisionTenantDomain(cleanDomain) : null;

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/my-subscription");

    return {
      success: true,
      message: vpsSync.synced
        ? "تم تسطيب التطبيق وبناء قاعدة البيانات ومزامنة المميزات على السيرفر بنجاح"
        : "تم تسطيب التطبيق وبناء قاعدة البيانات محلياً بنجاح",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        domain: tenant.domain,
        subscriptionType: tenant.subscriptionType,
        startDate: startDate.toISOString(),
        dueDate: dueDate.toISOString(),
        enabledFeatures: tenant.enabledFeatures,
      },
      vpsSync,
      domainSetup,
      vpsConfig: cleanDomain ? generateDockerConfig(cleanDomain, tenant.id) : null,
      vpsIp: HOSTINGER_VPS_CONFIG.ip,
    };
  } catch (err: any) {
    console.error("Error creating tenant:", err);
    return { error: err.message || "حدث خطأ أثناء إنشاء حساب العميل" };
  }
}

export interface UpdateSubscriptionInput {
  tenantId: string;
  name?: string;
  phone?: string;
  domain?: string;
  planType?: string;
  subscriptionType?: SubscriptionCategory;
  subscriptionStatus?: "ACTIVE" | "STOPPED" | "EXPIRED";
  subscriptionStartDate?: string;
  subscriptionDueDate?: string;
  enabledFeatures?: string[];
  storageLimitGb?: number;
  examsLimit?: number;
  filesLimit?: number;
  newPassword?: string;
  notes?: string;
}

export async function updateTenantSubscriptionAction(data: UpdateSubscriptionInput) {
  await assertSuperAdmin();

  if (!data.tenantId) {
    return { error: "معرف العميل مطلوب" };
  }

  try {
    const updatePayload: any = {};

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.phone !== undefined) updatePayload.phone = data.phone.trim();
    if (data.domain !== undefined) {
      updatePayload.domain =
        data.domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "") || null;
    }
    if (data.subscriptionType !== undefined) {
      updatePayload.subscriptionType = data.subscriptionType;
      if (!data.planType) {
        updatePayload.planType =
          data.subscriptionType === "سنتر" ? "باقة إدارة السنتر المتكاملة" : "باقة المعلم الذكي";
      }
    }
    if (data.planType !== undefined) updatePayload.planType = data.planType;
    if (data.subscriptionStatus !== undefined)
      updatePayload.subscriptionStatus = data.subscriptionStatus;
    if (data.notes !== undefined) updatePayload.notes = data.notes.trim() || null;

    if (data.subscriptionStartDate) {
      const start = new Date(data.subscriptionStartDate);
      start.setHours(0, 0, 0, 0);
      updatePayload.subscriptionStartDate = start;
    }

    if (data.subscriptionDueDate) {
      const due = new Date(data.subscriptionDueDate);
      due.setHours(23, 59, 59, 999);
      updatePayload.subscriptionDueDate = due;
    }

    if (
      updatePayload.subscriptionStartDate &&
      updatePayload.subscriptionDueDate &&
      updatePayload.subscriptionDueDate.getTime() < updatePayload.subscriptionStartDate.getTime()
    ) {
      return { error: "تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ بداية الاشتراك." };
    }

    if (data.enabledFeatures !== undefined) {
      if (data.enabledFeatures.length === 0) {
        return { error: "يرجى اختيار ميزة واحدة على الأقل لتشغيل التطبيق." };
      }
      updatePayload.enabledFeatures = normalizeEnabledFeatures(data.enabledFeatures);
    }

    if (data.storageLimitGb) {
      updatePayload.storageLimitBytes =
        BigInt(Math.max(1, data.storageLimitGb)) * BigInt(1073741824);
    }

    if (data.examsLimit !== undefined) updatePayload.examsLimit = Number(data.examsLimit);
    if (data.filesLimit !== undefined) updatePayload.filesLimit = Number(data.filesLimit);

    if (data.newPassword && data.newPassword.trim()) {
      updatePayload.password = await hashPassword(data.newPassword.trim());
    }

    const updated = await updateTenantRecord(data.tenantId, updatePayload);
    const vpsSync = await syncTenantsToVps({ force: true });
    const domainSetup = updatePayload.domain
      ? await provisionTenantDomain(updatePayload.domain)
      : null;

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/my-subscription");

    return {
      success: true,
      message: vpsSync.synced
        ? "تم تحديث بيانات الاشتراك والمميزات ومزامنتها فورياً مع تطبيق العميل والسيرفر ✓"
        : "تم تحديث بيانات الاشتراك والمميزات محلياً وفورياً في تطبيق العميل ✓",
      tenant: updated,
      vpsSync,
      domainSetup,
    };
  } catch (err: any) {
    console.error("Error updating tenant subscription:", err);
    return { error: err.message || "فشل تحديث اشتراك العميل" };
  }
}

export async function extendSubscriptionAction(tenantId: string, daysToAdd: number) {
  await assertSuperAdmin();

  try {
    const all = await getTenantsList();
    const tenant = all.find((t) => t.id === tenantId);

    if (!tenant) return { error: "العميل غير موجود" };

    const baseDate = tenant.subscriptionDueDate ? new Date(tenant.subscriptionDueDate) : new Date();
    const newDueDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    newDueDate.setHours(23, 59, 59, 999);

    await updateTenantRecord(tenantId, {
      subscriptionDueDate: newDueDate,
      subscriptionStatus: "ACTIVE", // Automatically reactivate if extended
    });

    const vpsSync = await syncTenantsToVps({ force: true });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/my-subscription");

    return {
      success: true,
      message: `تم تمديد الاشتراك بنجاح بمقدار ${daysToAdd} يوم وتنشيط الحساب`,
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

    if (!tenant) return { error: "العميل غير موجود" };

    const newStatus = tenant.subscriptionStatus === "ACTIVE" ? "STOPPED" : "ACTIVE";

    await updateTenantRecord(tenantId, {
      subscriptionStatus: newStatus,
    });

    const vpsSync = await syncTenantsToVps({ force: true });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/my-subscription");

    return { success: true, newStatus, vpsSync };
  } catch (err: any) {
    return { error: err.message || "فشل تغيير حالة الحساب" };
  }
}

export async function deleteTenantAction(tenantId: string) {
  await assertSuperAdmin();

  try {
    await deleteTenantRecord(tenantId);
    const vpsSync = await syncTenantsToVps({ force: true });
    revalidatePath("/admin");
    return { success: true, message: "تم حذف حساب العميل وكافة بياناته بنجاح", vpsSync };
  } catch (err: any) {
    return { error: err.message || "فشل حذف حساب العميل" };
  }
}
