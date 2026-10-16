"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Student, Group, FinancialRecord, AttendanceRecord, StudentGradeRecord } from "@/lib/types/management";

interface StudentProfileClientProps {
  initialProfile: {
    student: Student;
    group: Group | null;
    financials: FinancialRecord[];
    attendance: AttendanceRecord[];
    sessions: any[];
    grades: Array<StudentGradeRecord & { examName: string; totalScore: number; date?: string }>;
  };
  qrDataUrl: string;
  portalUrl: string;
}

export default function StudentProfileClient({
  initialProfile,
  qrDataUrl,
  portalUrl,
}: StudentProfileClientProps) {
  const router = useRouter();
  const [profileData, setProfileData] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "financials" | "grades" | "qr">("overview");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { student, group, financials, attendance, grades } = profileData;
  const isInactive = student.status === "inactive";

  // Calculate stats
  const totalSessions = attendance.length;
  const attendedCount = attendance.filter((a) => a.status === "attended").length;
  const attendanceRate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

  const totalExams = grades.length;
  const averageGrade =
    totalExams > 0
      ? Math.round(
          grades.reduce((acc, g) => acc + (g.score / (g.totalScore || 20)) * 100, 0) / totalExams
        )
      : null;

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

      setProfileData((prev) => ({
        ...prev,
        student: { ...prev.student, status: newStatus },
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8 space-y-6 select-text">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/students${group ? `?groupId=${group.id}` : ""}`}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white px-4 py-2 rounded-xl border border-slate-200 transition-colors shadow-2xs group"
        >
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          <span>العودة لقائمة الطلاب</span>
        </Link>

        <div className="flex items-center gap-2">
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

      {/* Main Student Header Card */}
      <div
        className={`bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden transition-all ${
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

            {/* Student Info */}
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

              {/* Contact info row */}
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

          {/* Quick Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال واتساب لولي الأمر</span>
            </button>

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

      {/* 3 Quick Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Card 3: Financials */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">حالة المصروفات</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-1 block">
              {financials[0]?.status === "paid" ? "مسدد" : "مستحق"}
            </span>
            <span className="text-[11px] text-slate-500">
              شهر {financials[0]?.month || "الحالي"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 relative transition-colors cursor-pointer ${
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
          className={`pb-3 relative transition-colors cursor-pointer ${
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
          className={`pb-3 relative transition-colors cursor-pointer ${
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
          className={`pb-3 relative transition-colors cursor-pointer ${
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
          className={`pb-3 relative transition-colors cursor-pointer ${
            activeTab === "qr" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>بطاقة الـ QR والطباعة</span>
          {activeTab === "qr" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Notes / Details */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-slate-800">بيانات وملاحظات الطالب</h3>
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

      {/* Tab 2: Attendance */}
      {activeTab === "attendance" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-800">سجل الحضور والغياب التفصيلي</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الحالة</th>
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
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            att.status === "attended"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {att.status === "attended" ? "حاضر" : "غائب"}
                        </span>
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

      {/* Tab 3: Exam Grades */}
      {activeTab === "grades" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-800">سجل درجات الاختبارات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">اسم الاختبار</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الدرجة</th>
                  <th className="p-3">النسبة</th>
                  <th className="p-3">طريقة الرصد</th>
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
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      لا توجد درجات اختبارات مسجلة لهذا الطالب
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Financials */}
      {activeTab === "financials" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-800">السجل المالي للمصروفات الشهرية</h3>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {financials.length > 0 ? (
                  financials.map((fin) => {
                    const remaining = Math.max(0, (fin.totalAmount || 250) - (fin.paidAmount || 0));
                    return (
                      <tr key={fin.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-slate-800">{fin.month}</td>
                        <td className="p-3 font-mono">{fin.totalAmount} ج.م</td>
                        <td className="p-3 font-mono font-bold text-emerald-600">{fin.paidAmount} ج.م</td>
                        <td className="p-3 font-mono text-slate-600">
                          {remaining > 0 ? `${remaining} ج.م` : "٠ ج.م"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              fin.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : fin.paidAmount > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {fin.status === "paid"
                              ? "مدفوع بالكامل"
                              : fin.paidAmount > 0
                              ? "مدفوع جزئياً"
                              : "غير مدفوع"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{fin.notes || "-"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لا توجد سجلات مالية مسجلة لهذا الطالب
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: QR Print */}
      {activeTab === "qr" && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-lg mx-auto text-center space-y-6">
          <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-800">بطاقة الطالب الذكية (5×5 سم)</h3>
            <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
              <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-base font-black text-slate-900 block">{student.name}</span>
              <span className="text-xs text-slate-500 block">
                {student.academicYear} • {group?.name || student.groupName}
              </span>
              <span className="text-xs font-mono font-bold text-blue-600 block mt-1">
                {student.code}
              </span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة البطاقة</span>
            </button>
            <Link
              href="/qr-printing"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              طباعة مجمعة مع الطلاب
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
