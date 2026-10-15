"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function StudentsPageContent() {
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get("groupId");

  // Groups and Selected Group
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Active Tab View: 4 toggles
  const [activeTab, setActiveTab] = useState<"students" | "financials" | "attendance" | "grades">("students");

  // Students Data
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsSearch, setStudentsSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeProfileStudentId, setActiveProfileStudentId] = useState<string | null>(null);

  // Financials State
  const [financialMonth, setFinancialMonth] = useState<string>("2026-10");
  const [financialRecords, setFinancialRecords] = useState<any[]>([]);
  const [partialAmountInput, setPartialAmountInput] = useState<string>("");
  const [showPartialModal, setShowPartialModal] = useState<boolean>(false);
  const [partialStudentId, setPartialStudentId] = useState<string | null>(null);

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState<string>("2026-10-14");
  const [classSessions, setClassSessions] = useState<GroupClassSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isCameraAttendanceOpen, setIsCameraAttendanceOpen] = useState(false);
  const [attendanceFilterSearch, setAttendanceFilterSearch] = useState("");

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

  // Initial load
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (initialGroupId && groups.length > 0) {
      handleSelectGroup(initialGroupId);
    }
  }, [initialGroupId, groups]);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
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

  const loadGroupData = async (groupId: string) => {
    try {
      // 1. Fetch Students
      const resStudents = await fetch(`/api/students?groupId=${groupId}`);
      const dataStudents = await resStudents.json();
      if (dataStudents.success) {
        setStudents(dataStudents.students || []);
      }

      // 2. Fetch Financials for current month
      const resFin = await fetch(`/api/financials?groupId=${groupId}&month=${financialMonth}`);
      const dataFin = await resFin.json();
      if (dataFin.success) {
        setFinancialRecords(dataFin.financials || []);
      }

      // 3. Fetch Attendance for current date & sessions for month
      const resAtt = await fetch(`/api/attendance?groupId=${groupId}&date=${attendanceDate}`);
      const dataAtt = await resAtt.json();
      if (dataAtt.success) {
        setAttendanceRecords(dataAtt.attendance || []);
        setClassSessions(dataAtt.sessions || []);
      }

      // 4. Fetch Exam Records
      const resExams = await fetch(`/api/exam-grades?groupId=${groupId}`);
      const dataExams = await resExams.json();
      if (dataExams.success) {
        setExamRecords(dataExams.exams || []);
        if (dataExams.exams?.length > 0 && !selectedExamRecordId) {
          setSelectedExamRecordId(dataExams.exams[0].id);
          loadExamGrades(dataExams.exams[0].id, groupId);
        }
      }
    } catch (err) {
      console.error("Error loading group dashboard data:", err);
    }
  };

  const loadExamGrades = async (examId: string, grpId?: string) => {
    const gid = grpId || selectedGroupId;
    if (!gid) return;
    try {
      const res = await fetch(`/api/exam-grades?groupId=${gid}&examRecordId=${examId}`);
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
      fetch(`/api/financials?groupId=${selectedGroupId}&month=${financialMonth}`)
        .then((r) => r.json())
        .then((d) => d.success && setFinancialRecords(d.financials || []));
    }
  }, [financialMonth, selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId) {
      fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setAttendanceRecords(d.attendance || []);
            setClassSessions(d.sessions || []);
          }
        });
    }
  }, [attendanceDate, selectedGroupId]);

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
      loadGroupData(selectedGroupId!);
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
      loadGroupData(selectedGroupId!);
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
    const targetStudents = students.filter((s) => selectedStudentIds.includes(s.id));
    const firstWithPhone = targetStudents.find((s) => s.parentPhone);
    if (!firstWithPhone) {
      alert("لا يوجد أرقام هواتف مسجلة للطلاب المحددين");
      return;
    }
    const cleanPhone = firstWithPhone.parentPhone.startsWith("0") ? "2" + firstWithPhone.parentPhone : firstWithPhone.parentPhone;
    const msg = `مرحباً ولي أمر الطالب: *${firstWithPhone.name}*
كود QR الخاص بحضور الطالب في مجموعة ${selectedGroup?.name}:
*${firstWithPhone.code}*`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleBulkSendReportWhatsApp = () => {
    if (selectedStudentIds.length === 0) return;
    const targetStudents = students.filter((s) => selectedStudentIds.includes(s.id));
    const firstWithPhone = targetStudents.find((s) => s.parentPhone);
    if (!firstWithPhone) {
      alert("لا يوجد أرقام هواتف مسجلة للطلاب المحددين");
      return;
    }
    const cleanPhone = firstWithPhone.parentPhone.startsWith("0") ? "2" + firstWithPhone.parentPhone : firstWithPhone.parentPhone;
    const msg = `تقرير متابعة الطالب: *${firstWithPhone.name}*
الصف: ${firstWithPhone.academicYear}
المجموعة: ${selectedGroup?.name}
كود الطالب: ${firstWithPhone.code}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
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
      // Refresh
      const resFin = await fetch(`/api/financials?groupId=${selectedGroupId}&month=${financialMonth}`);
      const dataFin = await resFin.json();
      if (dataFin.success) setFinancialRecords(dataFin.financials || []);
      setSelectedStudentIds([]);
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

      const resAtt = await fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}`);
      const dataAtt = await resAtt.json();
      if (dataAtt.success) {
        setAttendanceRecords(dataAtt.attendance || []);
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
        loadGroupData(selectedGroupId);
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
      loadGroupData(selectedGroupId!);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferTargetGroupId || selectedStudentIds.length === 0) return;
    try {
      await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          studentIds: selectedStudentIds,
          targetGroupId: transferTargetGroupId,
        }),
      });
      setIsTransferModalOpen(false);
      loadGroupData(selectedGroupId!);
      setSelectedStudentIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  // Calendar Days generator for the month (e.g. October 2026: 31 days)
  const calendarDays = useMemo(() => {
    const days = [];
    const [yearStr, monthStr] = financialMonth.split("-");
    const year = parseInt(yearStr || "2026", 10);
    const month = parseInt(monthStr || "10", 10);
    const totalDays = new Date(year, month, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const hasClass = classSessions.some((s) => s.date === dateStr);
      days.push({
        dayNumber: d,
        date: dateStr,
        hasClass,
      });
    }
    return days;
  }, [financialMonth, classSessions]);

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
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "students"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>طلاب المجموعة</span>
          </button>

          <button
            onClick={() => setActiveTab("financials")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "financials"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>المالية والاشتراكات</span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "attendance"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>الغياب والحضور</span>
          </button>

          <button
            onClick={() => setActiveTab("grades")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "grades"
                ? "bg-white text-amber-600 shadow-sm"
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
                  onClick={() => {
                    setIsTransferringHere(true);
                    setIsTransferModalOpen(true);
                  }}
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
                    onClick={() => {
                      setIsTransferringHere(false);
                      setIsTransferModalOpen(true);
                    }}
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
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/40" : isInactive ? "bg-slate-50/50 opacity-75" : ""
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
                              onClick={() => setActiveProfileStudentId(student.id)}
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
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  isInactive
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
                                  onClick={() => setActiveProfileStudentId(student.id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold"
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
                    فلترة بالشهور، وتحديد حالات السداد (الافتراضي: غير مدفوع)
                  </p>
                </div>
              </div>

              {/* Month Selector Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">الشهر المالي:</span>
                <select
                  value={financialMonth}
                  onChange={(e) => setFinancialMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="2026-10">أكتوبر ٢٠٢٦</option>
                  <option value="2026-11">نوفمبر ٢٠٢٦</option>
                  <option value="2026-12">ديسمبر ٢٠٢٦</option>
                  <option value="2026-09">سبتمبر ٢٠٢٦</option>
                </select>
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

            {/* Financials List Table with Color Coded Rows:
                - Light green: paid
                - Light red: unpaid (default)
                - Light brown: partial paid with paid amount shown
                - Two check status beside student name
            */}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {financialRecords.map((fin) => {
                      const isPaid = fin.status === "paid" && fin.paidAmount >= fin.totalAmount;
                      const isPartial = fin.status === "paid" && fin.paidAmount > 0 && fin.paidAmount < fin.totalAmount;
                      const isReturned = fin.status === "returned";
                      const isUnpaid = fin.status === "unpaid" || (!isPaid && !isPartial && !isReturned);
                      const isSelected = selectedStudentIds.includes(fin.studentId);
                      const remaining = Math.max(0, fin.totalAmount - fin.paidAmount);

                      // Row color classes:
                      // Light red for unpaid (default)
                      // Light green for paid
                      // Light brown for partial paid
                      const rowColorClass = isPaid
                        ? "bg-emerald-50/70 hover:bg-emerald-50 text-emerald-950"
                        : isPartial
                        ? "bg-[#faf0e6] hover:bg-[#f5e6d3] text-amber-950" // Light brown
                        : isReturned
                        ? "bg-slate-100/80 hover:bg-slate-100 text-slate-700"
                        : "bg-red-50/70 hover:bg-red-50 text-red-950"; // Light red (default)

                      return (
                        <tr
                          key={fin.id || fin.studentId}
                          className={`transition-colors cursor-pointer border-b border-slate-100/60 ${rowColorClass} ${
                            isSelected ? "ring-2 ring-blue-500/50" : ""
                          }`}
                          onClick={() => setActiveProfileStudentId(fin.studentId)}
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
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  isPaid
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
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  isUnpaid
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
                      تقويم الحصص والحضور الشهري ({financialMonth})
                    </h3>
                    <p className="text-xs text-slate-400">
                      الأيام الملونة بالأخضر توضح أيام الحصص الدراسية المنشأة. انقر على أي يوم لعرض وتعديل قائمة الطلاب.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    <span>يوم حصة منشأة</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-slate-200 inline-block" />
                    <span>أيام أخرى</span>
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
                      className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                        isSelectedDay
                          ? "ring-2 ring-indigo-600 shadow-sm"
                          : ""
                      } ${
                        d.hasClass
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white font-black"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                      }`}
                      title={d.hasClass ? `يوم حصة: ${d.date}` : d.date}
                    >
                      <span className="text-xs sm:text-sm font-mono">{d.dayNumber}</span>
                      {d.hasClass && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day View Header:
                "Above the list view a record attendance with camera and students qr's button + search bar by student filter"
            */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCameraAttendanceOpen(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>تسجيل الحضور بالكاميرا ورموز QR للطلاب</span>
                </button>

                <div className="text-xs text-slate-500 font-medium">
                  عرض كشف يوم: <strong className="text-slate-800 font-mono">{attendanceDate}</strong>
                </div>
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
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isAttended ? "bg-emerald-50/30" : "bg-red-50/20"
                            } ${isSelected ? "ring-2 ring-indigo-500/50" : ""}`}
                            onClick={() => setActiveProfileStudentId(att.studentId)}
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
                              {att.studentName}
                            </td>

                            <td className="p-4 font-mono font-bold text-slate-600">
                              {att.code}
                            </td>

                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                  isAttended
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
                                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    isAttended
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  حاضر
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAttendance(att.studentId, "absent")}
                                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    !isAttended
                                      ? "bg-red-600 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  غائب
                                </button>
                              </div>
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
            TOGGLE 4: EXAM GRADES VIEW
            ========================================================================= */}
        {activeTab === "grades" && (
          <div className="space-y-6">
            {/* Header / Create Exam Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-500" />
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
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
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
                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{exam.examName}</span>
                        <span className="font-mono bg-black/10 px-1.5 py-0.5 rounded-md text-[10px]">
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
                          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-black text-amber-400 px-5 py-2.5 rounded-2xl text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer border border-amber-500/30"
                        >
                          <Camera className="w-4 h-4 text-amber-400" />
                          <Sparkles className="w-3.5 h-3.5" />
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
                                  onClick={() => setActiveProfileStudentId(gradeItem.studentId)}
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
                                        className="w-20 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                                        className={`px-2 py-0.5 rounded-md font-mono ${
                                          percentage >= 85
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
                                      <span className="text-amber-600 font-bold flex items-center gap-1">
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
                  className="mt-2 inline-flex items-center gap-2 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
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
            onUpdate={() => loadGroupData(selectedGroupId)}
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
              // Refresh attendance table
              fetch(`/api/attendance?groupId=${selectedGroupId}&date=${attendanceDate}`)
                .then((r) => r.json())
                .then((d) => d.success && setAttendanceRecords(d.attendance || []));
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
            onGradeRecorded={() => loadExamGrades(selectedExamRecordId)}
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

        {/* 5. Transfer Modal */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-800">
                    {isTransferringHere ? "نقل طلاب إلى هذه المجموعة" : "نقل الطلاب إلى مجموعة أخرى"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isTransferringHere ? (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-500">
                    اختر المجموعة المصدر لاستيراد الطلاب منها إلى: <strong>{selectedGroup?.name}</strong>
                  </p>
                  <select
                    value={transferSourceGroupId}
                    onChange={(e) => setTransferSourceGroupId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  >
                    <option value="">اختر المجموعة المصدر...</option>
                    {groups
                      .filter((g) => g.id !== selectedGroupId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.academicYear})
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-500">
                    سيتم نقل <strong>{selectedStudentIds.length}</strong> طالب محدد إلى المجموعة التالية:
                  </p>
                  <select
                    value={transferTargetGroupId}
                    onChange={(e) => setTransferTargetGroupId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  >
                    <option value="">اختر المجموعة الهدف...</option>
                    {groups
                      .filter((g) => g.id !== selectedGroupId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.academicYear})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleTransferSubmit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                >
                  تأكيد النقل
                </button>
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
                أدخل المبلغ الفعلي المدفوع وسيظهر الصف بلون بني فاتح مع توضيح المبلغ
              </p>
              <input
                type="number"
                value={partialAmountInput}
                onChange={(e) => setPartialAmountInput(e.target.value)}
                placeholder="المبلغ المدفوع (مثال: 150)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex items-center justify-end gap-2 text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setShowPartialModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
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
                  <Award className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-800">
                    إنشاء سجل اختبار جديد
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateExamModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 font-bold">
                  <button
                    type="button"
                    onClick={() => setIsCreateExamModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-sm"
                  >
                    إنشاء السجل
                  </button>
                </div>
              </form>
            </div>
          </div>
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
