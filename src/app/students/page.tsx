"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  Calendar as CalendarIcon,
  Award,
  Plus,
  ArrowRight,
  Search,
  Check,
  X,
  QrCode,
  Send,
  MessageCircle,
  Camera,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ArrowRightLeft,
  Sparkles,
  Printer,
  ChevronDown,
  Scan,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  Group,
  Student,
  FinancialRecord,
  AttendanceRecord,
  GroupClassSession,
  ExamRecord,
} from "@/lib/types/management";
import StudentProfileModal from "@/components/students/StudentProfileModal";
import CameraQrScannerModal from "@/components/students/CameraQrScannerModal";
import CameraAiGradeModal from "@/components/students/CameraAiGradeModal";
import ContinuousPaymentQrScannerModal from "@/components/students/ContinuousPaymentQrScannerModal";
import ExternalAttendanceModal from "@/components/students/ExternalAttendanceModal";
import WhatsAppBulkDispatcherModal from "@/components/students/WhatsAppBulkDispatcherModal";
import {
  getCachedPageData,
  setCachedPageData,
  invalidateCachedPageData,
  notifyTenantDataMutated,
} from "@/lib/client-session-cache";

const months2026_2027 = [
  { value: "2026-01", label: "يناير ٢٠٢٦" },
  { value: "2026-02", label: "فبراير ٢٠٢٦" },
  { value: "2026-03", label: "مارس ٢٠٢٦" },
  { value: "2026-04", label: "أبريل ٢٠٢٦" },
  { value: "2026-05", label: "مايو ٢٠٢٦" },
  { value: "2026-06", label: "يونيو ٢٠٢٦" },
  { value: "2026-07", label: "يوليو ٢٠٢٦" },
  { value: "2026-08", label: "أغسطس ٢٠٢٦" },
  { value: "2026-09", label: "سبتمبر ٢٠٢٦" },
  { value: "2026-10", label: "أكتوبر ٢٠٢٦" },
  { value: "2026-11", label: "نوفمبر ٢٠٢٦" },
  { value: "2026-12", label: "ديسمبر ٢٠٢٦" },
  { value: "2027-01", label: "يناير ٢٠٢٧" },
  { value: "2027-02", label: "فبراير ٢٠٢٧" },
  { value: "2027-03", label: "مارس ٢٠٢٧" },
  { value: "2027-04", label: "أبريل ٢٠٢٧" },
  { value: "2027-05", label: "مايو ٢٠٢٧" },
  { value: "2027-06", label: "يونيو ٢٠٢٧" },
  { value: "2027-07", label: "يوليو ٢٠٢٧" },
  { value: "2027-08", label: "أغسطس ٢٠٢٧" },
  { value: "2027-09", label: "سبتمبر ٢٠٢٧" },
  { value: "2027-10", label: "أكتوبر ٢٠٢٧" },
  { value: "2027-11", label: "نوفمبر ٢٠٢٧" },
  { value: "2027-12", label: "ديسمبر ٢٠٢٧" },
];

function StudentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get("groupId");
  const initialTab = (searchParams.get("tab") as any) || "students";
  const initialDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const initialMonth = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  // Groups and Selected Group
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Active Tab View: 4 toggles
  const [activeTab, setActiveTab] = useState<"students" | "financials" | "attendance" | "grades">(
    ["students", "financials", "attendance", "grades"].includes(initialTab) ? initialTab : "students"
  );

  // Students Data
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsSearch, setStudentsSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeProfileStudentId, setActiveProfileStudentId] = useState<string | null>(null);

  // Financials State
  const [financialMonth, setFinancialMonth] = useState<string>(initialMonth);
  const [financialRecords, setFinancialRecords] = useState<any[]>([]);
  const [financialFilterSearch, setFinancialFilterSearch] = useState<string>("");
  const [partialAmountInput, setPartialAmountInput] = useState<string>("");
  const [showPartialModal, setShowPartialModal] = useState<boolean>(false);
  const [partialStudentId, setPartialStudentId] = useState<string | null>(null);
  const [isContinuousPaymentOpen, setIsContinuousPaymentOpen] = useState<boolean>(false);

  // Attendance State
  const [attendanceMonth, setAttendanceMonth] = useState<string>(initialMonth);
  const [attendanceDate, setAttendanceDate] = useState<string>(initialDate);
  const [classSessions, setClassSessions] = useState<GroupClassSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isCameraAttendanceOpen, setIsCameraAttendanceOpen] = useState(false);
  const [isExternalAttendanceModalOpen, setIsExternalAttendanceModalOpen] = useState(false);
  const [attendanceFilterSearch, setAttendanceFilterSearch] = useState("");

  // WhatsApp Bulk Dispatcher State
  const [isBulkWhatsAppModalOpen, setIsBulkWhatsAppModalOpen] = useState(false);
  const [bulkWhatsAppAction, setBulkWhatsAppAction] = useState<"qr" | "report" | "parent_check">("qr");

  // Exam Grades State
  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  const [selectedExamRecordId, setSelectedExamRecordId] = useState<string | null>(null);
  const [selectedExamGrades, setSelectedExamGrades] = useState<any[]>([]);
  const [isCreateExamModalOpen, setIsCreateExamModalOpen] = useState(false);
  const [newExamName, setNewExamName] = useState("");
  const [newExamTotalScore, setNewExamTotalScore] = useState<number>(20);
  const [isCameraAiGradeOpen, setIsCameraAiGradeOpen] = useState(false);

  // Student Modals (Create, Edit, Transfer)
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetGroupId, setTransferTargetGroupId] = useState("");
  const [isTransferringHere, setIsTransferringHere] = useState(false);
  const [transferSourceGroupId, setTransferSourceGroupId] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Enhanced Transfer Pool State
  const [transferSearchQuery, setTransferSearchQuery] = useState("");
  const [transferPoolStudents, setTransferPoolStudents] = useState<Student[]>([]);
  const [transferDropdownOpen, setTransferDropdownOpen] = useState(false);
  const [allAvailableStudents, setAllAvailableStudents] = useState<Student[]>([]);

  // Student Form
  const [studentFormData, setStudentFormData] = useState({
    name: "",
    academicYear: "",
    parentPhone: "",
    studentPhone: "",
    monthlyFee: 250,
    status: "active" as "active" | "inactive",
    notes: "",
  });

  const [isLoading, setIsLoading] = useState(true);

  // Synchronize state with URL search params so browser refresh preserves the exact view
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (selectedGroupId) {
      params.set("groupId", selectedGroupId);
    } else {
      params.delete("groupId");
    }
    params.set("tab", activeTab);
    if (activeTab === "attendance" && attendanceDate) {
      params.set("date", attendanceDate);
    } else {
      params.delete("date");
    }
    if (activeTab === "financials" && financialMonth) {
      params.set("month", financialMonth);
    } else {
      params.delete("month");
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [selectedGroupId, activeTab, attendanceDate, financialMonth]);

  // Initial load with 0ms client cache hydration
  useEffect(() => {
    const cachedGroups = getCachedPageData<Group[]>("groups_list");
    if (cachedGroups) {
      setGroups(cachedGroups);
      if (initialGroupId) {
        setSelectedGroup(cachedGroups.find((g) => g.id === initialGroupId) || null);
      }
      setIsLoading(false);
    }
    fetchGroups(Boolean(cachedGroups));
    if (initialGroupId) {
      loadGroupData(initialGroupId);
    }
  }, []);

  useEffect(() => {
    if (initialGroupId && groups.length > 0 && selectedGroupId !== initialGroupId) {
      handleSelectGroup(initialGroupId);
    } else if (selectedGroupId && groups.length > 0) {
      const matched = groups.find((g) => g.id === selectedGroupId) || null;
      if (!selectedGroup || selectedGroup.id !== selectedGroupId || selectedGroup.name !== matched?.name) {
        setSelectedGroup(matched);
      }
    }
  }, [initialGroupId, groups, selectedGroupId]);

  const fetchGroups = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch(`/api/groups?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const list = data.groups || [];
        setGroups(list);
        setCachedPageData("groups_list", list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = groups.find((g) => g.id === groupId) || null;
    setSelectedGroup(grp);
    setSelectedStudentIds([]);
    await loadGroupData(groupId);
  };

  const loadGroupData = async (groupId: string, skipCache = false) => {
    // Hydrate immediately from cache if available
    const cacheKey = `group_bundle:${groupId}:${financialMonth}:${attendanceDate}`;
    if (!skipCache) {
      const cachedBundle = getCachedPageData<{
        students: Student[];
        financials: any[];
        attendance: any[];
        sessions: GroupClassSession[];
        exams: ExamRecord[];
      }>(cacheKey);
      if (cachedBundle) {
        setStudents(cachedBundle.students || []);
        setFinancialRecords(cachedBundle.financials || []);
        setAttendanceRecords(cachedBundle.attendance || []);
        setClassSessions(cachedBundle.sessions || []);
        setExamRecords(cachedBundle.exams || []);
      }
    }

    try {
      const ts = Date.now();
      // Fetch all 4 endpoints in parallel with cache: "no-store"
      const [resStudents, resFin, resAtt, resExams] = await Promise.all([
        fetch(`/api/students?groupId=${groupId}&t=${ts}`, { cache: "no-store" }),
        fetch(`/api/financials?groupId=${groupId}&month=${financialMonth}&t=${ts}`, { cache: "no-store" }),
        fetch(`/api/attendance?groupId=${groupId}&date=${attendanceDate}&t=${ts}`, { cache: "no-store" }),
        fetch(`/api/exam-grades?groupId=${groupId}&t=${ts}`, { cache: "no-store" }),
      ]);

      const [dataStudents, dataFin, dataAtt, dataExams] = await Promise.all([
        resStudents.json(),
        resFin.json(),
        resAtt.json(),
        resExams.json(),
      ]);

      const nextStudents = dataStudents.success ? dataStudents.students || [] : [];
      const nextFin = dataFin.success ? dataFin.financials || [] : [];
      const nextAtt = dataAtt.success ? dataAtt.attendance || [] : [];
      const nextSessions = dataAtt.success ? dataAtt.sessions || [] : [];
      const nextExams = dataExams.success ? dataExams.exams || [] : [];

      if (dataStudents.success) setStudents(nextStudents);
      if (dataFin.success) setFinancialRecords(nextFin);
      if (dataAtt.success) {
        setAttendanceRecords(nextAtt);
        setClassSessions(nextSessions);
      }
      if (dataExams.success) {
        setExamRecords(nextExams);
        const activeExamId =
          selectedExamRecordId && nextExams.some((e: ExamRecord) => e.id === selectedExamRecordId)
            ? selectedExamRecordId
            : nextExams[0]?.id || "";
        if (activeExamId) {
          setSelectedExamRecordId(activeExamId);
          loadExamGrades(activeExamId, groupId);
        } else {
          setSelectedExamRecordId(null);
          setSelectedExamGrades([]);
        }
      }

      setCachedPageData(cacheKey, {
        students: nextStudents,
        financials: nextFin,
        attendance: nextAtt,
        sessions: nextSessions,
        exams: nextExams,
      });
      invalidateCachedPageData("groups_page");
    } catch (err) {
      console.error("Error loading group dashboard data:", err);
    }
  };

  const loadExamGrades = async (examId: string, grpId?: string) => {
    const gid = grpId || selectedGroupId;
    if (!gid) return;
    try {
      const res = await fetch(`/api/exam-grades?groupId=${gid}&examRecordId=${examId}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        setSelectedExamGrades(data.grades || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Re-fetch when month or date changes
  useEffect(() => {
    if (selectedGroupId) {
      fetch(`/api/financials?groupId=${selectedGroupId}&month=${financialMonth}&t=${Date.now()}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((d) => d.success && setFinancialRecords(d.financials || []));
    }
  }, [financialMonth]);

  useEffect(() => {
    if (selectedGroupId) {
      fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setAttendanceRecords(d.attendance || []);
            setClassSessions(d.sessions || []);
          }
        });
    }
  }, [attendanceDate]);

  // Listen to cross-page mutations and window focus so data stays 100% live
  useEffect(() => {
    const onSync = () => {
      fetchGroups(true);
      if (selectedGroupId) {
        loadGroupData(selectedGroupId, true);
      }
    };
    window.addEventListener("tenant-data-mutated", onSync);
    window.addEventListener("focus", onSync);
    return () => {
      window.removeEventListener("tenant-data-mutated", onSync);
      window.removeEventListener("focus", onSync);
    };
  }, [selectedGroupId, financialMonth, attendanceDate, selectedExamRecordId]);

  // ==========================================
  // BULK ACTIONS FOR STUDENTS TAB
  // ==========================================
  const handleSelectAllStudents = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(students.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeactivate = async () => {
    if (selectedStudentIds.length === 0) return;
    try {
      await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkUpdate",
          studentIds: selectedStudentIds,
          updates: { status: "inactive" },
        }),
      });
      notifyTenantDataMutated();
      await loadGroupData(selectedGroupId!, true);
      setSelectedStudentIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedStudentIds.length} طالب نهائياً؟`)) return;
    try {
      await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkDelete",
          studentIds: selectedStudentIds,
        }),
      });
      notifyTenantDataMutated();
      await loadGroupData(selectedGroupId!, true);
      setSelectedStudentIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkPrintQr = () => {
    if (selectedStudentIds.length === 0) return;
    window.location.href = `/qr-printing?groupId=${selectedGroupId}&studentIds=${selectedStudentIds.join(",")}`;
  };

  const handleBulkSendQrWhatsApp = () => {
    if (selectedStudentIds.length === 0) return;
    setBulkWhatsAppAction("qr");
    setIsBulkWhatsAppModalOpen(true);
  };

  const handleBulkSendReportWhatsApp = () => {
    if (selectedStudentIds.length === 0) return;
    setBulkWhatsAppAction("report");
    setIsBulkWhatsAppModalOpen(true);
  };

  const handleBulkCheckParentWhatsApp = () => {
    if (selectedStudentIds.length === 0) return;
    setBulkWhatsAppAction("parent_check");
    setIsBulkWhatsAppModalOpen(true);
  };

  // ==========================================
  // FINANCIALS HANDLERS
  // ==========================================
  const handleUpdateFinancialStatus = async (
    studentId: string,
    status: "paid" | "unpaid" | "returned",
    paidAmount?: number
  ) => {
    if (!selectedGroupId) return;
    const st = students.find((s) => s.id === studentId);
    const totalAmount = st?.monthlyFee || 250;
    const amount = paidAmount !== undefined ? paidAmount : status === "paid" ? totalAmount : 0;

    try {
      await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          groupId: selectedGroupId,
          month: financialMonth,
          status,
          paidAmount: amount,
          totalAmount,
        }),
      });

      // Update local state
      setFinancialRecords((prev) =>
        prev.map((rec) =>
          rec.studentId === studentId
            ? { ...rec, status, paidAmount: amount, totalAmount }
            : rec
        )
      );
      invalidateCachedPageData("group_bundle:");
      notifyTenantDataMutated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkFinancialUpdate = async (status: "paid" | "unpaid" | "returned", partialAmt?: number) => {
    if (selectedStudentIds.length === 0 || !selectedGroupId) return;
    try {
      await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk",
          studentIds: selectedStudentIds,
          groupId: selectedGroupId,
          month: financialMonth,
          status,
          partialPaidAmount: partialAmt,
        }),
      });
      invalidateCachedPageData("group_bundle:");
      notifyTenantDataMutated();
      // Refresh
      const resFin = await fetch(`/api/financials?groupId=${selectedGroupId}&month=${financialMonth}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const dataFin = await resFin.json();
      if (dataFin.success) setFinancialRecords(dataFin.financials || []);
      setSelectedStudentIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFinancialRecord = async (studentId: string) => {
    if (!selectedGroupId || !studentId) return;
    if (!confirm("هل أنت متأكد من حذف هذا السجل المالي لهذا الشهر؟")) return;
    try {
      const res = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          groupId: selectedGroupId,
          studentId,
          month: financialMonth,
        }),
      });
      const data = await res.json();
      if (data.success) {
        invalidateCachedPageData("group_bundle:");
        notifyTenantDataMutated();
        const resFin = await fetch(`/api/financials?groupId=${selectedGroupId}&month=${financialMonth}&t=${Date.now()}`, {
          cache: "no-store",
        });
        const dataFin = await resFin.json();
        if (dataFin.success) setFinancialRecords(dataFin.financials || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // ATTENDANCE HANDLERS
  // ==========================================
  const handleUpdateAttendance = async (studentId: string, status: "attended" | "absent") => {
    if (!selectedGroupId) return;
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: studentId,
          groupId: selectedGroupId,
          date: attendanceDate,
          status,
          method: "manual",
        }),
      });

      setAttendanceRecords((prev) =>
        prev.map((a) => (a.studentId === studentId ? { ...a, status } : a))
      );
      invalidateCachedPageData("group_bundle:");
      notifyTenantDataMutated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkAttendanceUpdate = async (status: "attended" | "absent") => {
    if (selectedStudentIds.length === 0 || !selectedGroupId) return;
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk",
          studentIds: selectedStudentIds,
          groupId: selectedGroupId,
          date: attendanceDate,
          status,
        }),
      });

      invalidateCachedPageData("group_bundle:");
      notifyTenantDataMutated();
      const resAtt = await fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const dataAtt = await resAtt.json();
      if (dataAtt.success) {
        setAttendanceRecords(dataAtt.attendance || []);
        setClassSessions(dataAtt.sessions || []);
      }
      setSelectedStudentIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // EXAM RECORD & GRADES HANDLERS
  // ==========================================
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim() || !selectedGroupId) return;

    try {
      const res = await fetch("/api/exam-grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createExam",
          groupId: selectedGroupId,
          examName: newExamName.trim(),
          totalScore: Number(newExamTotalScore) || 20,
        }),
      });
      const data = await res.json();
      if (data.success && data.exam) {
        invalidateCachedPageData("group_bundle:");
        notifyTenantDataMutated();
        setExamRecords((prev) => [data.exam, ...prev]);
        setSelectedExamRecordId(data.exam.id);
        loadExamGrades(data.exam.id, selectedGroupId);
        setIsCreateExamModalOpen(false);
        setNewExamName("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualGradeEdit = async (studentId: string, score: number) => {
    if (!selectedExamRecordId) return;
    try {
      await fetch("/api/exam-grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveGrade",
          examRecordId: selectedExamRecordId,
          studentIdOrCode: studentId,
          score,
          method: "manual",
        }),
      });

      invalidateCachedPageData("group_bundle:");
      notifyTenantDataMutated();
      setSelectedExamGrades((prev) =>
        prev.map((g) => (g.studentId === studentId ? { ...g, score } : g))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendExamWhatsApp = (gradeItem: any) => {
    const phone = gradeItem.parentPhone?.replace(/\D/g, "");
    if (!phone) {
      alert("رقم هاتف ولي الأمر غير متوفر");
      return;
    }
    const currentExam = examRecords.find((e) => e.id === selectedExamRecordId);
    const msg = `السلام عليكم ورحمة الله،
إشعار بدرجة الطالب: *${gradeItem.studentName}*
في اختبار: *${currentExam?.examName || "الاختبار الدوري"}*
الدرجة الحاصل عليها: *${gradeItem.score}* من *${gradeItem.totalScore}*
المجموعة: ${selectedGroup?.name}
مع تحيات إدارة المادة والمشرف.`;

    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ==========================================
  // STUDENT CREATION & TRANSFER
  // ==========================================
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormData.name.trim() || !selectedGroupId) return;

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingStudent ? editingStudent.id : undefined,
          groupId: selectedGroupId,
          ...studentFormData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCreateStudentModalOpen(false);
        setEditingStudent(null);
        invalidateCachedPageData("group_bundle:");
        invalidateCachedPageData("groups");
        notifyTenantDataMutated();
        await loadGroupData(selectedGroupId, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentFormData({
      name: s.name,
      academicYear: s.academicYear,
      parentPhone: s.parentPhone,
      studentPhone: s.studentPhone,
      monthlyFee: s.monthlyFee,
      status: s.status,
      notes: s.notes || "",
    });
    setIsCreateStudentModalOpen(true);
  };

  const handleDeleteSingleStudent = async (studentId: string) => {
    try {
      await fetch(`/api/students?id=${studentId}`, { method: "DELETE" });
      invalidateCachedPageData("group_bundle:");
      invalidateCachedPageData("groups");
      notifyTenantDataMutated();
      await loadGroupData(selectedGroupId!, true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenTransferModal = async (transferringHere = false) => {
    setIsTransferringHere(transferringHere);
    setTransferSearchQuery("");
    setTransferDropdownOpen(false);

    if (transferringHere) {
      setTransferTargetGroupId(selectedGroupId || "");
      setTransferPoolStudents([]);
    } else {
      setTransferTargetGroupId("");
      // Add currently selected students into pool
      const pool = students.filter((s) => selectedStudentIds.includes(s.id));
      setTransferPoolStudents(pool);
    }
    setIsTransferModalOpen(true);

    // Fetch all students across all groups so user can search and pick anyone
    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (data.success) {
        setAllAvailableStudents(data.students || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferTargetGroupId || transferPoolStudents.length === 0) {
      alert("يرجى اختيار الطلاب والمجموعة الهدف للنقل إليها");
      return;
    }
    try {
      const studentIdsToTransfer = transferPoolStudents.map((s) => s.id);
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          studentIds: studentIdsToTransfer,
          targetGroupId: transferTargetGroupId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsTransferModalOpen(false);
        setTransferPoolStudents([]);
        setSelectedStudentIds([]);
        notifyTenantDataMutated();
        await fetchGroups(true);
        if (selectedGroupId) {
          await loadGroupData(selectedGroupId, true);
        }
      } else {
        alert(data.error || "فشل نقل الطلاب");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء نقل الطلاب");
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedGroupId || !attendanceDate) return;
    if (!confirm(`هل أنت متأكد من محو جلسة يوم (${attendanceDate}) بالكامل وحذف كافة سجلات الحضور لهذا اليوم؟`)) {
      return;
    }
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteSession",
          groupId: selectedGroupId,
          date: attendanceDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notifyTenantDataMutated();
        fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
          cache: "no-store",
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.success) {
              setAttendanceRecords(d.attendance || []);
              setClassSessions(d.sessions || []);
            }
          });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calendar Days generator for the month (e.g. October 2026: 31 days)
  const calendarDays = useMemo(() => {
    const days = [];
    const [yearStr, monthStr] = (attendanceMonth || "2026-10").split("-");
    const year = parseInt(yearStr || "2026", 10);
    const month = parseInt(monthStr || "10", 10);
    const totalDays = new Date(year, month, 0).getDate();

    const arabicDayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayName = arabicDayNames[dateObj.getDay()];
      const hasClass = classSessions.some((s) => s.date === dateStr);
      days.push({
        dayNumber: d,
        date: dateStr,
        dayName,
        hasClass,
      });
    }
    return days;
  }, [attendanceMonth, classSessions]);

  // =========================================================================
  // VIEW 1: GROUPS LIST VIEW (Initial View Requested by User)
  // Display format: Academic Year (H2) – Group Name (H1); Subject and Teacher (H4) below.
  // =========================================================================
  if (!selectedGroupId) {
    return (
      <div className="h-full overflow-y-auto p-6 sm:p-8 lg:p-10 bg-slate-50/60">
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                    قائمة المجموعات المسجلة
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    اختر المجموعة لعرض لوحة تحكم الطلاب، المالية، الحضور ودرجات الامتحانات
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/groups"
              className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all"
            >
              <Users className="w-4 h-4" />
              <span>إدارة وتعديل المجموعات</span>
            </Link>
          </div>

          {/* Groups Grid with Exact User-Requested Typography */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-8 bg-slate-100 rounded w-2/3" />
                  <div className="h-4 bg-slate-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => handleSelectGroup(grp.id)}
                  className="group bg-white rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-blue-400 cursor-pointer flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="space-y-3">
                    {/* H2: Academic Year */}
                    <h2 className="text-xs sm:text-sm font-extrabold text-blue-600 tracking-wide uppercase">
                      {grp.academicYear}
                    </h2>

                    {/* H1: Group Name */}
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">
                      {grp.name}
                    </h1>

                    {/* H4: Subject and Teacher */}
                    <h4 className="text-xs sm:text-sm text-slate-500 font-semibold pt-3 border-t border-slate-100/80 flex items-center justify-between">
                      <span className="text-slate-700 font-bold">{grp.subject}</span>
                      <span className="text-slate-500 font-normal">المعلم: {grp.teacher}</span>
                    </h4>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-600 group-hover:underline flex items-center gap-1.5">
                      <span>فتح لوحة بيانات المجموعة</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180 transition-transform group-hover:-translate-x-1" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-4">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">لا توجد مجموعات مسجلة بعد</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                قم بالانتقال إلى صفحة المجموعات لإنشاء أول مجموعة دراسية
              </p>
              <Link
                href="/groups"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مجموعة الآن</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: GROUP DASHBOARD WITH THE 4 TOGGLE BUTTONS
  // (Group Students, Financials, Attendance, Exam Grades)
  // =========================================================================
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/60">
      <div className="max-w-6xl mx-auto space-y-6 pb-24">
        {/* Top Breadcrumb & Group Info Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-2xs">
          <div className="space-y-1.5">
            <button
              onClick={() => setSelectedGroupId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors mb-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>العودة لجميع المجموعات</span>
            </button>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {selectedGroup?.name}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                {selectedGroup?.academicYear}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap">
              <span>المادة: <strong>{selectedGroup?.subject}</strong></span>
              <span>•</span>
              <span>المعلم: <strong>{selectedGroup?.teacher}</strong></span>
              <span>•</span>
              <span>عدد الطلاب: <strong className="font-mono text-blue-600">{students.length}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/qr-printing?groupId=${selectedGroupId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>طباعة رموز QR</span>
            </Link>
          </div>
        </div>

        {/* 4 TOGGLE BUTTONS ON SAME PAGE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab("students")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "students"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
          >
            <Users className="w-4 h-4" />
            <span>طلاب المجموعة</span>
          </button>

          <button
            onClick={() => setActiveTab("financials")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "financials"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>المالية والاشتراكات</span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "attendance"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>الغياب والحضور</span>
          </button>

          <button
            onClick={() => setActiveTab("grades")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "grades"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
          >
            <Award className="w-4 h-4" />
            <span>درجات الاختبارات</span>
          </button>
        </div>

        {/* =========================================================================
            TOGGLE 1: GROUP STUDENTS VIEW
            ========================================================================= */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {/* Top Action Buttons (Create New Student & Transfer Students Here) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setStudentFormData({
                      name: "",
                      academicYear: selectedGroup?.academicYear || "الصف الثالث الثانوي",
                      parentPhone: "",
                      studentPhone: "",
                      monthlyFee: 250,
                      status: "active",
                      notes: "",
                    });
                    setIsCreateStudentModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء طالب جديد</span>
                </button>

                <button
                  onClick={() => handleOpenTransferModal(true)}
                  className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                  <span>نقل طلاب إلى هنا</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={studentsSearch}
                  onChange={(e) => setStudentsSearch(e.target.value)}
                  placeholder="البحث باسم الطالب أو الكود..."
                  className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            {/* Bulk Actions Floating/Sticky Bar (when items selected) */}
            {selectedStudentIds.length > 0 && (
              <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
                    {selectedStudentIds.length}
                  </span>
                  <span>طالب محدد للإجراء الجماعي:</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    onClick={handleBulkPrintQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>طباعة QR</span>
                  </button>

                  <button
                    onClick={handleBulkSendQrWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>إرسال QR واتساب</span>
                  </button>

                  <button
                    onClick={handleBulkSendReportWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تقرير ولي الأمر</span>
                  </button>

                  <button
                    onClick={handleBulkCheckParentWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors cursor-pointer text-sky-300"
                    title="التحقق من صحة أرقام أولياء الأمور عبر رسالة واتساب"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>فحص رقم ولي الأمر</span>
                  </button>

                  <button
                    onClick={() => handleOpenTransferModal(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>نقل لمجموعة أخرى</span>
                  </button>

                  <button
                    onClick={handleBulkDeactivate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-950 text-amber-300 hover:bg-amber-900 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>تعطيل</span>
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-950 text-red-300 hover:bg-red-900 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            )}

            {/* Students List Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.length === students.length && students.length > 0}
                          onChange={handleSelectAllStudents}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">الكود</th>
                      <th className="p-4">هاتف ولي الأمر</th>
                      <th className="p-4">هاتف الطالب</th>
                      <th className="p-4">قيمة الاشتراك</th>
                      <th className="p-4">الحالة</th>
                      <th className="p-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students
                      .filter(
                        (s) =>
                          s.name.toLowerCase().includes(studentsSearch.toLowerCase()) ||
                          s.code.toLowerCase().includes(studentsSearch.toLowerCase())
                      )
                      .map((student) => {
                        const isSelected = selectedStudentIds.includes(student.id);
                        const isInactive = student.status === "inactive";

                        return (
                          <tr
                            key={student.id}
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isSelected ? "bg-blue-50/40" : isInactive ? "bg-slate-50/50 opacity-75" : ""
                              }`}
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectStudent(student.id)}
                                className="rounded border-slate-300 cursor-pointer"
                              />
                            </td>

                            <td
                              className="p-4 font-bold text-slate-900"
                              onClick={() => router.push(`/students/${student.id}`)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="hover:text-blue-600 transition-colors">{student.name}</span>
                                {isInactive && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold">
                                    معطل
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-4 font-mono font-bold text-slate-600">
                              {student.code}
                            </td>

                            <td className="p-4 font-mono text-slate-700">
                              {student.parentPhone ? (
                                <a
                                  href={`tel:${student.parentPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-blue-600"
                                >
                                  {student.parentPhone}
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>

                            <td className="p-4 font-mono text-slate-500">
                              {student.studentPhone || "-"}
                            </td>

                            <td className="p-4 font-semibold text-slate-700">
                              {student.monthlyFee || 250} ج.م
                            </td>

                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isInactive
                                    ? "bg-slate-200 text-slate-700"
                                    : "bg-emerald-100 text-emerald-800"
                                  }`}
                              >
                                {isInactive ? "منقطع / غير نشط" : "نشط"}
                              </span>
                            </td>

                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => router.push(`/students/${student.id}`)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold cursor-pointer"
                                  title="عرض ملف الطالب"
                                >
                                  الملف
                                </button>
                                <button
                                  onClick={() => handleOpenEditStudent(student)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="تعديل بيانات الطالب"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`حذف الطالب ${student.name}؟`)) {
                                      handleDeleteSingleStudent(student.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="حذف الطالب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {students.length === 0 && (
                <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600">لا يوجد طلاب في هذه المجموعة حتى الآن</p>
                  <p>اضغط على زر &quot;إنشاء طالب جديد&quot; لبدء تسجيل الطلاب</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TOGGLE 2: FINANCIALS VIEW
            ========================================================================= */}
        {activeTab === "financials" && (
          <div className="space-y-4">
            {/* Top Month Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    متابعة الاشتراكات الشهرية
                  </h3>
                  <p className="text-xs text-slate-400">
                    فلترة بالشهور (٢٠٢٦ - ٢٠٢٧)، وتحديد حالات السداد، والمسح المستمر بالباركود
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Continuous Barcode Payment Scanner */}
                <button
                  type="button"
                  onClick={() => setIsContinuousPaymentOpen(true)}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  <span>مسح الباركود والسداد السريع</span>
                </button>

                {/* Search Bar for Financials */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={financialFilterSearch}
                    onChange={(e) => setFinancialFilterSearch(e.target.value)}
                    placeholder="البحث باسم الطالب أو الكود..."
                    className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Month Selector Filter with Arrows (2026-2027) */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">الشهر المالي:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = months2026_2027.findIndex((m) => m.value === financialMonth);
                        if (idx > 0) setFinancialMonth(months2026_2027[idx - 1].value);
                      }}
                      disabled={months2026_2027.findIndex((m) => m.value === financialMonth) === 0}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="الشهر السابق"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-black text-slate-800 min-w-[95px] text-center">
                      {months2026_2027.find((m) => m.value === financialMonth)?.label || financialMonth}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = months2026_2027.findIndex((m) => m.value === financialMonth);
                        if (idx < months2026_2027.length - 1) setFinancialMonth(months2026_2027[idx + 1].value);
                      }}
                      disabled={months2026_2027.findIndex((m) => m.value === financialMonth) === months2026_2027.length - 1}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="الشهر القادم"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Actions for Financials */}
            {selectedStudentIds.length > 0 && (
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs">
                <span>تعديل السداد لـ <strong>{selectedStudentIds.length}</strong> طالب محدد:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBulkFinancialUpdate("paid")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold transition-all cursor-pointer"
                  >
                    تحديد كمدفوع بالكامل
                  </button>
                  <button
                    onClick={() => handleBulkFinancialUpdate("unpaid")}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 font-bold transition-all cursor-pointer"
                  >
                    تحديد كغير مدفوع
                  </button>
                  <button
                    onClick={() => handleBulkFinancialUpdate("returned")}
                    className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold transition-all cursor-pointer"
                  >
                    تحديد كمسترجع
                  </button>
                </div>
              </div>
            )}

            {/* Financials List Table with Color Coded Rows */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.length === financialRecords.length && financialRecords.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(financialRecords.map((f) => f.studentId));
                            } else {
                              setSelectedStudentIds([]);
                            }
                          }}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">حالة السداد (سريع)</th>
                      <th className="p-4">المبلغ المستحق</th>
                      <th className="p-4">المدفوع حالياً</th>
                      <th className="p-4">المتبقي</th>
                      <th className="p-4 text-center">تغيير الحالة</th>
                      <th className="p-4 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {financialRecords
                      .filter((fin) => {
                        if (!financialFilterSearch.trim()) return true;
                        const q = financialFilterSearch.toLowerCase();
                        return (
                          (fin.studentName || "").toLowerCase().includes(q) ||
                          (fin.studentCode || "").toLowerCase().includes(q)
                        );
                      })
                      .map((fin) => {
                        const isPaid = fin.status === "paid" && fin.paidAmount >= fin.totalAmount;
                        const isPartial = fin.status === "paid" && fin.paidAmount > 0 && fin.paidAmount < fin.totalAmount;
                        const isReturned = fin.status === "returned";
                        const isUnpaid = fin.status === "unpaid" || (!isPaid && !isPartial && !isReturned);
                        const isSelected = selectedStudentIds.includes(fin.studentId);
                        const remaining = Math.max(0, fin.totalAmount - fin.paidAmount);

                        const rowColorClass = isPaid
                          ? "bg-emerald-50/70 hover:bg-emerald-50 text-emerald-950"
                          : isPartial
                            ? "bg-[#faf0e6] hover:bg-[#f5e6d3] text-amber-950"
                            : isReturned
                              ? "bg-slate-100/80 hover:bg-slate-100 text-slate-700"
                              : "bg-red-50/70 hover:bg-red-50 text-red-950";

                        return (
                          <tr
                            key={fin.id || fin.studentId}
                            className={`transition-colors cursor-pointer border-b border-slate-100/60 ${rowColorClass} ${isSelected ? "ring-2 ring-blue-500/50" : ""
                              }`}
                            onClick={() => router.push(`/students/${fin.studentId}`)}
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectStudent(fin.studentId)}
                                className="rounded border-slate-300 cursor-pointer"
                              />
                            </td>

                            <td className="p-4 font-bold">
                              <div className="flex items-center gap-2">
                                <span>{fin.studentName}</span>
                                {isPartial && (
                                  <span className="text-[10px] font-black bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300/80">
                                    سداد جزئي: {fin.paidAmount} ج.م
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Two check status buttons beside name (paid & unpaid for the selected month) */}
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFinancialStatus(fin.studentId, "paid")}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${isPaid
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-white/80 hover:bg-white text-emerald-700 border border-emerald-200"
                                    }`}
                                >
                                  <Check className="w-3 h-3" />
                                  <span>مدفوع</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateFinancialStatus(fin.studentId, "unpaid")}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${isUnpaid
                                      ? "bg-red-600 text-white shadow-xs"
                                      : "bg-white/80 hover:bg-white text-red-700 border border-red-200"
                                    }`}
                                >
                                  <X className="w-3 h-3" />
                                  <span>غير مدفوع</span>
                                </button>
                              </div>
                            </td>

                            <td className="p-4 font-mono font-bold">
                              {fin.totalAmount} ج.م
                            </td>

                            <td className="p-4 font-mono font-bold">
                              {fin.paidAmount} ج.م
                            </td>

                            <td className="p-4 font-mono font-bold text-slate-700">
                              {remaining > 0 ? `${remaining} ج.م` : "٠ ج.م"}
                            </td>

                            {/* Action Menu (paid, unpaid, returned, partial) */}
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1 text-[11px]">
                                <button
                                  onClick={() => {
                                    setPartialStudentId(fin.studentId);
                                    setPartialAmountInput(String(fin.paidAmount || "150"));
                                    setShowPartialModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold transition-colors cursor-pointer"
                                  title="تسجيل مبلغ جزئي"
                                >
                                  دفع جزئي
                                </button>

                                <button
                                  onClick={() => handleUpdateFinancialStatus(fin.studentId, "returned")}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                                >
                                  مسترجع
                                </button>
                              </div>
                            </td>

                            {/* Delete Action */}
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleDeleteFinancialRecord(fin.studentId)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف السجل المالي لهذا الشهر"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TOGGLE 3: ATTENDANCE & ABSENCE VIEW
            ========================================================================= */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            {/* Top Month Calendar View with (green & default color) days
                Green days refer that a class was created on that day.
                Clicking a day changes the attendance date view!
            */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">
                      تقويم الحصص والحضور الشهري
                    </h3>
                    <p className="text-xs text-slate-400">
                      الأيام الملونة بالأخضر توضح أيام الحصص الدراسية المنشأة. انقر على أي يوم لعرض وتعديل قائمة الطلاب.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Month Selector for Attendance with Arrows */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
                    <span className="text-xs font-bold text-slate-500">الشهر:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const idx = months2026_2027.findIndex((m) => m.value === attendanceMonth);
                          if (idx > 0) {
                            const newM = months2026_2027[idx - 1].value;
                            setAttendanceMonth(newM);
                            setAttendanceDate(`${newM}-01`);
                          }
                        }}
                        disabled={months2026_2027.findIndex((m) => m.value === attendanceMonth) === 0}
                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="الشهر السابق"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-slate-800 min-w-[95px] text-center">
                        {months2026_2027.find((m) => m.value === attendanceMonth)?.label || attendanceMonth}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = months2026_2027.findIndex((m) => m.value === attendanceMonth);
                          if (idx < months2026_2027.length - 1) {
                            const newM = months2026_2027[idx + 1].value;
                            setAttendanceMonth(newM);
                            setAttendanceDate(`${newM}-01`);
                          }
                        }}
                        disabled={months2026_2027.findIndex((m) => m.value === attendanceMonth) === months2026_2027.length - 1}
                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="الشهر القادم"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      <span>يوم حصة</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-3 rounded-full bg-slate-200 inline-block" />
                      <span>أيام أخرى</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar Grid of Days */}
              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-2">
                {calendarDays.map((d) => {
                  const isSelectedDay = d.date === attendanceDate;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setAttendanceDate(d.date)}
                      className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer relative ${isSelectedDay
                          ? "ring-2 ring-indigo-600 shadow-sm"
                          : ""
                        } ${d.hasClass
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white font-black"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                        }`}
                      title={d.hasClass ? `يوم حصة (${d.dayName}): ${d.date}` : `${d.dayName}: ${d.date}`}
                    >
                      <span className={`text-[10px] leading-tight font-medium ${d.hasClass ? "text-emerald-100" : "text-slate-500"}`}>
                        {d.dayName}
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-bold">{d.dayNumber}</span>
                      {d.hasClass && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day View Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => setIsCameraAttendanceOpen(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>تسجيل الحضور بالكاميرا و QR</span>
                </button>

                {/* External Student Attendance Button */}
                <button
                  type="button"
                  onClick={() => setIsExternalAttendanceModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>تسجيل حضور لطالب خارج المجموعة</span>
                </button>

                {/* Create / Confirm Session Button */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("/api/attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "createSession",
                          groupId: selectedGroupId,
                          date: attendanceDate,
                          title: "حصة دراسية",
                        }),
                      });
                      notifyTenantDataMutated();
                      fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
                        cache: "no-store",
                      })
                        .then((r) => r.json())
                        .then((d) => {
                          if (d.success) {
                            setAttendanceRecords(d.attendance || []);
                            setClassSessions(d.sessions || []);
                          }
                        });
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="تثبيت أن اليوم يوم حصة دراسية حتى وإن غاب الجميع"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تثبيت حصة اليوم ({attendanceDate})</span>
                </button>

                {/* Clear / Delete Session Button */}
                <button
                  type="button"
                  onClick={handleDeleteSession}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="محو جلسة هذا اليوم وسجلاتها بالكامل"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>محو جلسة هذا اليوم</span>
                </button>
              </div>

              {/* Search Bar by student filter */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={attendanceFilterSearch}
                  onChange={(e) => setAttendanceFilterSearch(e.target.value)}
                  placeholder="البحث باسم الطالب أو الكود..."
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Waiting State: If session does not exist / records empty */}
            {attendanceRecords.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <CalendarIcon className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="text-base font-bold text-slate-800">
                    لم يتم تثبيت جلسة حضور لتاريخ ({attendanceDate})
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    الجدول فارغ بانتظار اتخاذ الإجراء. اضغط على زر &quot;تثبيت حصة اليوم&quot; لإنشاء الجلسة وتعبئة قائمة طلاب المجموعة فوراً لتسجيل الحضور.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await fetch("/api/attendance", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "createSession",
                            groupId: selectedGroupId,
                            date: attendanceDate,
                            title: "حصة دراسية",
                          }),
                        });
                        fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}`)
                          .then((r) => r.json())
                          .then((d) => {
                            if (d.success) {
                              setAttendanceRecords(d.attendance || []);
                              setClassSessions(d.sessions || []);
                            }
                          });
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تثبيت حصة اليوم ({attendanceDate})</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Bulk Attendance Bar */}
                {selectedStudentIds.length > 0 && (
                  <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between text-xs">
                    <span>تعديل حالة الحضور لـ <strong>{selectedStudentIds.length}</strong> طالب محدد:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBulkAttendanceUpdate("attended")}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold transition-all cursor-pointer"
                      >
                        تحديد كحاضر
                      </button>
                      <button
                        onClick={() => handleBulkAttendanceUpdate("absent")}
                        className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 font-bold transition-all cursor-pointer"
                      >
                        تحديد كغائب
                      </button>
                    </div>
                  </div>
                )}

                {/* Day Students Attendance Table */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                          <th className="p-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.length === attendanceRecords.length && attendanceRecords.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds(attendanceRecords.map((a) => a.studentId));
                                } else {
                                  setSelectedStudentIds([]);
                                }
                              }}
                              className="rounded border-slate-300 cursor-pointer"
                            />
                          </th>
                          <th className="p-4">اسم الطالب</th>
                          <th className="p-4">كود الطالب</th>
                          <th className="p-4">الحالة المسجلة</th>
                          <th className="p-4">وقت التسجيل</th>
                          <th className="p-4">طريقة التسجيل</th>
                          <th className="p-4 text-center">تغيير الحالة (حاضر / غائب)</th>
                          <th className="p-4 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceRecords
                          .filter(
                            (a) =>
                              a.studentName.toLowerCase().includes(attendanceFilterSearch.toLowerCase()) ||
                              a.code.toLowerCase().includes(attendanceFilterSearch.toLowerCase())
                          )
                          .map((att) => {
                            const isAttended = att.status === "attended";
                            const isSelected = selectedStudentIds.includes(att.studentId);

                            return (
                              <tr
                                key={att.studentId}
                                className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isAttended ? "bg-emerald-50/30" : "bg-red-50/20"
                                  } ${isSelected ? "ring-2 ring-indigo-500/50" : ""}`}
                                onClick={() => router.push(`/students/${att.studentId}`)}
                              >
                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectStudent(att.studentId)}
                                    className="rounded border-slate-300 cursor-pointer"
                                  />
                                </td>

                                <td className="p-4 font-bold text-slate-900">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span>{att.studentName}</span>
                                    {att.isExternal && (
                                      <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                                        من مجموعة أخرى {att.originGroupName ? `(${att.originGroupName})` : ""}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-4 font-mono font-bold text-slate-600">
                                  {att.code}
                                </td>

                                <td className="p-4">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${isAttended
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-red-100 text-red-800"
                                      }`}
                                  >
                                    {isAttended ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>حاضر</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3 text-red-500" />
                                        <span>غائب</span>
                                      </>
                                    )}
                                  </span>
                                </td>

                                <td className="p-4 font-mono text-slate-500">
                                  {att.time || "-"}
                                </td>

                                <td className="p-4 text-slate-500">
                                  {att.method === "camera_qr" ? (
                                    <span className="text-blue-600 font-bold">مسح كاميرا QR</span>
                                  ) : isAttended ? (
                                    "تسجيل يدوي"
                                  ) : (
                                    "-"
                                  )}
                                </td>

                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAttendance(att.studentId, "attended")}
                                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${isAttended
                                          ? "bg-emerald-600 text-white"
                                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                        }`}
                                    >
                                      حاضر
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAttendance(att.studentId, "absent")}
                                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${!isAttended
                                          ? "bg-red-600 text-white"
                                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                        }`}
                                    >
                                      غائب
                                    </button>
                                  </div>
                                </td>

                                {/* Delete single attendance row */}
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm(`حذف سجل حضور الطالب ${att.studentName} لهذا اليوم؟`)) {
                                        await fetch("/api/attendance", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            action: "deleteStudentAttendance",
                                            groupId: selectedGroupId,
                                            studentId: att.studentId,
                                            date: attendanceDate,
                                          }),
                                        });
                                        notifyTenantDataMutated();
                                        fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
                                          cache: "no-store",
                                        })
                                          .then((r) => r.json())
                                          .then((d) => d.success && setAttendanceRecords(d.attendance || []));
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="حذف سجل الحضور"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            TOGGLE 4: EXAM GRADES VIEW
            ========================================================================= */}
        {activeTab === "grades" && (
          <div className="space-y-6">
            {/* Header / Create Exam Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    رصد درجات الاختبارات والامتحانات
                  </h3>
                  <p className="text-xs text-slate-400">
                    إنشاء سجلات الاختبارات ورصد الدرجات تلقائياً عبر كاميرا الذكاء الاصطناعي أو يدوياً
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateExamModalOpen(true)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء سجل اختبار جديد</span>
              </button>
            </div>

            {/* Recorded Exams List / Selector */}
            {examRecords.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {examRecords.map((exam) => {
                    const isSelected = exam.id === selectedExamRecordId;
                    return (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => {
                          setSelectedExamRecordId(exam.id);
                          loadExamGrades(exam.id);
                        }}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 border ${isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{exam.examName}</span>
                        <span className={`font-mono px-1.5 py-0.5 rounded-md text-[10px] ${isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                          {exam.totalScore} د
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Exam Dashboard */}
                {selectedExamRecordId && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsCameraAiGradeOpen(true)}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-white" />
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          <span>تسجيل درجات الاختبار بالكاميرا (AI OCR)</span>
                        </button>

                        <span className="text-xs text-slate-500">
                          الدرجة تأتي تلقائياً من الكاميرا أو يمكنك تعديلها يدوياً أدناه
                        </span>
                      </div>
                    </div>

                    {/* Students Grades Table */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <tr>
                              <th className="p-4">اسم الطالب</th>
                              <th className="p-4">الكود</th>
                              <th className="p-4">الدرجة المرصودة</th>
                              <th className="p-4">الدرجة الكلية</th>
                              <th className="p-4">النسبة المئوية</th>
                              <th className="p-4">طريقة الرصد</th>
                              <th className="p-4 text-center">إشعار ولي الأمر (واتساب)</th>
                              <th className="p-4 text-center">حذف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedExamGrades.map((gradeItem) => {
                              const hasScore = gradeItem.score !== null && gradeItem.score !== undefined;
                              const percentage = hasScore ? Math.round((gradeItem.score / gradeItem.totalScore) * 100) : 0;

                              return (
                                <tr
                                  key={gradeItem.studentId}
                                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                  onClick={() => router.push(`/students/${gradeItem.studentId}`)}
                                >
                                  <td className="p-4 font-bold text-slate-900">
                                    {gradeItem.studentName}
                                  </td>

                                  <td className="p-4 font-mono font-bold text-slate-600">
                                    {gradeItem.code}
                                  </td>

                                  {/* Editable or Displayed Score */}
                                  <td className="p-4 font-mono font-bold" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        step="0.5"
                                        max={gradeItem.totalScore}
                                        min={0}
                                        value={hasScore ? gradeItem.score : ""}
                                        placeholder="غير مرصود"
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          if (!isNaN(val)) {
                                            handleManualGradeEdit(gradeItem.studentId, val);
                                          }
                                        }}
                                        className="w-20 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                      />
                                      <span className="text-[11px] text-slate-400">/ {gradeItem.totalScore}</span>
                                    </div>
                                  </td>

                                  <td className="p-4 font-mono text-slate-600">
                                    {gradeItem.totalScore}
                                  </td>

                                  <td className="p-4 font-bold">
                                    {hasScore ? (
                                      <span
                                        className={`px-2 py-0.5 rounded-md font-mono ${percentage >= 85
                                            ? "bg-emerald-100 text-emerald-800"
                                            : percentage >= 65
                                              ? "bg-blue-100 text-blue-800"
                                              : "bg-red-100 text-red-800"
                                          }`}
                                      >
                                        {percentage}%
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </td>

                                  <td className="p-4 text-slate-500">
                                    {gradeItem.method === "camera_ai" ? (
                                      <span className="text-blue-600 font-bold flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        <span>AI كاميرا</span>
                                      </span>
                                    ) : hasScore ? (
                                      "رصد يدوي"
                                    ) : (
                                      "-"
                                    )}
                                  </td>

                                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleSendExamWhatsApp(gradeItem)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-2xs cursor-pointer"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span>إرسال واتساب</span>
                                    </button>
                                  </td>

                                  {/* Delete single grade row */}
                                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`حذف درجة الطالب ${gradeItem.studentName} من هذا الاختبار؟`)) {
                                          await fetch("/api/exam-grades", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              action: "deleteGrade",
                                              examRecordId: selectedExamRecordId,
                                              studentId: gradeItem.studentId,
                                            }),
                                          });
                                          notifyTenantDataMutated();
                                          if (selectedExamRecordId) {
                                            loadExamGrades(selectedExamRecordId);
                                          }
                                        }
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      title="حذف درجة الطالب"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3">
                <Award className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700">لا توجد سجلات اختبارات لهذه المجموعة</h4>
                <p className="text-xs text-slate-400">
                  اضغط على زر &quot;إنشاء سجل اختبار جديد&quot; للبدء في رصد درجات الطلاب بالكاميرا أو يدوياً
                </p>
                <button
                  onClick={() => setIsCreateExamModalOpen(true)}
                  className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء سجل اختبار</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            MODALS
            ========================================================================= */}

        {/* 1. Student Profile Modal */}
        {activeProfileStudentId && (
          <StudentProfileModal
            studentId={activeProfileStudentId}
            onClose={() => setActiveProfileStudentId(null)}
            onUpdate={() => {
              notifyTenantDataMutated();
              loadGroupData(selectedGroupId, true);
            }}
            onEditStudent={(st) => handleOpenEditStudent(st)}
            onDeleteStudent={(stId) => handleDeleteSingleStudent(stId)}
          />
        )}

        {/* 2. Camera QR Attendance Modal */}
        {isCameraAttendanceOpen && (
          <CameraQrScannerModal
            groupId={selectedGroupId}
            groupName={selectedGroup?.name || "المجموعة"}
            date={attendanceDate}
            students={students}
            onClose={() => setIsCameraAttendanceOpen(false)}
            onAttendanceRecorded={() => {
              notifyTenantDataMutated();
              fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
                cache: "no-store",
              })
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) {
                    setAttendanceRecords(d.attendance || []);
                    setClassSessions(d.sessions || []);
                  }
                });
            }}
          />
        )}

        {/* 3. Camera AI Grade OCR Modal */}
        {isCameraAiGradeOpen && selectedExamRecordId && (
          <CameraAiGradeModal
            groupId={selectedGroupId}
            examRecordId={selectedExamRecordId}
            examName={examRecords.find((e) => e.id === selectedExamRecordId)?.examName || "الاختبار"}
            totalScore={examRecords.find((e) => e.id === selectedExamRecordId)?.totalScore || 20}
            students={students}
            onClose={() => setIsCameraAiGradeOpen(false)}
            onGradeRecorded={() => {
              notifyTenantDataMutated();
              loadExamGrades(selectedExamRecordId);
            }}
          />
        )}

        {/* 3.5. Continuous Payment QR / Barcode Scanner Modal */}
        {isContinuousPaymentOpen && (
          <ContinuousPaymentQrScannerModal
            groupId={selectedGroupId || ""}
            month={financialMonth}
            students={students}
            onClose={() => setIsContinuousPaymentOpen(false)}
            onPaymentRecorded={() => {
              notifyTenantDataMutated();
              if (selectedGroupId) {
                fetch(`/api/financials?groupId=${selectedGroupId}&month=${financialMonth}&t=${Date.now()}`, {
                  cache: "no-store",
                })
                  .then((r) => r.json())
                  .then((d) => d.success && setFinancialRecords(d.financials || []));
              }
            }}
          />
        )}

        {/* 4. Create / Edit Student Modal */}
        {isCreateStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">
                      {editingStudent ? "تعديل بيانات الطالب" : "إنشاء طالب جديد"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      إضافة طالب إلى {selectedGroup?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateStudentModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">اسم الطالب الثلاثي أو الرباعي *</label>
                  <input
                    type="text"
                    required
                    value={studentFormData.name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                    placeholder="مثال: أحمد مصطفى كامل"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">رقم هاتف ولي الأمر (واتساب)</label>
                    <input
                      type="text"
                      value={studentFormData.parentPhone}
                      onChange={(e) => setStudentFormData({ ...studentFormData, parentPhone: e.target.value })}
                      placeholder="01012345678"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">رقم هاتف الطالب</label>
                    <input
                      type="text"
                      value={studentFormData.studentPhone}
                      onChange={(e) => setStudentFormData({ ...studentFormData, studentPhone: e.target.value })}
                      placeholder="01112345678"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">قيمة الاشتراك الشهري (ج.م)</label>
                    <input
                      type="number"
                      value={studentFormData.monthlyFee}
                      onChange={(e) => setStudentFormData({ ...studentFormData, monthlyFee: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">حالة الطالب</label>
                    <select
                      value={studentFormData.status}
                      onChange={(e) => setStudentFormData({ ...studentFormData, status: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer"
                    >
                      <option value="active">نشط ومسجل</option>
                      <option value="inactive">معطل / منقطع (محفوظ بالسجل)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">ملاحظات إضافية</label>
                  <textarea
                    rows={2}
                    value={studentFormData.notes}
                    onChange={(e) => setStudentFormData({ ...studentFormData, notes: e.target.value })}
                    placeholder="أي ملاحظات حول المستوى الأكاديمي أو المواعيد..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateStudentModalOpen(false)}
                    className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    {editingStudent ? "حفظ التعديلات" : "إنشاء الطالب"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. Enhanced Simplified Transfer Modal: Search by Student Name & Multi-Select */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-800">
                      نقل الطلاب بين المجموعات الدراسية
                    </h3>
                    <p className="text-xs text-slate-400">
                      ابحث عن الطلاب بالاسم وحدد من تريد نقلهم ثم اختر المجموعة الهدف
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
                {/* Search Bar */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    البحث عن طالب بالاسم أو الكود لتحديده:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={transferSearchQuery}
                      onChange={(e) => setTransferSearchQuery(e.target.value)}
                      placeholder="اكتب اسم الطالب للبحث..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Available Students Results List with Details & Multi-Select Checkboxes */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 font-bold">
                    <span>نتائج الطلاب المتاحين:</span>
                    <span>
                      انقر على الطالب لتحديده أو إلغاء تحديده
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {(allAvailableStudents.length > 0 ? allAvailableStudents : students)
                      .filter((s) => {
                        if (!transferSearchQuery.trim()) return true;
                        const q = transferSearchQuery.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) ||
                          s.code.toLowerCase().includes(q)
                        );
                      })
                      .map((s) => {
                        const isSelected = transferPoolStudents.some((p) => p.id === s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (isSelected) {
                                setTransferPoolStudents((prev) => prev.filter((p) => p.id !== s.id));
                              } else {
                                setTransferPoolStudents((prev) => [...prev, s]);
                              }
                            }}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }} // handled by parent div
                                className="rounded border-slate-300 pointer-events-none"
                              />
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-xs">{s.name}</span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  <span className="font-semibold text-blue-600">{s.academicYear}</span>
                                  <span>•</span>
                                  <span>المجموعة الحالية: <strong className="text-slate-700">{s.groupName || "غير محدد"}</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                                {s.code}
                              </span>
                              {isSelected ? (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  محدد للنقل ✓
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400">
                                  اختر
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Selected Students Pool Count & Chips */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      الطلاب المختارون للنقل (
                      <strong className="text-blue-600 font-mono">{transferPoolStudents.length}</strong> طالب):
                    </label>
                    {transferPoolStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTransferPoolStudents([])}
                        className="text-[11px] text-red-600 hover:underline font-bold cursor-pointer"
                      >
                        مسح الكل
                      </button>
                    )}
                  </div>

                  {transferPoolStudents.length > 0 ? (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {transferPoolStudents.map((s) => (
                        <div
                          key={s.id}
                          className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xs text-xs"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{s.name}</span>
                            <span className="text-[9px] text-slate-400">
                              {s.academicYear} {s.groupName ? `• ${s.groupName}` : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferPoolStudents((prev) => prev.filter((p) => p.id !== s.id));
                            }}
                            className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      لم يتم اختيار أي طالب بعد. ابحث عن اسم الطالب وحدده من القائمة أعلاه.
                    </div>
                  )}
                </div>

                {/* Target Group Selection */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">
                    المجموعة المنقول إليها (الهدف) *:
                  </label>
                  <select
                    value={transferTargetGroupId}
                    onChange={(e) => setTransferTargetGroupId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">اختر المجموعة المنقول إليها...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.academicYear})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs font-bold">
                <span className="text-slate-500">
                  سيتم نقل <strong className="text-blue-600 font-mono">{transferPoolStudents.length}</strong> طالب
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={transferPoolStudents.length === 0 || !transferTargetGroupId}
                    onClick={handleTransferSubmit}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer font-bold"
                  >
                    تأكيد نقل الطلاب ({transferPoolStudents.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. Partial Amount Modal */}
        {showPartialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800">
                تسجيل سداد جزئي للاشتراك الشهري
              </h4>
              <p className="text-xs text-slate-500">
                أدخل المبلغ الفعلي المدفوع وسيتم تسجيله كسداد جزئي لهذا الشهر
              </p>
              <input
                type="number"
                value={partialAmountInput}
                onChange={(e) => setPartialAmountInput(e.target.value)}
                placeholder="المبلغ المدفوع (مثال: 150)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex items-center justify-end gap-2 text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setShowPartialModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (partialStudentId) {
                      handleUpdateFinancialStatus(
                        partialStudentId,
                        "paid",
                        Number(partialAmountInput) || 0
                      );
                    }
                    setShowPartialModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  حفظ السداد الجزئي
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Create Exam Modal */}
        {isCreateExamModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-800">
                    إنشاء سجل اختبار جديد
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateExamModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">عنوان الاختبار *</label>
                  <input
                    type="text"
                    required
                    value={newExamName}
                    onChange={(e) => setNewExamName(e.target.value)}
                    placeholder="مثال: اختبار الفصل الأول أو امتحان نصف الشهر"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">الدرجة الكلية / العظمى للاختبار *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newExamTotalScore}
                    onChange={(e) => setNewExamTotalScore(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 font-bold">
                  <button
                    type="button"
                    onClick={() => setIsCreateExamModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm cursor-pointer"
                  >
                    إنشاء السجل
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 8. External Attendance Modal (for registering attendance for a student from outside the group) */}
        {isExternalAttendanceModalOpen && selectedGroupId && (
          <ExternalAttendanceModal
            isOpen={isExternalAttendanceModalOpen}
            onClose={() => setIsExternalAttendanceModalOpen(false)}
            targetGroupId={selectedGroupId}
            currentGroupId={selectedGroupId}
            targetGroupName={selectedGroup?.name || ""}
            currentGroupName={selectedGroup?.name || ""}
            attendanceDate={attendanceDate}
            date={attendanceDate}
            onAttendanceMarked={() => {
              notifyTenantDataMutated();
              fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
                cache: "no-store",
              })
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) {
                    setAttendanceRecords(d.attendance || []);
                    setClassSessions(d.sessions || []);
                  }
                });
            }}
            onSuccess={() => {
              notifyTenantDataMutated();
              fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}&t=${Date.now()}`, {
                cache: "no-store",
              })
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) {
                    setAttendanceRecords(d.attendance || []);
                    setClassSessions(d.sessions || []);
                  }
                });
            }}
          />
        )}

        {/* 9. WhatsApp Sequential Bulk Dispatcher Modal (prevents multitab opening clutter) */}
        {isBulkWhatsAppModalOpen && (
          <WhatsAppBulkDispatcherModal
            isOpen={isBulkWhatsAppModalOpen}
            onClose={() => setIsBulkWhatsAppModalOpen(false)}
            students={students.filter((s) => selectedStudentIds.includes(s.id))}
            groupName={selectedGroup?.name || ""}
            actionType={bulkWhatsAppAction}
          />
        )}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center p-8 bg-slate-50/60">
          <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>جاري تحميل بيانات الطلاب والمجموعات...</span>
          </div>
        </div>
      }
    >
      <StudentsPageContent />
    </Suspense>
  );
}
