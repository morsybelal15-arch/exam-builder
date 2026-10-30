"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import {
  Camera,
  CreditCard,
  Calendar,
  ArrowUp,
  ArrowDown,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserX,
  MessageCircle,
  CheckCircle2,
  Wallet,
  Phone,
  X,
} from "lucide-react";
import { Group } from "@/lib/types/management";
import { HomeAnalytics, AnalyticsFilterMode } from "@/lib/management-db";
import { notifyTenantDataMutated } from "@/lib/client-session-cache";
import FastAttendanceScannerModal from "./FastAttendanceScannerModal";
import FastPaymentScannerModal from "./FastPaymentScannerModal";

interface HomeDashboardClientProps {
  initialData: HomeAnalytics;
  groups: Group[];
}

function buildWhatsAppUrl(phone: string, message: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  } else if (clean.startsWith("01") && clean.length === 11) {
    clean = `2${clean}`;
  } else if (clean.startsWith("1") && clean.length === 10) {
    clean = `20${clean}`;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export default function HomeDashboardClient({
  initialData,
  groups,
}: HomeDashboardClientProps) {
  const [data, setData] = useState<HomeAnalytics>(initialData);
  const [groupsList, setGroupsList] = useState<Group[]>(groups);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    setGroupsList(groups);
  }, [groups]);

  // Refs for GSAP animations
  const kpiGridRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const dateDrawerRef = useRef<HTMLDivElement>(null);

  // Top-right Date Range Picker Popover state
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState<boolean>(false);

  // Interactive selections
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
  const [selectedYearCardIdx, setSelectedYearCardIdx] = useState<number>(0);
  const [focusScannerMode, setFocusScannerMode] = useState<"attendance" | "payment">(
    "attendance"
  );
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>("");

  // Tracking Hub (Absent Today vs Overdue Payments) state
  const [trackingTab, setTrackingTab] = useState<"absent" | "overdue">("absent");
  const [trackingSearch, setTrackingSearch] = useState<string>("");
  const [trackingGroupId, setTrackingGroupId] = useState<string>("all");
  const [overdueStatusFilter, setOverdueStatusFilter] = useState<
    "all" | "unpaid" | "partial"
  >("all");
  const [pageSize, setPageSize] = useState<number>(12);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Date Range Filter state (defaults to current month)
  const defaultMonth = initialData.filter?.month || initialData.currentMonth;
  const defaultYear = initialData.filter?.year || initialData.todayDate.slice(0, 4);
  const [filterMode, setFilterMode] = useState<AnalyticsFilterMode>(
    initialData.filter?.mode || "month"
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);
  const [customStartDate, setCustomStartDate] = useState<string>(
    initialData.filter?.startDate || `${defaultMonth}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    initialData.filter?.endDate || initialData.todayDate
  );
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string>(
    initialData.todayDate
  );
  const [isLoadingRange, setIsLoadingRange] = useState<boolean>(false);

  // Reset pagination to page 1 whenever filters or tabs change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    trackingTab,
    trackingSearch,
    trackingGroupId,
    selectedAcademicYear,
    overdueStatusFilter,
    pageSize,
  ]);

  // GSAP: Animate KPI Cards when analytics data updates
  useEffect(() => {
    if (!kpiGridRef.current) return;
    const cards = kpiGridRef.current.children;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 14, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.38,
        stagger: 0.05,
        ease: "power2.out",
        clearProps: "transform,opacity",
      }
    );
  }, [data.filter?.periodLabel]);

  // GSAP: Animate Student List rows when switching tab, page, or filter
  useEffect(() => {
    if (!listContainerRef.current) return;
    const rows = listContainerRef.current.children;
    if (rows.length === 0) return;
    gsap.fromTo(
      rows,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.26,
        stagger: 0.02,
        ease: "power2.out",
        clearProps: "transform,opacity",
      }
    );
  }, [trackingTab, currentPage, selectedAcademicYear, trackingGroupId, overdueStatusFilter]);

  // GSAP: Animate Date Drawer when opened
  useEffect(() => {
    if (isDatePopoverOpen && dateDrawerRef.current) {
      gsap.fromTo(
        dateDrawerRef.current,
        { opacity: 0, y: -10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power2.out",
          clearProps: "transform,opacity",
        }
      );
    }
  }, [isDatePopoverOpen]);

  const currentSystemYear = parseInt(initialData.todayDate.slice(0, 4), 10) || 2026;
  const availableYears = [
    String(currentSystemYear + 1),
    String(currentSystemYear),
    String(currentSystemYear - 1),
    String(currentSystemYear - 2),
    String(currentSystemYear - 3),
  ];

  const fetchFilteredAnalytics = async (
    params: {
      mode: AnalyticsFilterMode;
      month?: string;
      year?: string;
      startDate?: string;
      endDate?: string;
      targetDate?: string;
    },
    silent = false
  ) => {
    if (!silent) setIsLoadingRange(true);
    try {
      const qs = new URLSearchParams();
      qs.set("mode", params.mode);
      if (params.month) qs.set("month", params.month);
      if (params.year) qs.set("year", params.year);
      if (params.startDate) qs.set("startDate", params.startDate);
      if (params.endDate) qs.set("endDate", params.endDate);
      if (params.targetDate) qs.set("targetDate", params.targetDate);
      qs.set("t", String(Date.now()));

      const [res, grpRes] = await Promise.all([
        fetch(`/api/home-analytics?${qs.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/groups?t=${Date.now()}`, {
          cache: "no-store",
        }),
      ]);
      const [json, grpJson] = await Promise.all([res.json(), grpRes.json()]);
      if (res.ok && json.analytics) {
        setData(json.analytics);
      }
      if (grpRes.ok && grpJson.success && Array.isArray(grpJson.groups)) {
        setGroupsList(grpJson.groups);
      }
    } catch (e) {
      console.error("Failed to fetch filtered analytics:", e);
    } finally {
      if (!silent) setIsLoadingRange(false);
    }
  };

  // Always refresh live analytics on mount, window focus, and cross-page mutations so navigating to "/" never displays stale data
  useEffect(() => {
    const refreshCurrent = () => {
      fetchFilteredAnalytics(
        {
          mode: filterMode,
          month: selectedMonth,
          year: selectedYear,
          startDate: customStartDate,
          endDate: customEndDate,
          targetDate: selectedCalendarDay,
        },
        true
      );
    };

    refreshCurrent();
    window.addEventListener("tenant-data-mutated", refreshCurrent);
    window.addEventListener("focus", refreshCurrent);
    return () => {
      window.removeEventListener("tenant-data-mutated", refreshCurrent);
      window.removeEventListener("focus", refreshCurrent);
    };
  }, [filterMode, selectedMonth, selectedYear, customStartDate, customEndDate, selectedCalendarDay]);

  const handleModeChange = (nextMode: AnalyticsFilterMode) => {
    setFilterMode(nextMode);
    if (nextMode === "month") {
      fetchFilteredAnalytics({
        mode: "month",
        month: selectedMonth,
        targetDate: selectedCalendarDay,
      });
    } else if (nextMode === "year") {
      fetchFilteredAnalytics({
        mode: "year",
        year: selectedYear,
        targetDate: selectedCalendarDay,
      });
    } else {
      fetchFilteredAnalytics({
        mode: "custom",
        startDate: customStartDate,
        endDate: customEndDate,
        targetDate: selectedCalendarDay,
      });
    }
  };

  const handleResetToCurrentMonth = () => {
    const sysMonth = initialData.todayDate.slice(0, 7);
    const sysYear = initialData.todayDate.slice(0, 4);
    setFilterMode("month");
    setSelectedMonth(sysMonth);
    setSelectedYear(sysYear);
    setCustomStartDate(`${sysMonth}-01`);
    setCustomEndDate(initialData.todayDate);
    setSelectedCalendarDay(initialData.todayDate);
    fetchFilteredAnalytics({
      mode: "month",
      month: sysMonth,
      targetDate: initialData.todayDate,
    });
  };

  // Handler for when a student attendance is recorded via Fast Attendance QR
  const handleAttendanceRecorded = (rec: {
    studentName: string;
    studentCode: string;
    groupName: string;
    time: string;
  }) => {
    setData((prev) => {
      const alreadyScannedToday = prev.recentAttendance.some(
        (r) => r.studentCode === rec.studentCode && r.date === prev.todayDate
      );
      const denominator =
        prev.overall.activeStudents > 0
          ? prev.overall.activeStudents
          : prev.overall.totalStudents;
      const newAttended = alreadyScannedToday
        ? prev.overall.todayAttendedCount
        : prev.overall.todayAttendedCount + 1;
      const newRate =
        denominator > 0
          ? Math.min(100, Math.round((newAttended / denominator) * 100))
          : 0;

      const updatedAbsentList = (prev.absentStudentsToday || []).filter(
        (s) => s.code !== rec.studentCode
      );

      const filteredPrev = prev.recentAttendance.filter(
        (r) => !(r.studentCode === rec.studentCode && r.date === prev.todayDate)
      );

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
        ...filteredPrev.slice(0, 7),
      ];

      return {
        ...prev,
        overall: {
          ...prev.overall,
          todayAttendedCount: newAttended,
          todayAbsentCount: updatedAbsentList.length,
          todayAttendanceRate: newRate,
        },
        absentStudentsToday: updatedAbsentList,
        recentAttendance: newRecent,
      };
    });
    notifyTenantDataMutated();
    fetchFilteredAnalytics(
      {
        mode: filterMode,
        month: selectedMonth,
        year: selectedYear,
        startDate: customStartDate,
        endDate: customEndDate,
        targetDate: selectedCalendarDay,
      },
      true
    );
  };

  // Handler for when a student payment is recorded via Fast Payment QR
  const handlePaymentRecorded = () => {
    notifyTenantDataMutated();
    fetchFilteredAnalytics(
      {
        mode: filterMode,
        month: selectedMonth,
        year: selectedYear,
        startDate: customStartDate,
        endDate: customEndDate,
        targetDate: selectedCalendarDay,
      },
      true
    );
  };

  const fmtNum = (val?: number | null) => Number(val ?? 0).toLocaleString("ar-EG");
  const periodLabel = data.filter?.periodLabel || data.currentMonthFormatted;
  const currentMonthlySub =
    data.overall.currentMonthlySubscriptionTotal ??
    data.overall.monthlyExpectedRevenue ??
    0;
  const newStudentsCount = data.overall.newStudentsCount ?? 0;
  const leftStudentsCount = data.overall.leftStudentsCount ?? 0;
  const netStudentsChange =
    data.overall.netStudentsChange ?? newStudentsCount - leftStudentsCount;

  const absentListRaw = data.absentStudentsToday || [];
  const overdueListRaw = data.overdueStudentsList || [];
  const totalOverdueStudentsCount =
    data.overall.overdueStudentsCount ?? overdueListRaw.length;
  const totalOverdueAmount =
    data.overall.totalOverdueAmount ??
    overdueListRaw.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

  // Filtered Absent Students
  const filteredAbsentStudents = useMemo(() => {
    const q = trackingSearch.trim().toLowerCase();
    return absentListRaw.filter((st) => {
      const matchesYear =
        selectedAcademicYear === "all" || st.academicYear === selectedAcademicYear;
      const matchesGroup =
        trackingGroupId === "all" || st.groupId === trackingGroupId;
      const matchesSearch =
        !q ||
        st.name.toLowerCase().includes(q) ||
        st.code.toLowerCase().includes(q) ||
        (st.parentPhone || "").includes(q) ||
        (st.studentPhone || "").includes(q) ||
        (st.groupName || "").toLowerCase().includes(q);
      return matchesYear && matchesGroup && matchesSearch;
    });
  }, [absentListRaw, selectedAcademicYear, trackingGroupId, trackingSearch]);

  // Filtered Overdue Students
  const filteredOverdueStudents = useMemo(() => {
    const q = trackingSearch.trim().toLowerCase();
    return overdueListRaw.filter((st) => {
      const matchesYear =
        selectedAcademicYear === "all" || st.academicYear === selectedAcademicYear;
      const matchesGroup =
        trackingGroupId === "all" || st.groupId === trackingGroupId;
      const matchesStatus =
        overdueStatusFilter === "all" || st.status === overdueStatusFilter;
      const matchesSearch =
        !q ||
        st.name.toLowerCase().includes(q) ||
        st.code.toLowerCase().includes(q) ||
        (st.parentPhone || "").includes(q) ||
        (st.studentPhone || "").includes(q) ||
        (st.groupName || "").toLowerCase().includes(q);
      return matchesYear && matchesGroup && matchesStatus && matchesSearch;
    });
  }, [
    overdueListRaw,
    selectedAcademicYear,
    trackingGroupId,
    overdueStatusFilter,
    trackingSearch,
  ]);

  const filteredOverdueAmountSum = useMemo(() => {
    return filteredOverdueStudents.reduce(
      (sum, s) => sum + (s.remainingAmount || 0),
      0
    );
  }, [filteredOverdueStudents]);

  // Pagination logic
  const activeListLength =
    trackingTab === "absent"
      ? filteredAbsentStudents.length
      : filteredOverdueStudents.length;
  const totalPages = Math.max(1, Math.ceil(activeListLength / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedAbsent = filteredAbsentStudents.slice(
    startIndex,
    startIndex + pageSize
  );
  const paginatedOverdue = filteredOverdueStudents.slice(
    startIndex,
    startIndex + pageSize
  );

  // Card 1 Mini Bar Data
  const card1Bars = useMemo(() => {
    const source =
      data.byYear.length > 0
        ? data.byYear.map((y) => ({
            label: y.year,
            val: y.activeStudentsCount,
          }))
        : [{ label: "الطلاب", val: data.overall.activeStudents }];

    const padded = [...source];
    while (padded.length < 5) {
      padded.push({
        label: `مجموعة ${padded.length + 1}`,
        val: Math.max(
          1,
          Math.round((data.overall.activeStudents || 10) * (0.35 + padded.length * 0.1))
        ),
      });
    }
    const slice5 = padded.slice(0, 5);
    const maxVal = Math.max(...slice5.map((b) => b.val), 1);
    let maxIdx = 0;
    slice5.forEach((b, i) => {
      if (b.val >= slice5[maxIdx].val) maxIdx = i;
    });

    return slice5.map((b, idx) => ({
      ...b,
      heightPct: Math.max(24, Math.round((b.val / maxVal) * 100)),
      isPeak: idx === maxIdx,
    }));
  }, [data.byYear, data.overall.activeStudents]);

  // Card 3 Interactive Academic Year Focus
  const activeYearObj =
    data.byYear.length > 0
      ? data.byYear[selectedYearCardIdx % data.byYear.length]
      : null;

  const yearSharePct = activeYearObj
    ? Math.max(12, Math.min(100, activeYearObj.percentageOfAllStudents || 50))
    : 65;

  const semiRadius = 38;
  const semiLength = Math.PI * semiRadius;
  const semiDashOffset = semiLength - (yearSharePct / 100) * semiLength;
  const knobAngleRad = Math.PI * (1 - yearSharePct / 100);
  const knobX = 50 + semiRadius * Math.cos(knobAngleRad);
  const knobY = 50 - semiRadius * Math.sin(knobAngleRad);

  // Filtered groups
  const filteredGroups = data.byGroup.filter((grp) => {
    const matchesYear =
      selectedAcademicYear === "all" || grp.academicYear === selectedAcademicYear;
    const matchesSearch =
      grp.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
      grp.teacher.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
      grp.subject.toLowerCase().includes(groupSearchQuery.toLowerCase());
    return matchesYear && matchesSearch;
  });

  // Focus Mode Circle Ring math
  const focusPercentage =
    focusScannerMode === "attendance"
      ? data.overall.todayAttendanceRate
      : data.overall.monthlyCollectionRate;
  const focusRingRadius = 46;
  const focusRingCircumference = 2 * Math.PI * focusRingRadius;
  const focusRingOffset =
    focusRingCircumference -
    (Math.min(100, focusPercentage) / 100) * focusRingCircumference;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6FA] select-text">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* SVG Pattern Definitions (Success Green & Danger Red) */}
        <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
          <defs>
            <pattern
              id="greenStripePattern"
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--theme-success-500)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#2EE59D" strokeWidth="3" />
            </pattern>
            <pattern
              id="redStripePattern"
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--theme-danger-600)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#FB7185" strokeWidth="3" />
            </pattern>
            <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--theme-success-500)" stopOpacity="0.38" />
              <stop offset="100%" stopColor="var(--theme-success-500)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        {/* ===================================================================
            SECTION 1: TOP CONTROL BAR (Right: Date Range Button | Left: Quick QR)
           =================================================================== */}
        <div className="gsap-card relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl px-5 py-4 border border-slate-200/70 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
          {/* Right Side: Date Filter Button & Today's Date */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDatePopoverOpen((prev) => !prev)}
              className={`inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer border ${
                isDatePopoverOpen
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border-slate-200"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDatePopoverOpen
                    ? "bg-white/20 text-white"
                    : "bg-blue-600 text-white shadow-xs"
                }`}
              >
                {isLoadingRange ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
              </div>
              <div className="text-right">
                <span
                  className={`text-[10px] font-bold block leading-none ${
                    isDatePopoverOpen ? "text-white/80" : "text-slate-500"
                  }`}
                >
                  الفترة الزمنية للإحصائيات
                </span>
                <span
                  className={`text-xs font-black mt-1 block ${
                    isDatePopoverOpen ? "text-white" : "text-slate-900"
                  }`}
                >
                  {periodLabel}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isDatePopoverOpen ? "rotate-180 text-white" : "text-slate-500"
                }`}
              />
            </button>

            {(filterMode !== "month" ||
              selectedMonth !== initialData.todayDate.slice(0, 7)) && (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                الشهر الحالي
              </button>
            )}

            <div className="hidden md:flex items-center gap-2 pr-3 border-r border-slate-200 text-xs text-slate-500">
              <span>اليوم:</span>
              <strong className="text-slate-800 font-extrabold">
                {data.todayDateFormatted}
              </strong>
            </div>
          </div>

          {/* Left Side: Quick Scanner Triggers (Primary Blue & Success Green) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAttendanceModal(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>مسح الحضور (QR)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-white" />
              <span>تحصيل مصروفات (QR)</span>
            </button>
          </div>

          {/* Expandable Date Filter Drawer (Animated by GSAP) */}
          {isDatePopoverOpen && (
            <div
              ref={dateDrawerRef}
              className="gsap-popover w-full pt-4 mt-1 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-600 ml-1">
                  نطاق التاريخ:
                </span>
                <div className="inline-flex bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleModeChange("month")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      filterMode === "month"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    شهر (الافتراضي)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("year")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      filterMode === "year"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    سنة كاملة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("custom")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      filterMode === "custom"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    مدة محددة (من يوم إلى يوم)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {filterMode === "month" && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">الشهر:</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setSelectedMonth(val);
                        fetchFilteredAnalytics({
                          mode: "month",
                          month: val,
                          targetDate: selectedCalendarDay,
                        });
                      }}
                      className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                )}

                {filterMode === "year" && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">السنة:</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedYear(val);
                        fetchFilteredAnalytics({
                          mode: "year",
                          year: val,
                          targetDate: selectedCalendarDay,
                        });
                      }}
                      className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          سنة {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {filterMode === "custom" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-500">من:</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomStartDate(val);
                          if (val && customEndDate) {
                            fetchFilteredAnalytics({
                              mode: "custom",
                              startDate: val,
                              endDate: customEndDate,
                              targetDate: selectedCalendarDay,
                            });
                          }
                        }}
                        className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-500">إلى:</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomEndDate(val);
                          if (customStartDate && val) {
                            fetchFilteredAnalytics({
                              mode: "custom",
                              startDate: customStartDate,
                              endDate: val,
                              targetDate: selectedCalendarDay,
                            });
                          }
                        }}
                        className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
                  <label className="text-xs font-bold text-slate-500">يوم الغياب:</label>
                  <input
                    type="date"
                    value={selectedCalendarDay}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setSelectedCalendarDay(val);
                      fetchFilteredAnalytics({
                        mode: filterMode,
                        month: selectedMonth,
                        year: selectedYear,
                        startDate: customStartDate,
                        endDate: customEndDate,
                        targetDate: val,
                      });
                    }}
                    className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsDatePopoverOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            SECTION 2: 4 UNIFORM, BREATHABLE KPI CARDS
           =================================================================== */}
        <div
          ref={kpiGridRef}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"
        >
          {/* KPI 1: الطلاب الموجودون بالفعل */}
          <div className="gsap-card bg-white rounded-3xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[152px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-700">
                الطلاب الموجودون بالفعل
              </h3>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                    {data.overall.activeStudents}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-2.5">
                  من إجمالي {data.overall.totalStudents ?? 0} مسجل بالمركز
                </p>
              </div>

              <div className="flex items-end gap-2 h-14 pt-1 shrink-0">
                {card1Bars.map((bar, idx) => (
                  <div
                    key={idx}
                    title={`${bar.label}: ${bar.val} طالب`}
                    className="flex flex-col items-center justify-end h-full group"
                  >
                    <div
                      style={{ height: `${bar.heightPct}%` }}
                      className={`w-3 rounded-t-md transition-all duration-300 relative ${
                        bar.isPeak
                          ? "bg-emerald-500"
                          : "bg-slate-200/80 group-hover:bg-slate-300"
                      }`}
                    >
                      {bar.isPeak && (
                        <>
                          <svg className="w-full h-full rounded-t-md overflow-hidden">
                            <rect
                              width="100%"
                              height="100%"
                              fill="url(#greenStripePattern)"
                            />
                          </svg>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white absolute -top-1 left-1/2 -translate-x-1/2" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI 2: إجمالي الاشتراك الشهري الحالي */}
          <div
            onClick={() => setTrackingTab("overdue")}
            className="gsap-card bg-white rounded-3xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[152px] hover:border-blue-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-700">
                إجمالي الاشتراك الشهري الحالي
              </h3>
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                    {fmtNum(currentMonthlySub)}
                  </span>
                  <span className="text-xs font-extrabold text-slate-500">ج.م</span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-2.5">
                  المحصّل:{" "}
                  <strong className="text-emerald-600">
                    {fmtNum(data.overall.monthlyCollectedRevenue)} ج.م
                  </strong>
                </p>
              </div>

              <div className="w-24 h-14 shrink-0">
                <svg viewBox="0 0 120 65" className="w-full h-full overflow-visible">
                  <path
                    d="M 5 55 C 30 52, 48 14, 78 14 C 95 14, 108 24, 115 28 L 115 60 L 5 60 Z"
                    fill="url(#emeraldAreaGrad)"
                  />
                  <path
                    d="M 5 55 C 30 52, 48 14, 78 14 C 95 14, 108 24, 115 28"
                    fill="none"
                    stroke="var(--theme-success-500)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="78"
                    cy="14"
                    r="4"
                    fill="var(--theme-success-500)"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* KPI 3: عدد الطلاب في كل سنة دراسية */}
          <div
            onClick={() =>
              setSelectedYearCardIdx((prev) =>
                data.byYear.length > 0 ? (prev + 1) % data.byYear.length : 0
              )
            }
            title="اضغط للتنقل بين السنوات الدراسية"
            className="gsap-card bg-white rounded-3xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[152px] hover:border-blue-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-700">
                عدد الطلاب في كل سنة دراسية
              </h3>
              <span className="text-[11px] font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded-full">
                {data.byYear.length > 0
                  ? `صف ${(selectedYearCardIdx % data.byYear.length) + 1} من ${
                      data.byYear.length
                    } ↻`
                  : "0 صفوف"}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                    {activeYearObj
                      ? activeYearObj.activeStudentsCount
                      : data.overall.activeStudents}
                  </span>
                  <span className="text-xs font-extrabold text-slate-500">طالب</span>
                </div>
                <p className="text-xs font-bold text-blue-600 mt-2.5 truncate">
                  {activeYearObj
                    ? `${activeYearObj.year} (${fmtNum(
                        activeYearObj.monthlySubscriptionTotal ??
                          activeYearObj.monthlyExpectedRevenue
                      )} ج.م)`
                    : "جميع الصفوف الدراسية"}
                </p>
              </div>

              <div className="w-24 h-14 shrink-0 flex items-end justify-center">
                <svg viewBox="0 0 100 58" className="w-full h-full overflow-visible">
                  <path
                    d="M 12 50 A 38 38 0 0 1 88 50"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 12 50 A 38 38 0 0 1 88 50"
                    fill="none"
                    stroke="var(--theme-primary-600)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={semiLength}
                    strokeDashoffset={semiDashOffset}
                    className="transition-all duration-500"
                  />
                  <circle
                    cx={knobX}
                    cy={knobY}
                    r="4.5"
                    fill="var(--theme-primary-600)"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* KPI 4: الطلاب الجدد والمغادرون (Green for New, Red for Left, Gray for Neutral) */}
          <div className="gsap-card bg-white rounded-3xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[152px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-700">
                الطلاب الجدد والمغادرون
              </h3>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full truncate max-w-[115px]">
                {periodLabel}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black text-emerald-600 tracking-tight leading-none">
                    +{newStudentsCount}
                  </span>
                  <span className="text-slate-300 font-light text-2xl">/</span>
                  <span className="text-3xl font-black text-red-600 tracking-tight leading-none">
                    -{leftStudentsCount}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-2.5">
                  صافي التغير:{" "}
                  <strong
                    className={
                      netStudentsChange > 0
                        ? "text-emerald-600"
                        : netStudentsChange < 0
                        ? "text-red-600"
                        : "text-slate-600"
                    }
                  >
                    {netStudentsChange >= 0
                      ? `+${netStudentsChange}`
                      : netStudentsChange}
                  </strong>{" "}
                  طالب
                </p>
              </div>

              <div className="flex items-end gap-1.5 h-14 pt-1 shrink-0">
                <div className="w-4 h-9 rounded-md bg-slate-200" />
                <div
                  className="w-4 rounded-md bg-emerald-500"
                  style={{
                    height: `${Math.min(
                      100,
                      Math.max(35, (newStudentsCount + 2) * 14)
                    )}%`,
                  }}
                />
                <div
                  className="w-4 rounded-md relative"
                  style={{
                    height: `${Math.min(
                      100,
                      Math.max(40, (leftStudentsCount + 2) * 16)
                    )}%`,
                  }}
                >
                  <svg className="w-full h-full rounded-md overflow-hidden">
                    <rect width="100%" height="100%" fill="url(#redStripePattern)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            SECTION 3: ASYMMETRIC 2-COLUMN WORKSPACE (8 COLS MAIN + 4 COLS SIDE)
           =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* -----------------------------------------------------------------
              MAIN WORKSPACE (Right in RTL - 8 Columns):
              قائمة الغائبين اليوم + المتأخرون عن الدفع وإجمالي المبلغ المتأخر
             ----------------------------------------------------------------- */}
          <div className="gsap-card lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] space-y-6">
            {/* Segmented Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tab 1: الغائبون اليوم */}
              <button
                type="button"
                onClick={() => setTrackingTab("absent")}
                className={`p-4 sm:p-5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  trackingTab === "absent"
                    ? "bg-red-50/60 border-red-600 ring-2 ring-red-500/10"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-slate-600 block">
                    متابعة الغياب اليومي
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-red-600 leading-none">
                      {absentListRaw.length}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      طالب غائب اليوم
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    حضر{" "}
                    <strong className="text-emerald-600">
                      {data.overall.todayAttendedCount}
                    </strong>{" "}
                    من أصل {data.overall.activeStudents} طالب فعلي
                  </p>
                </div>

                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    trackingTab === "absent"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  <UserX className="w-5 h-5" />
                </div>
              </button>

              {/* Tab 2: المتأخرون عن الدفع */}
              <button
                type="button"
                onClick={() => setTrackingTab("overdue")}
                className={`p-4 sm:p-5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  trackingTab === "overdue"
                    ? "bg-red-50/60 border-red-600 ring-2 ring-red-500/10"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-slate-600 block">
                    المتأخرون عن الدفع ({periodLabel})
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl font-black text-red-600 leading-none">
                      {totalOverdueStudentsCount}
                    </span>
                    <span className="text-xs font-bold text-slate-700">طالب</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-base font-black text-red-600">
                      {fmtNum(totalOverdueAmount)} ج.م
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    إجمالي المبالغ المتأخرة غير المحصّلة
                  </p>
                </div>

                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    trackingTab === "overdue"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                </div>
              </button>
            </div>

            {/* Clean Unified Filter Bar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={trackingSearch}
                    onChange={(e) => setTrackingSearch(e.target.value)}
                    placeholder={
                      trackingTab === "absent"
                        ? "ابحث في الغائبين بالاسم، الكود، أو رقم الهاتف..."
                        : "ابحث في المتأخرين عن السداد بالاسم، الكود، أو الهاتف..."
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Academic Year Select */}
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">جميع السنوات الدراسية</option>
                  {data.byYear.map((yr) => (
                    <option key={yr.year} value={yr.year}>
                      {yr.year}
                    </option>
                  ))}
                </select>

                {/* Group Select */}
                <select
                  value={trackingGroupId}
                  onChange={(e) => setTrackingGroupId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">جميع المجموعات</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                {/* Page Size Select */}
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value={12}>12 / صفحة</option>
                  <option value={25}>25 / صفحة</option>
                  <option value={50}>50 / صفحة</option>
                </select>
              </div>

              {/* Sub-filter & Active Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                {trackingTab === "absent" ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>العدد المطابق للبحث:</span>
                    <strong className="text-red-600 font-extrabold">
                      {filteredAbsentStudents.length} طالب غائب
                    </strong>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "all", label: `الكل (${overdueListRaw.length})` },
                        {
                          id: "unpaid",
                          label: `لم يسدد (${
                            overdueListRaw.filter((s) => s.status === "unpaid").length
                          })`,
                        },
                        {
                          id: "partial",
                          label: `سداد جزئي (${
                            overdueListRaw.filter((s) => s.status === "partial").length
                          })`,
                        },
                      ].map((stTab) => (
                        <button
                          key={stTab.id}
                          type="button"
                          onClick={() => setOverdueStatusFilter(stTab.id as any)}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                            overdueStatusFilter === stTab.id
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200/70 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {stTab.label}
                        </button>
                      ))}
                    </div>

                    <div className="px-3 py-1 rounded-xl bg-red-50 border border-red-200 text-red-600 font-extrabold text-xs">
                      إجمالي المتأخر بالقائمة: {fmtNum(filteredOverdueAmountSum)} ج.م (
                      {filteredOverdueStudents.length} طالب)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Breathable Student Rows Container (Animated by GSAP) */}
            <div
              ref={listContainerRef}
              className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-2xl bg-white"
            >
              {trackingTab === "absent" ? (
                paginatedAbsent.length > 0 ? (
                  paginatedAbsent.map((st) => {
                    const targetPhone = st.parentPhone || st.studentPhone || "";
                    const waMessage = `السلام عليكم ولي أمر الطالب/ة: *${st.name}*\nنحيط علم سيادتكم بغياب الطالب/ة اليوم (${data.todayDateFormatted}) عن حصة مجموعة (${st.groupName} - ${st.academicYear}).\nيرجى المتابعة للاطمئنان، مع خالص التحيات.`;
                    const waUrl = targetPhone
                      ? buildWhatsAppUrl(targetPhone, waMessage)
                      : "";

                    return (
                      <div
                        key={st.id}
                        className="px-4 py-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 border border-red-200/60 font-black text-xs flex items-center justify-center shrink-0">
                            غائب
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/students/${st.id}`}
                                className="text-sm font-extrabold text-slate-800 hover:text-blue-600 truncate"
                              >
                                {st.name}
                              </Link>
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                                {st.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                              <span className="font-semibold text-slate-700">
                                {st.groupName}
                              </span>
                              <span>•</span>
                              <span>{st.academicYear}</span>
                              {targetPhone && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-slate-500">
                                    {targetPhone}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {targetPhone ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all"
                            >
                              <MessageCircle className="w-4 h-4 fill-white/20" />
                              <span>إبلاغ ولي الأمر بالغياب</span>
                            </a>
                          ) : (
                            <Link
                              href={`/students/${st.id}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>إضافة رقم الهاتف</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-16 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-extrabold text-slate-700">
                      لا يوجد طلاب غائبون في هذا التصنيف
                    </p>
                    <p className="text-xs text-slate-500">
                      جميع الطلاب الفعليين مسجل حضورهم أو لا توجد نتائج مطابقة للبحث
                    </p>
                  </div>
                )
              ) : paginatedOverdue.length > 0 ? (
                paginatedOverdue.map((st) => {
                  const targetPhone = st.parentPhone || st.studentPhone || "";
                  const waPaymentMsg = `السلام عليكم ولي أمر الطالب/ة: *${st.name}*\nنود تذكير سيادتكم بسداد قيمة الاشتراك المستحق عن (${periodLabel}) لمجموعة (${st.groupName})، حيث يبلغ المبلغ المتبقي: *${fmtNum(
                    st.remainingAmount
                  )} ج.م*.\nشاكرين حسن تعاونكم معنا.`;
                  const waUrl = targetPhone
                    ? buildWhatsAppUrl(targetPhone, waPaymentMsg)
                    : "";

                  return (
                    <div
                      key={st.id}
                      className="px-4 py-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 ${
                            st.status === "partial"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          ج.م
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/students/${st.id}`}
                              className="text-sm font-extrabold text-slate-800 hover:text-blue-600 truncate"
                            >
                              {st.name}
                            </Link>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                              {st.code}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                st.status === "partial"
                                  ? "bg-slate-100 text-slate-700 border border-slate-200"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              {st.status === "partial" ? "سداد جزئي" : "لم يسدد"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                            <span className="font-semibold text-slate-700">
                              {st.groupName}
                            </span>
                            <span>•</span>
                            <span>{st.academicYear}</span>
                            <span>•</span>
                            <span>
                              المسدد:{" "}
                              <strong className="text-emerald-600">
                                {fmtNum(st.paidAmount)}
                              </strong>{" "}
                              من {fmtNum(st.requiredAmount)} ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-left bg-red-50/80 px-3 py-1.5 rounded-xl border border-red-200/70">
                          <span className="text-[10px] text-red-600 font-bold block">
                            المبلغ المتأخر
                          </span>
                          <span className="text-sm font-black text-red-600">
                            {fmtNum(st.remainingAmount)} ج.م
                          </span>
                        </div>

                        {targetPhone && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>تذكير</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-700">
                    تم تحصيل جميع الاشتراكات بالكامل!
                  </p>
                  <p className="text-xs text-slate-500">
                    لا يوجد طلاب متأخرون عن السداد في هذه الفترة
                  </p>
                </div>
              )}
            </div>

            {/* Pagination Footer (Neutral Gray + Primary Blue) */}
            {activeListLength > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-500">
                <span>
                  عرض{" "}
                  <strong className="text-slate-800">
                    {startIndex + 1}–{Math.min(startIndex + pageSize, activeListLength)}
                  </strong>{" "}
                  من أصل <strong className="text-slate-800">{activeListLength}</strong> طالب
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-bold text-slate-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </button>
                  <span className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-extrabold">
                    صفحة {safePage} من {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-bold text-slate-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* -----------------------------------------------------------------
              SIDE COLUMN (Left in RTL - 4 Columns):
              1. الطلاب في كل سنة دراسية
              2. Compact Royal Blue QR Scanner Card
              3. المجموعات الدراسية السريعة
             ----------------------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-6">
            {/* Widget 1: الطلاب في كل سنة دراسية */}
            <div className="gsap-card bg-white rounded-3xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    الطلاب في كل سنة دراسية
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    اضغط على أي صف لتصفية القوائم
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAcademicYear("all")}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    selectedAcademicYear === "all"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  عرض الكل
                </button>
              </div>

              <div className="space-y-3">
                {data.byYear.length > 0 ? (
                  data.byYear.map((yr) => {
                    const isSelected = selectedAcademicYear === yr.year;
                    return (
                      <div
                        key={yr.year}
                        onClick={() =>
                          setSelectedAcademicYear((prev) =>
                            prev === yr.year ? "all" : yr.year
                          )
                        }
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-600 shadow-2xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200/80"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-700 text-white"
                            }`}
                          >
                            {yr.year}
                          </span>
                          <span className="text-xs font-extrabold text-slate-700">
                            {fmtNum(
                              yr.monthlySubscriptionTotal ?? yr.monthlyExpectedRevenue
                            )}{" "}
                            ج.م / شهر
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between">
                          <h4 className="text-sm font-extrabold text-slate-800">
                            {yr.activeStudentsCount} طالب موجود بالفعل
                          </h4>
                          <span className="text-[11px] font-bold text-slate-500">
                            {yr.groupsCount} مجموعات
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2">
                          <span className="text-emerald-600 font-bold">
                            +{yr.newStudentsCount ?? 0} جديد
                          </span>
                          <span>•</span>
                          <span className="text-red-600 font-bold">
                            -{yr.leftStudentsCount ?? 0} غادر
                          </span>
                          <span>•</span>
                          <span>الإجمالي: {yr.studentsCount}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-400">
                    لا توجد صفوف دراسية مسجلة حتى الآن
                  </div>
                )}
              </div>
            </div>

            {/* Widget 2: Compact Royal Blue QR Scanner Card (Primary Blue + White text) */}
            <div className="gsap-card bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-3xl p-6 shadow-md shadow-blue-600/15 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white">
                  المسح السريع بالكاميرا
                </span>
                <div className="inline-flex bg-white/15 p-1 rounded-full text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFocusScannerMode("attendance")}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      focusScannerMode === "attendance"
                        ? "bg-white text-blue-600 font-extrabold"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    الحضور
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusScannerMode("payment")}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      focusScannerMode === "payment"
                        ? "bg-white text-blue-600 font-extrabold"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    المصروفات
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-extrabold leading-snug text-white">
                    {focusScannerMode === "attendance"
                      ? "تسجيل حضور الطلاب بالـ QR"
                      : "تحصيل اشتراك الشهر بالـ QR"}
                  </h3>
                  <p className="text-xs text-white/90">
                    {focusScannerMode === "attendance"
                      ? `حضر اليوم ${data.overall.todayAttendedCount ?? 0} من ${
                          data.overall.activeStudents ?? 0
                        } طالب فعلي`
                      : `تم تحصيل ${fmtNum(
                          data.overall.monthlyCollectedRevenue
                        )} من ${fmtNum(currentMonthlySub)} ج.م`}
                  </p>
                </div>

                {/* Compact Circular Gauge */}
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
                    <circle
                      cx="55"
                      cy="55"
                      r={focusRingRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="7"
                    />
                    <circle
                      cx="55"
                      cy="55"
                      r={focusRingRadius}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={focusRingCircumference}
                      strokeDashoffset={focusRingOffset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="text-2xl font-black">{focusPercentage}%</span>
                    <span className="text-[10px] text-white/90">
                      {focusScannerMode === "attendance" ? "حضور" : "تحصيل"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  focusScannerMode === "attendance"
                    ? setShowAttendanceModal(true)
                    : setShowPaymentModal(true)
                }
                className="w-full py-3 px-5 bg-white hover:bg-slate-100 text-blue-600 font-extrabold text-xs sm:text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {focusScannerMode === "attendance" ? (
                  <>
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>فتح كاميرا مسح الحضور الآن</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>فتح كاميرا مسح المصروفات الآن</span>
                  </>
                )}
              </button>
            </div>

            {/* Widget 3: المجموعات الدراسية السريعة */}
            <div className="gsap-card bg-white rounded-3xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900">
                  المجموعات الدراسية ({filteredGroups.length})
                </h2>
                <Link
                  href="/groups"
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  إدارة المجموعات
                </Link>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="بحث سريع في المجموعات..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              {filteredGroups.length > 0 ? (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
                  {filteredGroups.map((grp) => (
                    <Link
                      key={grp.id}
                      href={`/students?groupId=${grp.id}`}
                      className="block p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 truncate">
                          {grp.name}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-600 text-white">
                          {grp.activeStudentsCount} طالب
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                        <span className="truncate">{grp.academicYear}</span>
                        <span
                          className={`font-bold ${
                            grp.monthlyCollectionRate >= 50
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          تحصيل {grp.monthlyCollectionRate}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  لا توجد مجموعات مطابقة للبحث
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fast Attendance Modal */}
      {showAttendanceModal && (
        <FastAttendanceScannerModal
          groups={groupsList}
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
