import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import {
  getExportDataset,
  bulkImportStudents,
  getStudents,
  getGroups,
  saveGroup,
} from "@/lib/management-db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const academicYear = searchParams.get("academicYear") || "ALL";
    const groupId = searchParams.get("groupId") || "ALL";
    const studentStatus = (searchParams.get("studentStatus") as "active" | "inactive" | "all") || "active";
    const month = searchParams.get("month") || undefined;
    const paymentFilter = (searchParams.get("paymentFilter") as "all" | "paid" | "unpaid" | "overdue") || "all";

    const dataset = getExportDataset({
      academicYear,
      groupId,
      studentStatus,
      month,
      paymentFilter,
    });

    const allStudents = getStudents();

    return NextResponse.json({
      success: true,
      ...dataset,
      allStudentsCount: allStudents.length,
      existingStudentsLite: allStudents.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        groupId: s.groupId,
        groupName: s.groupName,
        academicYear: s.academicYear,
        studentPhone: s.studentPhone,
        parentPhone: s.parentPhone,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "حدث خطأ أثناء جلب بيانات التصدير" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Quick inline group creation from Import page if user needs a new group
    if (action === "quickCreateGroup") {
      const { name, teacher, academicYear, subject } = body;
      if (!name?.trim() || !academicYear?.trim()) {
        return NextResponse.json(
          { error: "يرجى إدخال اسم المجموعة والسنة الدراسية" },
          { status: 400 }
        );
      }
      const group = saveGroup({
        name: name.trim(),
        teacher: teacher?.trim() || "إدارة السنتر",
        academicYear: academicYear.trim(),
        subject: subject?.trim() || "مادة عامة",
      });
      return NextResponse.json({
        success: true,
        group,
        groups: getGroups(),
      });
    }

    // Bulk Import Students
    if (action === "bulkImport") {
      const {
        rows,
        defaultGroupId,
        defaultAcademicYear,
        defaultMonthlyFee,
        duplicateMode,
      } = body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          { error: "لا توجد بيانات طلاب صالحة للاستيراد" },
          { status: 400 }
        );
      }

      if (!defaultGroupId) {
        return NextResponse.json(
          { error: "يرجى تحديد المجموعة الدراسية المستهدفة للاستيراد" },
          { status: 400 }
        );
      }

      // Guard against oversized payloads (> 5000 rows at once)
      if (rows.length > 5000) {
        return NextResponse.json(
          { error: "الحد الأقصى للاستيراد في المرة الواحدة هو 5000 طالب" },
          { status: 400 }
        );
      }

      const result = bulkImportStudents({
        rows,
        defaultGroupId,
        defaultAcademicYear: defaultAcademicYear || "الصف الأول الثانوي",
        defaultMonthlyFee: Number(defaultMonthlyFee) || 250,
        duplicateMode: duplicateMode || "skip",
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "حدث خطأ أثناء معالجة طلب Excel" },
      { status: 500 }
    );
  }
}

