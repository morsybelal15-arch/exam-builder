import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { purgeTenantLocalDb } from "@/lib/db";
import { resetTenantManagementStore } from "@/lib/management-db";
import { updateTenantRecord } from "@/lib/tenants-repository";
import { prisma, isDatabaseReachable } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await requireApiSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    // 1. Wipe SQLite/JSON exams, uploaded_files, and local upload directory for this tenant
    purgeTenantLocalDb(session.id);

    // 2. Reset management_store.json (students, groups, financials, attendance, QR, exam records) to empty arrays
    resetTenantManagementStore(session.id);

    // 3. Wipe PostgreSQL exams & uploadedFiles if connected
    try {
      const reachable = await isDatabaseReachable();
      if (reachable) {
        await Promise.all([
          prisma.exam.deleteMany({ where: { tenantId: session.id } }),
          prisma.uploadedFile.deleteMany({ where: { tenantId: session.id } }),
        ]);
      }
    } catch {
      // Non-fatal
    }

    // 4. Reset usedStorageBytes on tenant record to 0
    await updateTenantRecord(session.id, { usedStorageBytes: 0 });

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

