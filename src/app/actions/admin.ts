"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function toggleTenantStatusAction(tenantId: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("غير مصرح لك بتنفيذ هذا الإجراء (يتطلب صلاحية مدير النظام)");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionStatus: true },
  });

  if (!tenant) {
    throw new Error("المعلم / المستأجر غير موجود");
  }

  const newStatus = tenant.subscriptionStatus === "ACTIVE" ? "STOPPED" : "ACTIVE";

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: newStatus },
  });

  revalidatePath("/admin");
  return { success: true, newStatus };
}
