import { NextRequest, NextResponse } from "next/server";
import { getGroups, getGroupById, saveGroup, deleteGroup } from "@/lib/management-db";
import { requireApiSession } from "@/lib/auth";
import { setCurrentTenantId } from "@/lib/tenant-context";
import { findTenantById, findTenantByPhone } from "@/lib/tenants-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    setCurrentTenantId(session.id);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const group = getGroupById(id);
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      return NextResponse.json({ success: true, group });
    }
    const groups = getGroups();
    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    setCurrentTenantId(session.id);
    const body = await req.json();
    setCurrentTenantId(session.id);
    const { name, teacher, academicYear, subject, id } = body;
    if (!name || !teacher || !academicYear || !subject) {
      return NextResponse.json(
        { error: "جميع الحقول الأربعة مطلوبة (الاسم، المعلم، السنة الدراسية، المادة)" },
        { status: 400 }
      );
    }

    const currentGroups = getGroups();
    const isUpdatingExisting = Boolean(id && currentGroups.some((g) => g.id === id));
    if (!isUpdatingExisting && session.role !== "SUPER_ADMIN") {
      const tenant =
        (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));
      const isTrial = Boolean(tenant?.isTrial || tenant?.subscriptionType === "تجربة مجانية");
      const maxGroups = Number(tenant?.maxGroups || (isTrial ? 2 : 0));
      if (maxGroups > 0 && currentGroups.length >= maxGroups) {
        return NextResponse.json(
          {
            error: `لقد وصلت للحد الأقصى لإنشاء المجموعات في النسخة المجانية (${maxGroups} مجموعات كحد أقصى). يرجى ترقية اشتراكك لإضافة عدد غير محدود من المجموعات.`,
            limitReached: true,
          },
          { status: 403 }
        );
      }
    }

    const group = saveGroup({ id, name, teacher, academicYear, subject });
    return NextResponse.json({ success: true, group });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    setCurrentTenantId(session.id);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing group ID" }, { status: 400 });
    deleteGroup(id);
    return NextResponse.json({ success: true, message: "تم حذف المجموعة بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
