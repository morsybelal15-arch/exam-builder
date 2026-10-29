import { NextRequest, NextResponse } from "next/server";
import { getSavedQrPdfs, saveQrPdf, deleteSavedQrPdf } from "@/lib/management-db";
import { requireApiSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const sheets = getSavedQrPdfs();
    return NextResponse.json({ success: true, sheets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const body = await req.json();
    const { title, groupName, studentIds, pagesCount } = body;
    if (!title || !Array.isArray(studentIds)) {
      return NextResponse.json({ error: "اسم المستند وقائمة الطلاب مطلوبة" }, { status: 400 });
    }
    const pdf = saveQrPdf(title, groupName || "عام", studentIds, pagesCount || 1);
    return NextResponse.json({ success: true, pdf });
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
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    deleteSavedQrPdf(id);
    return NextResponse.json({ success: true, message: "تم حذف المستند بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
