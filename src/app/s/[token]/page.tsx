import React from "react";
import type { Metadata } from "next";
import {
  ShieldAlert,
  GraduationCap,
  Users,
  BookOpen,
  UserCheck,
  Award,
  CalendarCheck,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  FileCheck,
} from "lucide-react";
import { getFullStudentProfile } from "@/lib/management-db";
import AttendanceCalendarClient from "./AttendanceCalendarClient";
import ParentShareButton from "./ParentShareButton";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const decoded = decodeURIComponent(token).trim();
  const profile = getFullStudentProfile(decoded);

  if (!profile || profile.student.status !== "active") {
    return {
      title: "بطاقة متابعة الطالب | غير مفعلة",
      robots: "noindex, nofollow",
    };
  }

  const { student, group } = profile;
  return {
    title: `بطاقة متابعة الطالب: ${student.name} | ولي الأمر`,
    description: `متابعة الحضور والدرجات والمصروفات فورياً للطالب ${student.name} في ${group?.name || "المجموعة"}`,
    robots: "noindex, nofollow",
  };
}

export default async function StudentParentPortalPage({ params }: PageProps) {
  const { token } = await params;
  const decodedToken = decodeURIComponent(token).trim();
  const profile = getFullStudentProfile(decodedToken);

  // 1. Invalid or Inactive Student State
  if (!profile || profile.student.status !== "active") {
    return (
      <div
        className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              بطاقة المتابعة غير مفعلة
            </h1>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed">
              عفواً، هذه البطاقة غير مفعلة حالياً. يرجى مراجعة إدارة المركز.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-500 font-medium">
            تأكد من مسح رمز QR الأحدث المطبوع على بطاقة الطالب، أو تواصل مع معلم المادة لتفعيل الحساب.
          </div>
        </div>
      </div>
    );
  }

  const { student, group, financials, attendance, sessions, grades } = profile;

  // Compute Quick Summary Metrics
  const totalAttendanceRecords = attendance.length;
  const attendedCount = attendance.filter((a) => a.status === "attended").length;
  const attendanceRate =
    totalAttendanceRecords > 0
      ? Math.round((attendedCount / totalAttendanceRecords) * 100)
      : 100;

  const examsTakenCount = grades.filter(
    (g) => g.score !== null && g.score !== undefined
  ).length;

  // Current Month Payment Status
  const currentMonthKey = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const currentMonthFinancial = financials.find((f) => f.month === currentMonthKey);

  const getFinancialBadge = (record?: typeof currentMonthFinancial) => {
    if (!record) {
      return {
        label: "غير مسجل",
        style: "bg-slate-100 text-slate-700 border-slate-200",
        icon: AlertCircle,
      };
    }
    if (record.status === "paid" || record.paidAmount >= record.totalAmount) {
      return {
        label: "مدفوع بالكامل",
        style: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle2,
      };
    }
    if (record.paidAmount > 0 && record.paidAmount < record.totalAmount) {
      return {
        label: `مدفوع جزئياً (${record.paidAmount} / ${record.totalAmount} ج.م)`,
        style: "bg-amber-50 text-amber-800 border-amber-200",
        icon: Clock,
      };
    }
    return {
      label: `مستحق (${record.totalAmount} ج.م)`,
      style: "bg-rose-50 text-rose-700 border-rose-200",
      icon: XCircle,
    };
  };

  const currentMonthBadge = getFinancialBadge(currentMonthFinancial);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-6 sm:py-10 px-4 sm:px-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Header Card */}
        <header className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 relative overflow-hidden">
          {/* Subtle decorative background gradient */}
          <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span>بطاقة متابعة ولي الأمر المباشرة</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {student.name}
              </h1>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold">
                <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {student.academicYear || group?.academicYear || "المرحلة الدراسية"}
                </span>
                <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-mono">
                  كود: {student.code}
                </span>
              </div>
            </div>

            {/* Teacher and Subject Badge */}
            <div className="sm:text-left bg-slate-50 sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-slate-200/60 sm:border-none space-y-1">
              <div className="text-xs font-bold text-slate-400">المجموعة والمعلم</div>
              <div className="text-sm font-black text-blue-600">
                {group?.name || student.groupName || "المجموعة"}
              </div>
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 sm:justify-end">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <span>{group?.teacher || "معلم المادة"}</span>
                {group?.subject && (
                  <span className="text-slate-400">({group.subject})</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Quick Summary Pills */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Pill 1: Attendance Rate */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">نسبة الحضور</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-emerald-600 font-mono">
                  {attendanceRate}%
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  ({attendedCount} من {totalAttendanceRecords} حصة)
                </span>
              </div>
            </div>
          </div>

          {/* Pill 2: Exams Taken */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">الاختبارات المنجزة</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-blue-600 font-mono">
                  {examsTakenCount}
                </span>
                <span className="text-[10px] font-bold text-slate-500">اختبار مسجل</span>
              </div>
            </div>
          </div>

          {/* Pill 3: Current Month Payment */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase">اشتراك الشهر الحالي</p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border truncate max-w-full ${currentMonthBadge.style}`}
                >
                  <currentMonthBadge.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{currentMonthBadge.label}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: سجل الحضور والغياب (Attendance Calendar) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
              <span>سجل الحضور والغياب</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">محدث فورياً عبر QR</span>
          </div>

          <AttendanceCalendarClient
            attendance={attendance}
            sessions={sessions}
          />
        </section>

        {/* Section 2: درجات الاختبارات (Exam Grades) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              <span>درجات الاختبارات والتقييمات</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {grades.length} اختبار مسجل
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80">
            {grades.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {grades.map((grd) => {
                  const hasScore = grd.score !== null && grd.score !== undefined;
                  const ratio = hasScore && grd.totalScore > 0 ? grd.score / grd.totalScore : 0;
                  const isExcellent = ratio >= 0.85;
                  const isGood = ratio >= 0.65 && ratio < 0.85;

                  return (
                    <div
                      key={grd.id}
                      className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-slate-900">
                            {grd.examName}
                          </h4>
                          {isExcellent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ممتاز
                            </span>
                          )}
                          {isGood && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              جيد جداً
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 font-medium flex items-center gap-3">
                          {grd.date && <span>تاريخ الامتحان: {grd.date}</span>}
                          {grd.notes && <span className="text-slate-500">• {grd.notes}</span>}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {hasScore ? (
                          <div
                            className={`px-3.5 py-1.5 rounded-2xl font-black text-sm sm:text-base border font-mono flex items-baseline gap-1 ${
                              isExcellent
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isGood
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            <span>{grd.score}</span>
                            <span className="text-xs text-slate-400 font-bold">
                              / {grd.totalScore}
                            </span>
                          </div>
                        ) : (
                          <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                            قيد الرصد
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <FileCheck className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">لا توجد اختبارات مسجلة بعد لهذا الطالب.</p>
              </div>
            )}
          </div>
        </section>

        {/* Section 3: حالة المصروفات الشهرية (Financial Status) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>حالة المصروفات الشهرية</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              قيمة الاشتراك: {student.monthlyFee || 250} ج.م شهرياً
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80">
            {financials.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {financials.map((fin) => {
                  const isPaid = fin.status === "paid" || fin.paidAmount >= fin.totalAmount;
                  const isPartial = !isPaid && fin.paidAmount > 0;

                  return (
                    <div
                      key={fin.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-slate-900 font-mono">
                          شهر {fin.month}
                        </div>
                        {fin.notes && (
                          <p className="text-xs text-slate-500 font-medium">{fin.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {fin.paidAmount} / {fin.totalAmount} ج.م
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isPartial
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {isPaid ? "مدفوع" : isPartial ? "مدفوع جزئياً" : "غير مدفوع"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 space-y-1">
                <p className="text-xs font-bold">لا توجد سجلات مصروفات مسجلة بعد.</p>
              </div>
            )}
          </div>
        </section>

        {/* Footer & Share / Bookmark Action */}
        <footer className="pt-4 pb-12 text-center space-y-6">
          <ParentShareButton studentName={student.name} />

          <div className="p-4 bg-blue-50/70 border border-blue-200/60 rounded-2xl text-xs text-blue-900 font-semibold max-w-lg mx-auto leading-relaxed">
            💡 <strong>نصيحة لولي الأمر:</strong> يمكنك مسح رمز QR المطبوع على بطاقة الطالب بكاميرا الهاتف في أي وقت، أو حفظ هذه الصفحة في المفضلة لمتابعة نتائج وحضور الطالب بشكل فوري.
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            منصة بنك الاختبارات والتدريس التفاعلي • بطاقة المتابعة الذكية
          </p>
        </footer>
      </div>
    </div>
  );
}
