import { NextRequest, NextResponse } from "next/server";
import {
  getExamRecords,
  saveExamRecord,
  deleteExamRecord,
  getExamGrades,
  saveStudentGrade,
  deleteStudentGrade,
} from "@/lib/management-db";
import { requireApiSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const examRecordId = searchParams.get("examRecordId");

    if (!groupId) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    if (examRecordId) {
      const grades = getExamGrades(examRecordId, groupId);
      return NextResponse.json({ success: true, grades });
    }

    const exams = getExamRecords(groupId);
    return NextResponse.json({ success: true, exams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const body = await req.json();
    const { action } = body;

    // Create new exam record
    if (action === "createExam") {
      const { groupId, examName, totalScore, date } = body;
      if (!groupId || !examName) {
        return NextResponse.json({ error: "اسم الاختبار والمجموعة مطلوبان" }, { status: 400 });
      }
      const exam = saveExamRecord(groupId, examName, totalScore || 20, date);
      return NextResponse.json({ success: true, exam });
    }

    // Save student grade (single or batch)
    if (action === "saveGrade") {
      const { examRecordId, studentIdOrCode, score, notes, method } = body;
      if (!examRecordId || !studentIdOrCode || score === undefined) {
        return NextResponse.json({ error: "بيانات الدرجة غير مكتملة" }, { status: 400 });
      }
      const res = saveStudentGrade(examRecordId, studentIdOrCode, score, notes, method || "manual");
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 404 });
      }
      return NextResponse.json({ ...res });
    }

    // Bulk save grades
    if (action === "bulkSaveGrades") {
      const { examRecordId, grades } = body; // array of { studentId, score }
      if (!examRecordId || !Array.isArray(grades)) {
        return NextResponse.json({ error: "بيانات الرصد الجماعي غير صحيحة" }, { status: 400 });
      }
      grades.forEach((g: any) => {
        saveStudentGrade(examRecordId, g.studentId, g.score, g.notes, g.method || "manual");
      });
      return NextResponse.json({ success: true, message: "تم حفظ درجات الطلاب بنجاح" });
    }

    // Delete single student grade
    if (action === "deleteGrade") {
      const { examRecordId, studentId } = body;
      if (!examRecordId || !studentId) {
        return NextResponse.json({ error: "بيانات الحذف غير مكتملة" }, { status: 400 });
      }
      deleteStudentGrade(examRecordId, studentId);
      return NextResponse.json({ success: true, message: "تم حذف درجة الطالب بنجاح" });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
    deleteExamRecord(id);
    return NextResponse.json({ success: true, message: "تم حذف سجل الاختبار بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
