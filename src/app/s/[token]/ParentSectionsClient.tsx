"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Award,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  FileCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import {
  AttendanceRecord,
  GroupClassSession,
  FinancialRecord,
  StudentGradeRecord,
  Student,
  Group,
} from "@/lib/types/management";
import AttendanceCalendarClient from "./AttendanceCalendarClient";

const ARABIC_MONTH_NAMES = [
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

function formatMonthYearLabel(monthKey: string) {
  if (!monthKey) return "شهر غير محدد";
  const parts = monthKey.split("-");
  if (parts.length >= 2) {
    const y = parts[0];
    const mIndex = Number(parts[1]) - 1;
    const mName = ARABIC_MONTH_NAMES[mIndex] || `شهر ${parts[1]}`;
    return `${mName} ${y}`;
  }
  return monthKey;
}

interface ParentSectionsClientProps {
  attendance: AttendanceRecord[];
  sessions: GroupClassSession[];
  grades: (StudentGradeRecord & { examName: string; totalScore: number; date?: string })[];
  financials: FinancialRecord[];
  student: Student;
  group: Group | null;
}

export default function ParentSectionsClient({
  attendance,
  sessions,
  grades,
  financials,
  student,
  group,
}: ParentSectionsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"attendance" | "exams" | "financials">("attendance");
  const [examPage, setExamPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination for exams (5 exams per page)
  const EXAMS_PER_PAGE = 5;
  const totalExamPages = Math.max(1, Math.ceil(grades.length / EXAMS_PER_PAGE));
  const currentExamPage = Math.min(examPage, totalExamPages);
  const pagedGrades = grades.slice(
    (currentExamPage - 1) * EXAMS_PER_PAGE,
    currentExamPage * EXAMS_PER_PAGE
  );

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 600));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* SECTION TABS / TOGGLE BUTTONS HEADER                     */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-xs border border-slate-200/80">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Action Tabs Row (Mobile scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* 1. سجل الحضور والغياب */}
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
                activeTab === "attendance"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>سجل الحضور والغياب</span>
            </button>

            {/* 2. درجات الاختبارات */}
            <button
              type="button"
              onClick={() => setActiveTab("exams")}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
                activeTab === "exams"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              <Award className="w-4 h-4" />
              <span>درجات الاختبارات</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "exams"
                    ? "bg-white/20 text-white"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {grades.length}
              </span>
            </button>

            {/* 3. المصروفات الشهرية */}
            <button
              type="button"
              onClick={() => setActiveTab("financials")}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
                activeTab === "financials"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>حالة المصروفات</span>
            </button>
          </div>

          {/* Live Data Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="تحديث البيانات المباشرة الآن"
            className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200/70 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>{isRefreshing ? "جاري التحديث..." : "تحديث فوري"}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: سجل الحضور والغياب (ATTENDANCE)                 */}
      {/* ======================================================== */}
      {activeTab === "attendance" && (
        <section className="space-y-4 animate-in fade-in zoom-in-98 duration-200">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                سجل الحضور والغياب الشهري
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              بيانات محدثة فورياً
            </span>
          </div>

          <AttendanceCalendarClient
            attendance={attendance}
            sessions={sessions}
          />
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: درجات الاختبارات والتقييمات (EXAMS)             */}
      {/* ======================================================== */}
      {activeTab === "exams" && (
        <section className="space-y-4 animate-in fade-in zoom-in-98 duration-200">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                درجات الاختبارات والتقييمات
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              إجمالي: {grades.length} اختبار مسجل
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80 space-y-5">
            {grades.length > 0 ? (
              <>
                <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 pr-1">
                  {pagedGrades.map((grd) => {
                    const hasScore = grd.score !== null && grd.score !== undefined;
                    const ratio = hasScore && grd.totalScore > 0 ? (grd.score ?? 0) / grd.totalScore : 0;
                    const isExcellent = ratio >= 0.85;
                    const isGood = ratio >= 0.65 && ratio < 0.85;

                    return (
                      <div
                        key={grd.id}
                        className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-slate-50/60 p-2 rounded-2xl transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
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
                            {grd.date && <span>تاريخ الاختبار: {grd.date}</span>}
                            {grd.notes && <span className="text-slate-500">• {grd.notes}</span>}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {hasScore ? (
                            <div
                              className={`px-3.5 py-1.5 rounded-2xl font-black text-sm sm:text-base border font-mono flex items-baseline gap-1 shadow-2xs ${
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

                {/* Pagination Bar (5 exams per page) */}
                {totalExamPages > 1 && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setExamPage((p) => Math.max(1, p - 1))}
                      disabled={currentExamPage === 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>السابق</span>
                    </button>

                    <span className="font-bold text-slate-500">
                      صفحة {currentExamPage} من {totalExamPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setExamPage((p) => Math.min(totalExamPages, p + 1))}
                      disabled={currentExamPage === totalExamPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <span>التالي</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <FileCheck className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">لا توجد اختبارات مسجلة بعد لهذا الطالب.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: حالة المصروفات الشهرية (FINANCIALS)             */}
      {/* ======================================================== */}
      {activeTab === "financials" && (
        <section className="space-y-4 animate-in fade-in zoom-in-98 duration-200">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                حالة المصروفات والاشتراكات الشهرية
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              قيمة الاشتراك: {student.monthlyFee || 250} ج.م شهرياً
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80 space-y-4">
            {financials.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-medium">
                  حالة سداد الشهور الدراسية (اللون الأخضر: تم السداد، اللون الأحمر: غير مدفوع أو متبقي):
                </p>

                {/* Monthly Buttons Grid: light green if paid, light red if unpaid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {financials.map((fin) => {
                    const isPaid = fin.status === "paid" || fin.paidAmount >= fin.totalAmount;
                    const label = formatMonthYearLabel(fin.month);

                    return (
                      <div
                        key={fin.id}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 text-right shadow-2xs ${
                          isPaid
                            ? "bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border-emerald-200/90"
                            : "bg-rose-50/90 hover:bg-rose-100/90 text-rose-900 border-rose-200/90"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-sm sm:text-base font-sans tracking-wide">
                            {label}
                          </span>
                          {isPaid ? (
                            <div className="w-7 h-7 rounded-xl bg-emerald-200/70 text-emerald-800 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-xl bg-rose-200/70 text-rose-800 flex items-center justify-center shrink-0">
                              <XCircle className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5 font-bold">
                          <span>
                            {isPaid ? "مدفوع بالكامل" : fin.paidAmount > 0 ? "مدفوع جزئياً" : "غير مدفوع"}
                          </span>
                          <span className="font-mono">
                            {fin.paidAmount} / {fin.totalAmount} ج.م
                          </span>
                        </div>

                        {fin.notes && (
                          <div className="text-[11px] opacity-80 font-normal">
                            ملاحظة: {fin.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 space-y-1">
                <CreditCard className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">لا توجد سجلات مصروفات مسجلة بعد لهذا الطالب.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
