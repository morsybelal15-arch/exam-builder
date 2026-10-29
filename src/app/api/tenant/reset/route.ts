import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { purgeTenantLocalDb } from "@/lib/db";
import { resetTenantManagementStore } from "@/lib/management-db";
import { findTenantByDomain, updateTenantRecord } from "@/lib/tenants-repository";
import { prisma, isDatabaseReachable } from "@/lib/prisma";
import { setCurrentTenantId } from "@/lib/tenant-context";

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const host = (req.headers.get("host") || "").split(":")[0].trim().toLowerCase();
    const domainTenant = host ? await findTenantByDomain(host) : null;
    const allowedDomainId =
      domainTenant?.id && (session.role === "SUPER_ADMIN" || domainTenant.id === session.id)
        ? domainTenant.id
        : null;
    const targetIds = Array.from(
      new Set([session.id, allowedDomainId].filter((id): id is string => Boolean(id)))
    );

    for (const tid of targetIds) {
      setCurrentTenantId(tid);
      // 1. Wipe SQLite/JSON exams, uploaded_files, and local upload directory for this tenant
      purgeTenantLocalDb(tid);
      // 2. Reset management_store.json (students, groups, financials, attendance, QR, exam records) to empty arrays
      resetTenantManagementStore(tid);
      // 3. Reset usedStorageBytes on tenant record to 0
      await updateTenantRecord(tid, { usedStorageBytes: 0 });
    }

    // Only Super Admin resets the fallback "default" store
    if (session.role === "SUPER_ADMIN") {
      resetTenantManagementStore("default");
    }

    // 4. Wipe PostgreSQL exams & uploadedFiles if connected
    try {
      const reachable = await isDatabaseReachable();
      if (reachable) {
        for (const tid of targetIds) {
          await Promise.all([
            prisma.exam.deleteMany({ where: { tenantId: tid } }),
            prisma.uploadedFile.deleteMany({ where: { tenantId: tid } }),
          ]);
        }
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      message: "تمت إعادة ضبط المصنع وتصفير جميع بيانات النظام بنجاح.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "حدث خطأ أثناء إعادة ضبط المصنع" },
      { status: 500 }
    );
  }
}
