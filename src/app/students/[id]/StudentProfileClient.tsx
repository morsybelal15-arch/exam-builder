"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  User,
  Phone,
  Calendar,
  CreditCard,
  Award,
  Share2,
  Trash2,
  Edit2,
  QrCode,
  UserX,
  UserCheck,
  ExternalLink,
  MessageCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Check,
  Printer,
  ShieldCheck,
  Plus,
  X,
  Save,
  Coins,
  RefreshCw,
} from "lucide-react";
import {
  Student,
  Group,
  FinancialRecord,
  AttendanceRecord,
  StudentGradeRecord,
  StudentStatus,
} from "@/lib/types/management";

interface StudentProfileClientProps {
  initialProfile: {
    student: Student;
    group: Group | null;
    financials: FinancialRecord[];
    attendance: AttendanceRecord[];
    sessions: any[];
    grades: Array<StudentGradeRecord & { examName: string; totalScore: number; date?: string }>;
  };
  allGroups?: Group[];
  qrDataUrl: string;
  portalUrl: string;
}

export default function StudentProfileClient({
  initialProfile,
  allGroups = [],
  qrDataUrl,
  portalUrl,
}: StudentProfileClientProps) {
  const router = useRouter();
  const [profileData, setProfileData] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "financials" | "grades" | "qr">("overview");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Groups list for transfer/group selection
  const [groupsList, setGroupsList] = useState<Group[]>(allGroups);

  useEffect(() => {
    setProfileData(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (!allGroups || allGroups.length === 0) {
      fetch("/api/groups")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.groups) {
            setGroupsList(data.groups);
          }
        })
        .catch(console.error);
    }
  }, [allGroups]);

  const { student, group, financials, attendance, sessions = [], grades } = profileData;
  const isInactive = student.status === "inactive";

  // Function to refresh profile from database
  const refreshProfile = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/students?id=${student.id}&profile=true`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfileData({
          ...data.profile,
          group: data.profile.group || null,
        });
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate stats
  const totalSessions = Math.max(attendance.length, sessions.length);
  const attendedCount = attendance.filter((a) => a.status === "attended").length;
  const attendanceRate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

  const totalExams = grades.length;
  const averageGrade =
    totalExams > 0
      ? Math.round(
          grades.reduce((acc, g) => acc + (g.score / (g.totalScore || 20)) * 100, 0) / totalExams
        )
      : null;

  // Toggle active / inactive
  const handleToggleActive = async () => {
    const newStatus = isInactive ? "active" : "inactive";
    try {
      setIsTogglingStatus(true);
      await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkUpdate",
          studentIds: [student.id],
          updates: { status: newStatus },
        }),
      });

      await refreshProfile();
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async () => {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${student.name}" نهائياً من النظام؟`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await fetch(`/api/students?id=${student.id}`, { method: "DELETE" });
      router.push("/students");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حذف الطالب");
      setIsDeleting(false);
    }
  };

  // WhatsApp Portal Link Share
  const handleSendWhatsApp = () => {
    const phone = student.parentPhone?.replace(/\D/g, "");
    if (!phone) {
      alert("رقم هاتف ولي الأمر غير مسجل");
      return;
    }

    const msg = `مرحباً بحضرتك، ولي أمر الطالب/ة: ${student.name}
يسعدنا مشاركة رابط بوابة المتابعة المباشرة لمستوى الطالب معنا في ${group?.name || "المجموعة"}:

${portalUrl}

يمكنك مسح كود QR أو فتح الرابط في أي وقت لمتابعة الدرجات والغياب والمصروفات فورياً.`;

    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Parent Number Verification via WhatsApp (New button in orange area)
  const handleCheckParentWhatsApp = () => {
    const phone = student.parentPhone?.replace(/\D/g, "");
    if (!phone) {
      alert("رقم هاتف ولي الأمر غير مسجل لهذا الطالب. يرجى تعديل بيانات الطالب وإضافة الرقم أولاً.");
      return;
    }

    const groupName = group?.name || student.groupName || "المجموعة التعليمية";
    const teacherName = group?.teacher ? `للأستاذ / ${group.teacher}` : "";

    const msg = `السلام عليكم ورحمة الله وبركاته،
تحية طيبة لحضرتك من إدارة السنتر ${teacherName}.

نود التأكد والتحقق من أن هذا الرقم المسجل لدينا يخص بالفعل ولي أمر الطالب/ة: *${student.name}* (كود الطالب: ${student.code}) المقيد لدينا في: ${groupName}.

نرجو من سيادتكم التكرم بالرد وتأكيد الاستلام، للتأكد من صحة بيانات الاتصال والاطمئنان لعدم تسجيل رقم غير صحيح أو وهمي، حتى تصلكم تقارير الحضور والغياب ودرجات الاختبارات والمصروفات أولاً بأول.

شاكرين لحضرتكم حسن التعاون ونسعد دائماً بتواصلكم!`;

    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ========================================================
  // EDIT STUDENT MODAL STATE & HANDLER (Button in top orange area)
  // ========================================================
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({
    name: student.name,
    code: student.code,
    academicYear: student.academicYear,
    groupId: student.groupId,
    parentPhone: student.parentPhone || "",
    studentPhone: student.studentPhone || "",
    monthlyFee: student.monthlyFee || 250,
    notes: student.notes || "",
    status: student.status,
  });
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  const handleOpenEditStudentModal = () => {
    setEditStudentForm({
      name: student.name,
      code: student.code,
      academicYear: student.academicYear,
      groupId: student.groupId,
      parentPhone: student.parentPhone || "",
      studentPhone: student.studentPhone || "",
      monthlyFee: student.monthlyFee || 250,
      notes: student.notes || "",
      status: student.status,
    });
    setIsEditStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentForm.name.trim()) {
      alert("يرجى إدخال اسم الطالب");
      return;
    }

    try {
      setIsSavingStudent(true);
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: student.id,
          code: editStudentForm.code?.trim().toUpperCase() || student.code,
          name: editStudentForm.name.trim(),
          academicYear: editStudentForm.academicYear,
          groupId: editStudentForm.groupId,
          parentPhone: editStudentForm.parentPhone.trim(),
          studentPhone: editStudentForm.studentPhone.trim(),
          monthlyFee: Number(editStudentForm.monthlyFee) || 250,
          notes: editStudentForm.notes.trim(),
          status: editStudentForm.status,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ التعديلات");
      }

      await refreshProfile();
      setIsEditStudentModalOpen(false);
      router.refresh();
    } catch (err: any) {
      console.error("Error updating student:", err);
      alert(err.message || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setIsSavingStudent(false);
    }
  };

  // ========================================================
  // FINANCIAL EDIT MODAL STATE & HANDLER (3 statuses & payment quantity)
  // ========================================================
  const [financialModal, setFinancialModal] = useState<{
    isOpen: boolean;
    month: string;
    status: "paid" | "partial" | "unpaid";
    paidAmount: number;
    totalAmount: number;
    notes: string;
  }>({
    isOpen: false,
    month: financials[0]?.month || new Date().toISOString().slice(0, 7),
    status: "paid",
    paidAmount: student.monthlyFee || 250,
    totalAmount: student.monthlyFee || 250,
    notes: "",
  });
  const [isSavingFinancial, setIsSavingFinancial] = useState(false);

  const handleOpenEditFinancial = (fin?: FinancialRecord) => {
    const fee = fin ? fin.totalAmount || student.monthlyFee || 250 : student.monthlyFee || 250;
    let initialStatus: "paid" | "partial" | "unpaid" = "paid";
    let paidVal = fee;

    if (fin) {
      if (fin.status === "paid" && (fin.paidAmount >= fee)) {
        initialStatus = "paid";
        paidVal = fin.paidAmount;
      } else if (fin.paidAmount > 0) {
        initialStatus = "partial";
        paidVal = fin.paidAmount;
      } else {
        initialStatus = "unpaid";
        paidVal = 0;
      }
    }

    setFinancialModal({
      isOpen: true,
      month: fin?.month || new Date().toISOString().slice(0, 7),
      status: initialStatus,
      paidAmount: paidVal,
      totalAmount: fee,
      notes: fin?.notes || "",
    });
  };

  const handleFinancialStatusChange = (newStatus: "paid" | "partial" | "unpaid") => {
    let newPaid = financialModal.paidAmount;
    if (newStatus === "paid") {
      newPaid = financialModal.totalAmount;
    } else if (newStatus === "unpaid") {
      newPaid = 0;
    } else if (newStatus === "partial" && (newPaid === 0 || newPaid >= financialModal.totalAmount)) {
      newPaid = Math.round(financialModal.totalAmount / 2);
    }

    setFinancialModal((prev) => ({
      ...prev,
      status: newStatus,
      paidAmount: newPaid,
    }));
  };

  const handleSaveFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingFinancial(true);
      const finalPaid =
        financialModal.status === "unpaid"
          ? 0
          : financialModal.status === "paid"
          ? financialModal.totalAmount
          : Number(financialModal.paidAmount) || 0;

      const finalStatus = financialModal.status === "unpaid" ? "unpaid" : "paid";

      const res = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          groupId: student.groupId,
          month: financialModal.month,
          status: finalStatus,
          paidAmount: finalPaid,
          totalAmount: Number(financialModal.totalAmount) || (student.monthlyFee || 250),
          notes: financialModal.notes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ السجل المالي");
      }

      await refreshProfile();
      setFinancialModal((prev) => ({ ...prev, isOpen: false }));
      router.refresh();
    } catch (err: any) {
      console.error("Error saving financial record:", err);
      alert(err.message || "حدث خطأ أثناء حفظ السجل المالي");
    } finally {
      setIsSavingFinancial(false);
    }
  };

  // ========================================================
  // ATTENDANCE EDIT / TOGGLE STATE & HANDLER (Red-circled in image 2 & 4)
  // ========================================================
  const [updatingAttDate, setUpdatingAttDate] = useState<string | null>(null);

  const handleToggleAttendance = async (att: AttendanceRecord) => {
    const newStatus = att.status === "attended" ? "absent" : "attended";
    try {
      setUpdatingAttDate(att.date);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: student.id,
          groupId: student.groupId,
          date: att.date,
          status: newStatus,
          method: "manual",
        }),
      });

      if (!res.ok) {
        throw new Error("فشل في تحديث حالة الحضور");
      }

      await refreshProfile();
      router.refresh();
    } catch (err: any) {
      console.error("Error updating attendance:", err);
      alert(err.message || "حدث خطأ أثناء تعديل الحضور");
    } finally {
      setUpdatingAttDate(null);
    }
  };

  // Add Attendance for custom date modal
  const [newAttDate, setNewAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [newAttStatus, setNewAttStatus] = useState<"attended" | "absent">("attended");
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false);

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAddingAttendance(true);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: student.id,
          groupId: student.groupId,
          date: newAttDate,
          status: newAttStatus,
          method: "manual",
        }),
      });

      if (!res.ok) throw new Error("فشل في تسجيل الحضور");
      await refreshProfile();
      setShowAddAttendanceModal(false);
      router.refresh();
    } catch (err: any) {
      console.error("Error adding attendance:", err);
      alert(err.message || "حدث خطأ أثناء إضافة الحضور");
    } finally {
      setIsAddingAttendance(false);
    }
  };

  // ========================================================
  // EXAM GRADE EDIT MODAL STATE & HANDLER (Red-circled in image 5)
  // ========================================================
  const [gradeModal, setGradeModal] = useState<{
    isOpen: boolean;
    record: any | null;
    score: number;
    totalScore: number;
    notes: string;
  }>({
    isOpen: false,
    record: null,
    score: 0,
    totalScore: 20,
    notes: "",
  });
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const handleOpenEditGrade = (grd: any) => {
    setGradeModal({
      isOpen: true,
      record: grd,
      score: grd.score,
      totalScore: grd.totalScore || 20,
      notes: grd.notes || "",
    });
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeModal.record) return;
    try {
      setIsSavingGrade(true);
      const res = await fetch("/api/exam-grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveGrade",
          examRecordId: gradeModal.record.examRecordId,
          studentIdOrCode: student.id,
          score: Number(gradeModal.score),
          notes: gradeModal.notes,
          method: "manual",
        }),
      });

      if (!res.ok) throw new Error("فشل في حفظ درجة الاختبار");
      await refreshProfile();
      setGradeModal((prev) => ({ ...prev, isOpen: false }));
      router.refresh();
    } catch (err: any) {
      console.error("Error saving grade:", err);
      alert(err.message || "حدث خطأ أثناء حفظ درجة الاختبار");
    } finally {
      setIsSavingGrade(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8 space-y-6 select-text print:bg-white print:p-0 print:m-0 print:overflow-visible" dir="rtl">
      {/* Entire screen view wrapped in print:hidden so nothing leaks into print */}
      <div className="space-y-6 print:hidden">
        {/* Top Breadcrumb & Actions Bar (Hidden on print) */}
        <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href={`/students${group ? `?groupId=${group.id}` : ""}`}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white px-4 py-2 rounded-xl border border-slate-200 transition-colors shadow-2xs group"
        >
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          <span>العودة لقائمة الطلاب</span>
        </Link>

        {/* Buttons in Top Bar: Includes Edit Button in Orange Area */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* BUTTON IN ORANGE AREA 1: Edit Student Data */}
          <button
            onClick={handleOpenEditStudentModal}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="تعديل بيانات الطالب والمجموعة والاشتراك"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل بيانات الطالب</span>
          </button>

          {/* Toggle Active/Inactive */}
          <button
            onClick={handleToggleActive}
            disabled={isTogglingStatus}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
              isInactive
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
            <span>{isInactive ? "تفعيل الطالب" : "تعطيل الحساب"}</span>
          </button>

          {/* Delete Student */}
          <button
            onClick={handleDeleteStudent}
            disabled={isDeleting}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الطالب</span>
          </button>
        </div>
      </div>

      {/* Main Student Header Card (Hidden on print) */}
      <div
        className={`bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden transition-all print:hidden ${
          isInactive ? "opacity-90 bg-slate-50/50" : ""
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* QR Card Thumbnail */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white p-2 shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold">
                {student.code}
              </span>
            </div>

            {/* Student Info Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  {student.name}
                </h1>
                {isInactive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    طالب منقطع / غير مفعّل
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    نشط ومسجل
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                <span>{student.academicYear}</span>
                <span>•</span>
                <span className="text-blue-600 font-bold">{group?.name || student.groupName}</span>
                <span>•</span>
                <span>المعلم: {group?.teacher || "-"}</span>
              </p>

              {/* Contact info row (Red circled in Image 3) */}
              <div className="flex items-center gap-3 pt-2 text-xs text-slate-600 flex-wrap">
                {student.parentPhone && (
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-slate-400">ولي الأمر:</span>
                    <a href={`tel:${student.parentPhone}`} className="font-mono font-bold hover:text-blue-600">
                      {student.parentPhone}
                    </a>
                  </div>
                )}

                {student.studentPhone && (
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">الطالب:</span>
                    <a href={`tel:${student.studentPhone}`} className="font-mono font-bold hover:text-blue-600">
                      {student.studentPhone}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-400">الاشتراك:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {student.monthlyFee || 250} ج.م/شهر
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions (Includes Parent Number Check button in Orange Area 2) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Regular WhatsApp Follow-up Share */}
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
              title="إرسال رابط بوابة المتابعة المباشرة لولي الأمر عبر واتساب"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال واتساب لولي الأمر</span>
            </button>

            {/* BUTTON IN ORANGE AREA 2: Check Parent Number via WhatsApp */}
            <button
              onClick={handleCheckParentWhatsApp}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 border border-amber-600/30"
              title="إرسال رسالة تحقق رسمية عبر واتساب للتأكد من أن الرقم يخص ولي الأمر الحقيقي وليس رقماً وهمياً"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>فحص رقم ولي الأمر (واتساب)</span>
            </button>

            {/* Preview Follow-up Page */}
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>معاينة صفحة المتابعة</span>
            </a>
          </div>
        </div>
      </div>

      {/* 3 Quick Summary Metric Cards (Hidden on print) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        {/* Card 1: Attendance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">نسبة الحضور</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-1 block">
              {attendanceRate}%
            </span>
            <span className="text-[11px] text-slate-500">
              {attendedCount} حاضر من إجمالي {totalSessions} حصص
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Exams */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">متوسط الاختبارات</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-1 block">
              {averageGrade !== null ? `${averageGrade}%` : "لا يوجد"}
            </span>
            <span className="text-[11px] text-slate-500">
              تم رصد {totalExams} اختبارات
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Financials (With 3 statuses support) */}
        {(() => {
          const now = new Date();
          const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const activeFin = financials.find((f) => f.month === currentMonthKey) || financials[0];
          const targetTotal = activeFin?.totalAmount || student.monthlyFee || 250;
          const paidAmt = activeFin?.paidAmount || 0;
          const statusLabel =
            activeFin?.status === "returned"
              ? "مرتجع"
              : paidAmt > 0 && paidAmt < targetTotal
              ? "مسدد جزئياً"
              : activeFin?.status === "paid" || (paidAmt >= targetTotal && targetTotal > 0)
              ? "مسدد بالكامل"
              : "مستحق (غير مسدد)";
          return (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">حالة المصروفات</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight mt-1 block">
                  {statusLabel}
                </span>
                <span className="text-[11px] text-slate-500">
                  شهر {activeFin?.month || currentMonthKey}
                  {activeFin && (
                    <span className="font-mono font-bold mr-1">
                      ({paidAmt} / {targetTotal} ج.م)
                    </span>
                  )}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tabs Navigation (Hidden on print) */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "overview" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>نظرة عامة</span>
          {activeTab === "overview" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`pb-3 relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "attendance" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>سجل الحضور والغياب ({attendance.length})</span>
          {activeTab === "attendance" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("grades")}
          className={`pb-3 relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "grades" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>درجات الاختبارات ({grades.length})</span>
          {activeTab === "grades" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("financials")}
          className={`pb-3 relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "financials" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>السجل المالي ({financials.length})</span>
          {activeTab === "financials" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("qr")}
          className={`pb-3 relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "qr" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>بطاقة الـ QR والطباعة</span>
          {activeTab === "qr" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 1: Overview (Hidden on print) */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
          {/* Notes / Details */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">بيانات وملاحظات الطالب</h3>
              <button
                onClick={handleOpenEditStudentModal}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">اسم الطالب:</span>
                <span className="font-bold text-slate-800">{student.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">كود الطالب:</span>
                <span className="font-mono font-bold text-blue-600">{student.code}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">المرحلة الدراسية:</span>
                <span className="font-bold text-slate-800">{student.academicYear}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">المجموعة:</span>
                <span className="font-bold text-slate-800">{group?.name || student.groupName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">هاتف ولي الأمر:</span>
                <span className="font-mono font-bold text-slate-700">{student.parentPhone || "غير مسجل"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">هاتف الطالب:</span>
                <span className="font-mono font-bold text-slate-700">{student.studentPhone || "غير مسجل"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">قيمة الاشتراك الشهري:</span>
                <span className="font-mono font-bold text-emerald-600">{student.monthlyFee || 250} ج.م</span>
              </div>
              <div className="py-2">
                <span className="text-slate-400 block mb-1">ملاحظات المعلم:</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                  {student.notes || "لا توجد ملاحظات مسجلة."}
                </p>
              </div>
            </div>
          </div>

          {/* Quick QR Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-40 h-40 bg-white p-3 rounded-2xl shadow-md border border-slate-200">
              <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-800">بطاقة المتابعة الذكية</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                توجّه الكاميرا إليها لتسجيل الحضور، أو يمكن لولي الأمر مسحها من المنزل
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {copiedLink ? "تم النسخ ✓" : "نسخ الرابط"}
              </button>
              <button
                onClick={handleSendWhatsApp}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إرسال لواتساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attendance (Hidden on print) */}
      {activeTab === "attendance" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-800">سجل الحضور والغياب التفصيلي</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكنك النقر على زر الحالة لتغيير الطالب بين (حاضر / غائب) فورياً مع الحفظ
              </p>
            </div>
            <button
              onClick={() => setShowAddAttendanceModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all border border-blue-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل حضور يوم محدد</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الحالة (انقر للتعديل)</th>
                  <th className="p-3">وقت التسجيل</th>
                  <th className="p-3">طريقة التسجيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {attendance.length > 0 ? (
                  attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-800">{att.date}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleAttendance(att)}
                          disabled={updatingAttDate === att.date}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                            att.status === "attended"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          }`}
                          title="انقر لتغيير حالة الحضور والغياب فورياً"
                        >
                          {updatingAttDate === att.date ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : att.status === "attended" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          )}
                          <span>{att.status === "attended" ? "حاضر (انقر للتبديل)" : "غائب (انقر للتبديل)"}</span>
                        </button>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{att.time || "-"}</td>
                      <td className="p-3 text-slate-500">
                        {att.method === "camera_qr" ? "مسح QR" : "تسجيل يدوي"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      لا توجد سجلات حضور مسجلة حتى الآن
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Exam Grades (Hidden on print) */}
      {activeTab === "grades" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-800">سجل درجات الاختبارات</h3>
            <p className="text-xs text-slate-400">
              يمكنك النقر على زر تعديل لتحديث درجة الطالب أو الملاحظات
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">اسم الاختبار</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الدرجة</th>
                  <th className="p-3">النسبة</th>
                  <th className="p-3">طريقة الرصد</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {grades.length > 0 ? (
                  grades.map((grd) => {
                    const pct = Math.round((grd.score / (grd.totalScore || 20)) * 100);
                    return (
                      <tr key={grd.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">{grd.examName}</td>
                        <td className="p-3 font-mono text-slate-500">{grd.date || "-"}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {grd.score} / {grd.totalScore || 20}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold ${
                              pct >= 85
                                ? "bg-emerald-100 text-emerald-800"
                                : pct >= 65
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {pct}%
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">
                          {grd.method === "camera_ai" ? "كاميرا AI" : "يدوي"}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleOpenEditGrade(grd)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="تعديل درجة الاختبار"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لا توجد درجات اختبارات مسجلة لهذا الطالب
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Financials (Hidden on print) */}
      {activeTab === "financials" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-800">السجل المالي للمصروفات الشهرية</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكنك تعديل حالة المصروفات (مدفوع بالكامل، مدفوع جزئياً، غير مدفوع) وتعديل كمية المبلغ المدفوع
              </p>
            </div>
            <button
              onClick={() => handleOpenEditFinancial()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل أو تحديث شهر مالي</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">الشهر</th>
                  <th className="p-3">المبلغ المستحق</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {financials.length > 0 ? (
                  financials.map((fin) => {
                    const remaining = Math.max(0, (fin.totalAmount || 250) - (fin.paidAmount || 0));
                    const isFullyPaid = fin.status === "paid" && (fin.paidAmount >= (fin.totalAmount || 250));
                    const isPartialPaid = (fin.paidAmount || 0) > 0 && !isFullyPaid;

                    return (
                      <tr key={fin.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-slate-800">{fin.month}</td>
                        <td className="p-3 font-mono">{fin.totalAmount} ج.م</td>
                        <td className="p-3 font-mono font-bold text-emerald-600">{fin.paidAmount || 0} ج.م</td>
                        <td className="p-3 font-mono text-slate-600">
                          {remaining > 0 ? `${remaining} ج.م` : "٠ ج.م"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isFullyPaid
                                ? "bg-emerald-100 text-emerald-800"
                                : isPartialPaid
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isFullyPaid
                              ? "مدفوع بالكامل"
                              : isPartialPaid
                              ? "مدفوع جزئياً"
                              : "غير مدفوع"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{fin.notes || "-"}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleOpenEditFinancial(fin)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="تعديل الحالة والمبلغ"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      لا توجد سجلات مالية مسجلة لهذا الطالب
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: QR Print Screen View (Only on screen, button 'طباعة مجمعة مع الطلاب' removed) */}
      {activeTab === "qr" && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-lg mx-auto text-center space-y-6 print:hidden">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-between text-center bg-white shadow-2xs mx-auto max-w-xs transition-colors hover:border-blue-400">
            {/* 5x5 cm QR Box matching /qr-printing style */}
            <div
              className="bg-white flex items-center justify-center p-1 rounded-xl"
              style={{ width: "4.5cm", height: "4.5cm" }}
            >
              <img src={qrDataUrl} alt={`QR ${student.code}`} className="w-full h-full object-contain" />
            </div>

            {/* Name / Year / Group below QR */}
            <div className="mt-3 w-full space-y-1 border-t border-slate-100 pt-3 text-center">
              <div className="font-black text-slate-900 text-sm truncate">{student.name}</div>
              <div className="text-[11px] font-bold text-blue-600 truncate">{student.academicYear}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {group?.name || student.groupName || "المجموعة"} • كود: <span className="font-mono font-bold text-slate-700">{student.code}</span>
              </div>
            </div>
          </div>

          {/* Action button: ONLY single print (removed 'طباعة مجمعة مع الطلاب') */}
          <div className="flex justify-center">
            <button
              onClick={() => window.print()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة البطاقة (A4)</span>
            </button>
          </div>
        </div>
      )}
      </div>

      {/* ======================================================== */}
      {/* DEDICATED PRINT VIEW (ONLY VISIBLE ON PRINT) */}
      {/* Matches exactly the layout and style of /qr-printing */}
      {/* ======================================================== */}
      <div className="hidden print:block print:w-full print:m-0 print:p-0" dir="rtl">
        <div
          className="bg-white rounded-2xl shadow-none border-none mx-auto p-8 sm:p-12 print:p-8 print:shadow-none print:border-none print:m-0 print:w-full print:h-full overflow-hidden"
          style={{
            width: "100%",
            maxWidth: "210mm",
            minHeight: "297mm",
          }}
        >
          {/* Subtle Page Header */}
          <div className="border-b border-slate-200 pb-3 mb-6 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-bold text-slate-800">
              بطاقات QR - {group?.name || student.groupName || "المجموعة"}
            </span>
            <span>صفحة 1 من 1</span>
          </div>

          {/* Standard 5x5 cm card with cut guide matching /qr-printing */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-7">
            <div
              className="border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-between text-center bg-white shadow-2xs select-none hover:border-blue-400 transition-colors"
              style={{
                minHeight: "5.5cm",
              }}
            >
              {/* 5x5 QR Code Graphic */}
              <div
                className="bg-white flex items-center justify-center p-1"
                style={{ width: "4cm", height: "4cm" }}
              >
                <img
                  src={qrDataUrl}
                  alt={`QR ${student.code}`}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Name / Year / Group below QR */}
              <div className="mt-2 w-full space-y-0.5 border-t border-slate-100 pt-2 text-center">
                <div className="font-black text-slate-900 text-xs sm:text-sm truncate">
                  {student.name}
                </div>
                <div className="text-[10px] font-bold text-blue-600 truncate">
                  {student.academicYear}
                </div>
                <div className="text-[9px] text-slate-500 truncate">
                  {group?.name || student.groupName || "المجموعة"} • كود: {student.code}
                </div>
              </div>
            </div>
          </div>

          {/* Cut Guide Footer */}
          <div className="border-t border-slate-100 mt-8 pt-3 text-center text-[9px] text-slate-400 print:block">
            ✂ قص على طول الخطوط المتقطعة للحصول على بطاقات QR بمقاس 5×5 سم
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: EDIT STUDENT DETAILS MODAL */}
      {/* ======================================================== */}
      {isEditStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">تعديل بيانات الطالب</h3>
              </div>
              <button
                onClick={() => setIsEditStudentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStudent} className="p-6 space-y-4 text-xs">
              {/* Student Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">اسم الطالب *</label>
                <input
                  type="text"
                  required
                  value={editStudentForm.name}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, name: e.target.value })}
                  placeholder="الاسم الرباعي للطالب"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Student Code (Read-only, generated once on creation) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  كود الطالب (كود فريد غير قابل للتعديل)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  dir="ltr"
                  disabled
                  readOnly
                  value={editStudentForm.code}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono font-bold text-center tracking-widest cursor-not-allowed select-all"
                  title="كود الطالب تم إنشاؤه عند التسجيل ولا يمكن تعديله أو إعادة توليده"
                />
              </div>

              {/* Academic Stage & Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">المرحلة الدراسية *</label>
                  <select
                    value={editStudentForm.academicYear}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, academicYear: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                    <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                    <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                    <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                    <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                    <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">المجموعة التعليمية *</label>
                  <select
                    value={editStudentForm.groupId}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, groupId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    {groupsList.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.name} ({grp.academicYear})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">هاتف ولي الأمر *</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editStudentForm.parentPhone}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, parentPhone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">هاتف الطالب</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editStudentForm.studentPhone}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, studentPhone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Monthly Fee & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">قيمة الاشتراك الشهري (ج.م) *</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={editStudentForm.monthlyFee}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, monthlyFee: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">حالة القيد في السنتر</label>
                  <select
                    value={editStudentForm.status}
                    onChange={(e) =>
                      setEditStudentForm({
                        ...editStudentForm,
                        status: e.target.value as StudentStatus,
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="active">نشط ومسجل</option>
                    <option value="inactive">طالب منقطع / غير مفعّل</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات المعلم والإدارة</label>
                <textarea
                  rows={2}
                  value={editStudentForm.notes}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, notes: e.target.value })}
                  placeholder="أي تفاصيل خاصة بالطالب أو مواعيد حضوره..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingStudent ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: FINANCIAL RECORD EDIT MODAL (3 statuses + quantity) */}
      {/* ======================================================== */}
      {financialModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">تعديل السجل المالي</h3>
                  <p className="text-[11px] text-slate-400">تحديث حالة الدفع والمبلغ المحصل لشهر {financialModal.month}</p>
                </div>
              </div>
              <button
                onClick={() => setFinancialModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveFinancial} className="p-6 space-y-4 text-xs">
              {/* Month */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الشهر المالي (YYYY-MM)</label>
                <input
                  type="month"
                  required
                  value={financialModal.month}
                  onChange={(e) => setFinancialModal({ ...financialModal, month: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* 3 Statuses Selector (Radio buttons) */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">حالة السداد (اختر من 3 حالات) *</label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Status 1: Paid in full */}
                  <button
                    type="button"
                    onClick={() => handleFinancialStatusChange("paid")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      financialModal.status === "paid"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${financialModal.status === "paid" ? "text-emerald-600" : "text-slate-400"}`} />
                    <span className="text-[11px]">مدفوع بالكامل</span>
                  </button>

                  {/* Status 2: Partially paid */}
                  <button
                    type="button"
                    onClick={() => handleFinancialStatusChange("partial")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      financialModal.status === "partial"
                        ? "bg-amber-50 text-amber-800 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Coins className={`w-4 h-4 ${financialModal.status === "partial" ? "text-amber-600" : "text-slate-400"}`} />
                    <span className="text-[11px]">مدفوع جزئياً</span>
                  </button>

                  {/* Status 3: Unpaid */}
                  <button
                    type="button"
                    onClick={() => handleFinancialStatusChange("unpaid")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      financialModal.status === "unpaid"
                        ? "bg-red-50 text-red-800 border-red-500 ring-2 ring-red-500/20 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <XCircle className={`w-4 h-4 ${financialModal.status === "unpaid" ? "text-red-600" : "text-slate-400"}`} />
                    <span className="text-[11px]">غير مدفوع</span>
                  </button>
                </div>
              </div>

              {/* Payment Quantities */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">المبلغ المستحق (ج.م) *</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={financialModal.totalAmount}
                    onChange={(e) => {
                      const tot = Number(e.target.value) || 0;
                      setFinancialModal({
                        ...financialModal,
                        totalAmount: tot,
                        paidAmount: financialModal.status === "paid" ? tot : financialModal.paidAmount,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">المبلغ المدفوع (ج.م) *</label>
                  <input
                    type="number"
                    min="0"
                    max={financialModal.totalAmount}
                    step="5"
                    required
                    disabled={financialModal.status === "unpaid" || financialModal.status === "paid"}
                    value={financialModal.paidAmount}
                    onChange={(e) => setFinancialModal({ ...financialModal, paidAmount: Number(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Live remaining calculation */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-medium">المبلغ المتبقي:</span>
                <span className="font-mono font-black text-sm text-slate-800">
                  {Math.max(0, financialModal.totalAmount - financialModal.paidAmount)} ج.م
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات السداد (اختياري)</label>
                <input
                  type="text"
                  value={financialModal.notes}
                  onChange={(e) => setFinancialModal({ ...financialModal, notes: e.target.value })}
                  placeholder="مثال: سداد نقدي، فودافون كاش، وعد بالسداد..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFinancialModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingFinancial}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingFinancial ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ الحالة والمبلغ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: EXAM GRADE EDIT MODAL */}
      {/* ======================================================== */}
      {gradeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">تعديل درجة الاختبار</h3>
              </div>
              <button
                onClick={() => setGradeModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 mb-1">اسم الاختبار</label>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800">
                  {gradeModal.record?.examName}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">درجة الطالب *</label>
                  <input
                    type="number"
                    min="0"
                    max={gradeModal.totalScore}
                    step="0.5"
                    required
                    value={gradeModal.score}
                    onChange={(e) => setGradeModal({ ...gradeModal, score: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 mb-1.5">الدرجة الكلية</label>
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono font-bold">
                    {gradeModal.totalScore}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات على الدرجة</label>
                <input
                  type="text"
                  value={gradeModal.notes}
                  onChange={(e) => setGradeModal({ ...gradeModal, notes: e.target.value })}
                  placeholder="مثال: تم إعادة التصحيح، إجابة نموذجية..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGradeModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingGrade}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingGrade ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ الدرجة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ADD CUSTOM ATTENDANCE DATE MODAL */}
      {/* ======================================================== */}
      {showAddAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">تسجيل حضور يوم محدد</h3>
              </div>
              <button
                onClick={() => setShowAddAttendanceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAttendance} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={newAttDate}
                  onChange={(e) => setNewAttDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الحالة *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAttStatus("attended")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                      newAttStatus === "attended"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500/20"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    حاضر
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAttStatus("absent")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                      newAttStatus === "absent"
                        ? "bg-red-50 text-red-800 border-red-500 ring-2 ring-red-500/20"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    غائب
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAttendanceModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingAttendance}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAddingAttendance ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>تسجيل الحضور</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
