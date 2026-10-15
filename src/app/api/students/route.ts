import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  getStudentById,
  saveStudent,
  deleteStudent,
  bulkUpdateStudents,
  transferStudents,
  getFullStudentProfile,
} from "@/lib/management-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const groupId = searchParams.get("groupId") || undefined;
    const profile = searchParams.get("profile");

    if (id && profile === "true") {
      const fullProfile = getFullStudentProfile(id);
      if (!fullProfile) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      return NextResponse.json({ success: true, profile: fullProfile });
    }

    if (id) {
      const student = getStudentById(id);
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      return NextResponse.json({ success: true, student });
    }

    const students = getStudents(groupId);
    return NextResponse.json({ success: true, students });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Bulk transfer
    if (action === "transfer") {
      const { studentIds, targetGroupId } = body;
      if (!Array.isArray(studentIds) || !targetGroupId) {
        return NextResponse.json({ error: "Invalid transfer parameters" }, { status: 400 });
      }
      transferStudents(studentIds, targetGroupId);
      return NextResponse.json({ success: true, message: "تم نقل الطلاب بنجاح" });
    }

    // Bulk update status (activate / deactivate)
    if (action === "bulkUpdate") {
      const { studentIds, updates } = body;
      if (!Array.isArray(studentIds) || !updates) {
        return NextResponse.json({ error: "Invalid bulk parameters" }, { status: 400 });
      }
      bulkUpdateStudents(studentIds, updates);
      return NextResponse.json({ success: true, message: "تم تحديث بيانات الطلاب بنجاح" });
    }

    // Bulk delete
    if (action === "bulkDelete") {
      const { studentIds } = body;
      if (Array.isArray(studentIds)) {
        studentIds.forEach((id: string) => deleteStudent(id));
      }
      return NextResponse.json({ success: true, message: "تم حذف الطلاب المحددين" });
    }

    // Single student create / update
    const { name, groupId } = body;
    if (!name || !groupId) {
      return NextResponse.json({ error: "اسم الطالب والمجموعة مطلوبان" }, { status: 400 });
    }

    const student = saveStudent(body);
    return NextResponse.json({ success: true, student });
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
    if (!id) return NextResponse.json({ error: "Missing student ID" }, { status: 400 });
    deleteStudent(id);
    return NextResponse.json({ success: true, message: "تم حذف الطالب بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
