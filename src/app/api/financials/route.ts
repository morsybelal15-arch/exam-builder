import { NextRequest, NextResponse } from "next/server";
import { getFinancials, updateFinancial, bulkUpdateFinancials, deleteFinancialRecord } from "@/lib/management-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const month = searchParams.get("month") || new Date().toISOString().substring(0, 7);

    if (!groupId) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    const financials = getFinancials(groupId, month);
    return NextResponse.json({ success: true, financials, month });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Delete financial record
    if (action === "delete") {
      const { studentId, groupId, month } = body;
      if (!studentId || !groupId || !month) {
        return NextResponse.json({ error: "بيانات الحذف غير مكتملة" }, { status: 400 });
      }
      deleteFinancialRecord(groupId, studentId, month);
      return NextResponse.json({ success: true, message: "تم حذف السجل المالي بنجاح" });
    }

    // Bulk update
    if (action === "bulk") {
      const { studentIds, groupId, month, status, partialPaidAmount } = body;
      if (!Array.isArray(studentIds) || !groupId || !month || !status) {
        return NextResponse.json({ error: "معاملات التعديل الجماعي غير مكتملة" }, { status: 400 });
      }
      bulkUpdateFinancials(studentIds, groupId, month, status, partialPaidAmount);
      return NextResponse.json({ success: true, message: "تم تحديث الحالات المالية للطلاب بنجاح" });
    }

    // Single update
    const { studentId, groupId, month, status, paidAmount, totalAmount, notes } = body;
    if (!studentId || !groupId || !month || !status) {
      return NextResponse.json({ error: "بيانات السجل المالي غير مكتملة" }, { status: 400 });
    }

    const record = updateFinancial({
      studentId,
      groupId,
      month,
      status,
      paidAmount: Number(paidAmount) || 0,
      totalAmount: totalAmount ? Number(totalAmount) : undefined,
      notes,
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
