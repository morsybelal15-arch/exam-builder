"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  QrCode,
  Camera,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Search,
  Filter,
  GraduationCap,
  BookOpen,
  DollarSign,
  Wallet,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Printer,
  ChevronDown,
} from "lucide-react";
import { Group } from "@/lib/types/management";
import { HomeAnalytics } from "@/lib/management-db";
import FastAttendanceScannerModal from "./FastAttendanceScannerModal";
import FastPaymentScannerModal from "./FastPaymentScannerModal";

interface HomeDashboardClientProps {
  initialData: HomeAnalytics;
  groups: Group[];
}

export default function HomeDashboardClient({
  initialData,
  groups,
}: HomeDashboardClientProps) {
  const [data, setData] = useState<HomeAnalytics>(initialData);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [groupFilterYear, setGroupFilterYear] = useState<string>("all");
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>("");

  // Handler for when a student attendance is recorded via Fast Attendance QR
  const handleAttendanceRecorded = (rec: {
    studentName: string;
    studentCode: string;
    groupName: string;
    time: string;
  }) => {
    setData((prev) => {
      const newAttended = prev.overall.todayAttendedCount + 1;
      const newRate =
        prev.overall.totalStudents > 0
          ? Math.round((newAttended / prev.overall.totalStudents) * 100)
          : 0;

      const newRecent = [
        {
          id: `att-live-${Date.now()}`,
          studentId: rec.studentCode,
          studentName: rec.studentName,
          studentCode: rec.studentCode,
          groupName: rec.groupName,
          time: rec.time,
          status: "attended" as const,
          method: "camera_qr",
          date: prev.todayDate,
        },
        ...prev.recentAttendance.slice(0, 7),
      ];

      return {
        ...prev,
        overall: {
          ...prev.overall,
          todayAttendedCount: newAttended,
          todayAttendanceRate: newRate,
        },
        recentAttendance: newRecent,
      };
    });
  };

  // Handler for when a student payment is recorded via Fast Payment QR
  const handlePaymentRecorded = (rec: {
    studentName: string;
    studentCode: string;
    groupName: string;
    month: string;
    paidAmount: number;
    status: any;
  }) => {
    setData((prev) => {
      const newCollected = prev.overall.monthlyCollectedRevenue + rec.paidAmount;
      const newRemaining = Math.max(0, prev.overall.monthlyExpectedRevenue - newCollected);
      const newRate =
        prev.overall.monthlyExpectedRevenue > 0
          ? Math.round((newCollected / prev.overall.monthlyExpectedRevenue) * 100)
          : 0;

      const newRecent = [
        {
          id: `fin-live-${Date.now()}`,
          studentId: rec.studentCode,
          studentName: rec.studentName,
          studentCode: rec.studentCode,
          groupName: rec.groupName,
          month: rec.month,
          status: rec.status,
          paidAmount: rec.paidAmount,
          totalAmount: rec.paidAmount,
          updatedAt: Date.now(),
        },
        ...prev.recentPayments.slice(0, 7),
      ];

      return {
        ...prev,
        overall: {
          ...prev.overall,
          monthlyCollectedRevenue: newCollected,
          monthlyRemainingRevenue: newRemaining,
          monthlyCollectionRate: newRate,
          paidStudentsCount: prev.overall.paidStudentsCount + 1,
        },
        recentPayments: newRecent,
      };
    });
  };

  // Filter groups
  const filteredGroups = data.byGroup.filter((grp) => {
    const matchesYear = groupFilterYear === "all" || grp.academicYear === groupFilterYear;
    const matchesSearch =
      grp.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
      grp.teacher.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
      grp.subject.toLowerCase().includes(groupSearchQuery.toLowerCase());
    return matchesYear && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8 space-y-8 select-text">
      {/* Top Welcome & Fast Action Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>لوحة التحكم الرئيسية للمركز</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            أهلاً بك، {data.todayDateFormatted}
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            متابعة فورية للحضور بالـ QR، تحصيل المصروفات، وإحصائيات الطلاب حسب المراحل
            والمجموعات الدراسية لشهر {data.currentMonthFormatted}.
          </p>
        </div>

        {/* Quick QR Trigger Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto relative z-10">
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex-1 sm:flex-initial px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <Camera className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>تسجيل حضور سريع (QR)</span>
          </button>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex-1 sm:flex-initial px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <CreditCard className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>تسجيل مصروفات سريع (QR)</span>
          </button>

          <Link
            href="/qr-printing"
            className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors cursor-pointer border border-slate-200/70"
            title="طباعة بطاقات QR للطلاب"
          >
            <Printer className="w-4 h-4" />
          </Link>
        </div>

        {/* Background decorative glow */}
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Students */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">إجمالي الطلاب</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 tracking-tight">
              {data.overall.totalStudents}
            </span>
            <span className="text-xs text-slate-400 mr-2">طالب مسجل</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {data.overall.activeStudents} طالب نشط
            </span>
            <span>{data.overall.inactiveStudents} غير نشط</span>
          </div>
        </div>

        {/* KPI 2: Groups & Years */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">المجموعات الدراسية</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 tracking-tight">
              {data.overall.totalGroups}
            </span>
            <span className="text-xs text-slate-400 mr-2">مجموعات فعالة</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>عبر {data.overall.totalAcademicYears} مراحل دراسية</span>
            <Link
              href="/groups"
              className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5"
            >
              إدارة <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 3: Today Attendance */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">نسبة حضور اليوم</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-black text-slate-800 tracking-tight">
                {data.overall.todayAttendanceRate}%
              </span>
              <span className="text-xs text-slate-400 mr-2">نسبة الحضور</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {data.overall.todayAttendedCount} حاضر
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 pt-3 border-t border-slate-50">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, data.overall.todayAttendanceRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 4: Monthly Collection */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">تحصيل الشهر الحالي</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-black text-slate-800 tracking-tight">
                {data.overall.monthlyCollectionRate}%
              </span>
              <span className="text-xs text-slate-400 mr-2">نسبة التحصيل</span>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              {data.overall.monthlyCollectedRevenue} ج.م
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 pt-3 border-t border-slate-50">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, data.overall.monthlyCollectionRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Operations & Feeds Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed 1: Today's Live Attendance Feed */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <h3 className="font-bold text-base text-slate-800">
                  سجل الحضور اللحظي اليوم
                </h3>
              </div>
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                مسح جديد بالـ QR <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>

            {/* List */}
            <div className="mt-4 divide-y divide-slate-50">
              {data.recentAttendance.length > 0 ? (
                data.recentAttendance.map((rec) => (
                  <div
                    key={rec.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/70 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{rec.studentName}</h4>
                        <p className="text-[11px] text-slate-400">
                          {rec.groupName} • {rec.studentCode}
                        </p>
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {rec.time || rec.date}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                        حاضر
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-400 flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    لم يتم تسجيل حضور أي طالب حتى الآن اليوم
                  </p>
                  <button
                    onClick={() => setShowAttendanceModal(true)}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    فتح ماسح الـ QR للبدء
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 text-left">
            <Link
              href="/students"
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold inline-flex items-center gap-1"
            >
              عرض سجل الحضور والغياب الكامل <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        </div>

        {/* Feed 2: Recent Payments Feed */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h3 className="font-bold text-base text-slate-800">
                  آخر التحصيلات والمصروفات المسددة
                </h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                تحصيل سريع بالـ QR <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>

            {/* List */}
            <div className="mt-4 divide-y divide-slate-50">
              {data.recentPayments.length > 0 ? (
                data.recentPayments.map((fin) => (
                  <div
                    key={fin.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/70 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{fin.studentName}</h4>
                        <p className="text-[11px] text-slate-400">
                          {fin.groupName} • شهر {fin.month}
                        </p>
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 font-mono">
                        +{fin.paidAmount} ج.م
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {fin.status === "paid" ? "مدفوع" : "سداد جزئي"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-400 flex items-center justify-center mx-auto">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    لا توجد تحصيلات مسجلة حديثاً
                  </p>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    تسجيل سداد جديد بالـ QR
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 text-left">
            <Link
              href="/students"
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold inline-flex items-center gap-1"
            >
              عرض الحسابات المالية الكاملة للطلاب <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        </div>
      </div>

      {/* Analytics Section 1: By Academic Year */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              إحصائيات الطلاب حسب المراحل الدراسية
            </h2>
            <p className="text-xs text-slate-400">
              توزيع أعداد الطلاب، المجموعات، ونسب الحضور والتحصيل لكل صف دراسي
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {data.byYear.map((yr) => (
            <div
              key={yr.year}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 hover:border-blue-200 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-800">{yr.year}</h3>
                  <span className="text-xs text-slate-400">{yr.groupsCount} مجموعات دراسية</span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700">
                  {yr.percentageOfAllStudents}% من الطلاب
                </span>
              </div>

              {/* Numbers Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-2xl">
                <div>
                  <span className="text-[11px] text-slate-400 block">عدد الطلاب</span>
                  <span className="text-lg font-black text-slate-800">{yr.studentsCount}</span>
                  <span className="text-[10px] text-emerald-600 block">
                    {yr.activeStudentsCount} نشط
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">حضور اليوم</span>
                  <span className="text-lg font-black text-emerald-600">
                    {yr.attendanceRate}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {yr.todayAttendedCount} من {yr.todayTotalCount}
                  </span>
                </div>
              </div>

              {/* Financial Progress */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">تحصيل المصروفات:</span>
                  <span className="font-bold text-slate-700">
                    {yr.monthlyCollectedRevenue} / {yr.monthlyExpectedRevenue} ج.م
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        yr.monthlyExpectedRevenue > 0
                          ? Math.min(100, Math.round((yr.monthlyCollectedRevenue / yr.monthlyExpectedRevenue) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Section 2: By Group */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              إحصائيات وأداء المجموعات الدراسية
            </h2>
            <p className="text-xs text-slate-400">
              متابعة تفصيلية لأعداد الطلاب، حضور اليوم، ونسبة تحصيل المصروفات لكل مجموعة
            </p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="بحث باسم المجموعة أو المعلم..."
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-500 pr-9"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Academic Year Filter */}
            <select
              value={groupFilterYear}
              onChange={(e) => setGroupFilterYear(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">جميع المراحل الدراسية</option>
              {data.byYear.map((yr) => (
                <option key={yr.year} value={yr.year}>
                  {yr.year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Groups Grid / Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((grp) => (
            <div
              key={grp.id}
              className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">{grp.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {grp.subject} • {grp.teacher}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">
                  {grp.academicYear}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">الطلاب</span>
                  <span className="text-sm font-bold text-slate-800">{grp.studentsCount}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">حضور اليوم</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {grp.todayAttendanceRate}%
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">التحصيل</span>
                  <span className="text-sm font-bold text-blue-600">
                    {grp.monthlyCollectionRate}%
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Link
                  href={`/students?groupId=${grp.id}`}
                  className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold text-center transition-colors"
                >
                  قائمة الطلاب
                </Link>

                <button
                  onClick={() => setShowAttendanceModal(true)}
                  className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  title="تسجيل حضور هذه المجموعة"
                >
                  <Camera className="w-3.5 h-3.5" />
                  حضور
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fast Attendance Modal */}
      {showAttendanceModal && (
        <FastAttendanceScannerModal
          groups={groups}
          todayDate={data.todayDate}
          onClose={() => setShowAttendanceModal(false)}
          onAttendanceRecorded={handleAttendanceRecorded}
        />
      )}

      {/* Fast Payment Modal */}
      {showPaymentModal && (
        <FastPaymentScannerModal
          currentMonth={data.currentMonth}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
}
