import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { getHomeAnalytics, AnalyticsFilterMode } from "@/lib/management-db";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const modeParam = searchParams.get("mode") as AnalyticsFilterMode | null;
    const mode: AnalyticsFilterMode =
      modeParam === "year" || modeParam === "custom" ? modeParam : "month";
    const month = searchParams.get("month") || undefined;
    const year = searchParams.get("year") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const targetDate = searchParams.get("targetDate") || undefined;

    const analytics = getHomeAnalytics(targetDate, month, {
      mode,
      month,
      year,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (err) {
    console.error("Failed to fetch home analytics:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحميل إحصائيات الرئيسية" },
      { status: 500 }
    );
  }
}

