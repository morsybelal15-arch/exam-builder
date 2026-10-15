import { NextRequest, NextResponse } from "next/server";
import { getStudentForPayment, recordFastPayment } from "@/lib/management-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const month = searchParams.get("month") || new Date().toISOString().substring(0, 7);

    if (!code) {
      return NextResponse.json({ error: "رمز أو كود الطالب مطلوب" }, { status: 400 });
    }

    const data = getStudentForPayment(code, month);
    if (!data) {
      return NextResponse.json({ error: "لم يتم العثور على طالب بهذا الكود" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentIdOrCode, month, status, paidAmount, notes } = body;

    if (!studentIdOrCode) {
      return NextResponse.json({ error: "رمز الطالب مطلوب" }, { status: 400 });
    }

    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const res = recordFastPayment(
      studentIdOrCode,
      targetMonth,
      status || "paid",
      paidAmount !== undefined ? Number(paidAmount) : undefined,
      notes
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error || "فشل تسجيل المصروفات" }, { status: 400 });
    }

    return NextResponse.json({ ...res });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
