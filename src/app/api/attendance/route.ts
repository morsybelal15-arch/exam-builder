import { NextRequest, NextResponse } from "next/server";
import {
  getAttendance,
  getGroupSessions,
  markAttendance,
  bulkMarkAttendance,
  createClassSession,
} from "@/lib/management-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const date = searchParams.get("date");
    const month = searchParams.get("month"); // e.g. "2026-10"

    if (!groupId) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    // Return sessions for the month (for colored calendar days)
    if (month && !date) {
      const sessions = getGroupSessions(groupId, month);
      return NextResponse.json({ success: true, sessions });
    }

    // Return attendance list for a specific date
    const targetDate = date || new Date().toISOString().split("T")[0];
    const attendance = getAttendance(groupId, targetDate);
    const sessions = getGroupSessions(groupId, targetDate.substring(0, 7));

    return NextResponse.json({
      success: true,
      attendance,
      date: targetDate,
      sessions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Create session / class day
    if (action === "createSession") {
      const { groupId, date, title } = body;
      if (!groupId || !date) {
        return NextResponse.json({ error: "Missing groupId or date" }, { status: 400 });
      }
      const session = createClassSession(groupId, date, title);
      return NextResponse.json({ success: true, session });
    }

    // Bulk mark
    if (action === "bulk") {
      const { studentIds, groupId, date, status } = body;
      if (!Array.isArray(studentIds) || !groupId || !date || !status) {
        return NextResponse.json({ error: "معاملات التسجيل الجماعي غير مكتملة" }, { status: 400 });
      }
      bulkMarkAttendance(studentIds, groupId, date, status);
      return NextResponse.json({ success: true, message: "تم تسجيل الحضور/الغياب للطلاب بنجاح" });
    }

    // Single / Camera QR check-in
    const { studentIdOrCode, groupId, date, status, method } = body;
    if (!studentIdOrCode) {
      return NextResponse.json({ error: "معرف الطالب أو رمز QR مطلوب" }, { status: 400 });
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const targetStatus = status || "attended";
    const res = markAttendance(studentIdOrCode, groupId, targetDate, targetStatus, method || "manual");

    if (!res.success) {
      return NextResponse.json({ error: res.error || "فشل تسجيل الحضور" }, { status: 404 });
    }

    return NextResponse.json({ ...res });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
