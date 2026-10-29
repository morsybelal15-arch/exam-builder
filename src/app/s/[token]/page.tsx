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
import { getFullStudentProfile, getLocalTodayDate } from "@/lib/management-db";
import { headers } from "next/headers";
import { findTenantByDomain } from "@/lib/tenants-repository";
import { setCurrentTenantId } from "@/lib/tenant-context";
import ParentSectionsClient from "./ParentSectionsClient";
import ParentShareButton from "./ParentShareButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function resolveTenantFromRequestHost() {
  try {
    const h = await headers();
    const host = h.get("host") || "";
    if (host) {
      const tenant = await findTenantByDomain(host);
      if (tenant?.id) {
        setCurrentTenantId(tenant.id);
      }
    }
  } catch {
    // Ignore header resolution errors
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await resolveTenantFromRequestHost();
  const { token } = await params;
  const decoded = decodeURIComponent(token).trim();
  const profile = getFullStudentProfile(decoded);

  if (!profile) {
    return {
      title: "ملف الطالب غير موجود",
      robots: "noindex, nofollow",
    };
  }

  if (profile.student.status === "inactive" || (profile.student.status as string) === "disabled") {
    return {
      title: "بطاقة متابعة الطالب | الحساب معطل",
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
  await resolveTenantFromRequestHost();
  const { token } = await params;
  const decodedToken = decodeURIComponent(token).trim();
  const profile = getFullStudentProfile(decodedToken);

  // 1. Student removed / Not Found State
  if (!profile) {
    return (
      <div
        className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-slate-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 text-center space-y-6 animate-in fade-in zoom-in-95 my-auto">
          <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-3xl flex items-center justify-center mx-auto border border-slate-200 shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              لم يتم العثور على ملف الطالب
            </h1>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed">
              عفواً، لم يتم العثور على طالب بهذا الرمز، قد يكون تم حذف الحساب أو أن الرابط غير صحيح.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-500 font-medium">
            يرجى التأكد من مسح رمز QR الأحدث من بطاقة الطالب، أو مراجعة إدارة المركز للتأكد من تسجيل الطالب.
          </div>
        </div>
      </div>
    );
  }

  // 2. Student Status Disabled / Inactive State
  if (profile.student.status === "inactive" || (profile.student.status as string) === "disabled") {
    return (
      <div
        className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-slate-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 text-center space-y-6 animate-in fade-in zoom-in-95 my-auto">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              حساب الطالب معطل حالياً
            </h1>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed">
              عفواً، تم إيقاف بطاقة المتابعة مؤقتاً نظراً لتعطيل حساب الطالب.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-500 font-medium">
            يرجى مراجعة إدارة المركز أو معلم المادة لإعادة تفعيل الحساب واستئناف المتابعة.
          </div>
        </div>
      </div>
    );
  }

  const { student, group, financials, attendance, sessions, grades } = profile;

  // Compute Quick Summary Metrics
  const totalAttendanceRecords = Math.max(attendance.length, sessions.length);
  const attendedCount = attendance.filter((a) => a.status === "attended").length;
  const attendanceRate =
    totalAttendanceRecords > 0
      ? Math.round((attendedCount / totalAttendanceRecords) * 100)
      : 100;

  const examsTakenCount = grades.filter(
    (g) => g.score !== null && g.score !== undefined
  ).length;

  // Current Month Payment Status
  const currentMonthKey = getLocalTodayDate().substring(0, 7); // "YYYY-MM"
  const currentMonthFinancial = financials.find((f) => f.month === currentMonthKey);

  const getFinancialBadge = (record?: typeof currentMonthFinancial) => {
    if (!record) {
      return {
        label: "غير مسجل",
        style: "bg-slate-100 text-slate-700 border-slate-200",
        icon: AlertCircle,
      };
    }
    if (record.status === "returned") {
      return {
        label: "تم إرجاع الاشتراك",
        style: "bg-rose-50 text-rose-700 border-rose-200",
        icon: XCircle,
      };
    }
    if (record.paidAmount > 0 && record.paidAmount < record.totalAmount) {
      return {
        label: `مدفوع جزئياً (${record.paidAmount} / ${record.totalAmount} ج.م)`,
        style: "bg-amber-50 text-amber-800 border-amber-200",
        icon: Clock,
      };
    }
    if (record.status === "paid" || (record.paidAmount >= record.totalAmount && record.totalAmount > 0)) {
      return {
        label: "مدفوع بالكامل",
        style: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle2,
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
    <div
      className="flex-1 w-full h-full min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50 text-slate-800 py-6 sm:py-10 px-4 sm:px-6 select-text scroll-smooth"
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto space-y-6 pb-32 sm:pb-40">
        {/* Top Header Card */}
        <header className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 relative overflow-hidden">
          {/* Subtle decorative background gradient */}
          <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

          <div className="space-y-3">
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
              {(group?.name || student.groupName) && (
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 font-bold">
                  {group?.name || student.groupName}
                </span>
              )}
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

        {/* Interactive Sections Client: Tabs for Attendance, Exams, and Financials */}
        <ParentSectionsClient
          attendance={attendance}
          sessions={sessions}
          grades={grades}
          financials={financials}
          student={student}
          group={group || null}
        />

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
