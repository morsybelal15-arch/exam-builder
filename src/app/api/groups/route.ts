import { NextRequest, NextResponse } from "next/server";
import { getGroups, getGroupById, saveGroup, deleteGroup } from "@/lib/management-db";
import { requireApiSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
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
    const body = await req.json();
    const { name, teacher, academicYear, subject, id } = body;
    if (!name || !teacher || !academicYear || !subject) {
      return NextResponse.json(
        { error: "جميع الحقول الأربعة مطلوبة (الاسم، المعلم، السنة الدراسية، المادة)" },
        { status: 400 }
      );
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing group ID" }, { status: 400 });
    deleteGroup(id);
    return NextResponse.json({ success: true, message: "تم حذف المجموعة بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
