"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { AttendanceRecord, GroupClassSession } from "@/lib/types/management";

interface AttendanceCalendarClientProps {
  attendance: AttendanceRecord[];
  sessions: GroupClassSession[];
}

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function AttendanceCalendarClient({
  attendance,
  sessions,
}: AttendanceCalendarClientProps) {
  // Current view month (default to latest session or current date)
  const [currentDate, setCurrentDate] = useState(() => {
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      const parts = sorted[0].date.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, 1);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Filter sessions and attendance for this month
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthSessions = useMemo(() => {
    return sessions.filter((s) => s.date.startsWith(monthKey));
  }, [sessions, monthKey]);

  const monthAttendance = useMemo(() => {
    return attendance.filter((a) => a.date.startsWith(monthKey));
  }, [attendance, monthKey]);

  // Map by date (YYYY-MM-DD)
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    monthAttendance.forEach((a) => map.set(a.date, a));
    return map;
  }, [monthAttendance]);

  const sessionDatesSet = useMemo(() => {
    return new Set(monthSessions.map((s) => s.date));
  }, [monthSessions]);

  // Monthly stats
  const attendedCount = monthAttendance.filter((a) => a.status === "attended").length;
  const absentCount = monthAttendance.filter((a) => a.status === "absent").length;

  // Calendar days grid calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // In Arabic RTL calendar starting on Saturday:
    // JS getDay(): 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    // We want Saturday to be index 0
    const startDayOfWeek = (firstDayOfMonth.getDay() + 1) % 7;

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isSession: boolean;
      record?: AttendanceRecord;
    } | null> = [];

    // Leading empty slots
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isSession = sessionDatesSet.has(dateStr) || attendanceMap.has(dateStr);
      const record = attendanceMap.get(dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isSession,
        record,
      });
    }

    return days;
  }, [year, month, sessionDatesSet, attendanceMap]);

  // Last 5 recorded sessions across all dates
  const last5Records = useMemo(() => {
    return [...attendance]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [attendance]);

  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6">
      {/* Calendar Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80">
        {/* Month Selector & Controls */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {ARABIC_MONTHS[month]} {year}
              </h3>
              <p className="text-xs text-slate-500 font-medium">سجل الحضور والغياب الشهري</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all cursor-pointer"
              title="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all cursor-pointer"
              title="الشهر التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Month Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold text-xs mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>أيام الحضور</span>
            </div>
            <span className="text-xl font-black text-emerald-800 font-mono">{attendedCount}</span>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/70 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-rose-700 font-bold text-xs mb-1">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>أيام الغياب</span>
            </div>
            <span className="text-xl font-black text-rose-800 font-mono">{absentCount}</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200/70 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-600 font-bold text-xs mb-1">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>إجمالي الحصص</span>
            </div>
            <span className="text-xl font-black text-slate-900 font-mono">{monthSessions.length}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-xs font-bold text-slate-600 mb-4 bg-slate-50/80 py-2.5 px-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs" />
            <span>حاضر (حصة مؤكدة)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-xs" />
            <span>غائب (لم يحضر)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-200" />
            <span>يوم بدون حصة</span>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
          {WEEKDAYS.map((w, idx) => (
            <div key={idx} className="text-[11px] font-black text-slate-400 py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Interactive Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {calendarDays.map((item, idx) => {
            if (!item) {
              return <div key={`empty-${idx}`} className="aspect-square rounded-2xl bg-transparent" />;
            }

            const { dayNumber, isSession, record } = item;
            const isAttended = record?.status === "attended";
            const isAbsent = record?.status === "absent";

            return (
              <div
                key={item.dateStr}
                className={`aspect-square rounded-2xl p-1 sm:p-2 flex flex-col items-center justify-between transition-all select-none border ${
                  isAttended
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/25 ring-2 ring-emerald-200"
                    : isAbsent
                    ? "bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/25 ring-2 ring-rose-200"
                    : isSession
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : "bg-slate-50/70 text-slate-700 border-slate-100 hover:bg-slate-100/70"
                }`}
              >
                <span className="text-xs sm:text-sm font-black font-mono">{dayNumber}</span>

                {isAttended && (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    <span className="text-[9px] font-bold hidden sm:inline-block mt-0.5">حاضر</span>
                  </div>
                )}

                {isAbsent && (
                  <div className="flex flex-col items-center">
                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    <span className="text-[9px] font-bold hidden sm:inline-block mt-0.5">غائب</span>
                  </div>
                )}

                {!isAttended && !isAbsent && isSession && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" title="حصة بدون تسجيل" />
                )}

                {!isAttended && !isAbsent && !isSession && <div className="w-2 h-2" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
