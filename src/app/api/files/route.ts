import { NextRequest, NextResponse } from "next/server";
import { getLocalUploadedFiles, addLocalUploadedFile, deleteLocalUploadedFile } from "@/lib/db";

export async function GET() {
  try {
    const files = getLocalUploadedFiles();
    return NextResponse.json({ success: true, files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, type, size, date, filepath } = body;

    addLocalUploadedFile({
      id: id || `f-${Date.now()}`,
      name: name || "ملف_جديد.pdf",
      type: type || "pdf",
      size: size || "1.0 ميجابايت",
      date: date || "اليوم",
      filepath: filepath || "",
    });

    return NextResponse.json({ success: true, message: "تم تسجيل الملف في قاعدة البيانات المحلية." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }
    deleteLocalUploadedFile(id);
    return NextResponse.json({ success: true, message: "تم حذف الملف من قاعدة البيانات." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
