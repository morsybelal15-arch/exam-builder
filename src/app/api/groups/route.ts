import { NextRequest, NextResponse } from "next/server";
import { getGroups, getGroupById, saveGroup, deleteGroup } from "@/lib/management-db";

export async function GET(req: NextRequest) {
  try {
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing group ID" }, { status: 400 });
    deleteGroup(id);
    return NextResponse.json({ success: true, message: "تم حذف المجموعة بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
