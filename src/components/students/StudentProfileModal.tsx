"use client";

import React, { useState, useEffect } from "react";
import {
  X,
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
  ShieldCheck,
} from "lucide-react";
import { Student } from "@/lib/types/management";
import { generateQrDataUrl, getStudentQrUrl } from "@/lib/qr-service";

interface StudentProfileModalProps {
  studentId: string;
  onClose: () => void;
  onUpdate: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
}

export default function StudentProfileModal({
  studentId,
  onClose,
  onUpdate,
  onEditStudent,
  onDeleteStudent,
}: StudentProfileModalProps) {
  const [profileData, setProfileData] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "financials" | "grades">("overview");

  useEffect(() => {
    fetchProfile();
  }, [studentId]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/students?id=${studentId}&profile=true`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfileData(data.profile);
        // Generate QR code data URL encoding full smart parent portal URL
        const portalUrl = getStudentQrUrl(data.profile.student.code || data.profile.student.id);
        const qrUrl = await generateQrDataUrl(portalUrl, 240);
        setQrDataUrl(qrUrl);
      }
    } catch (err) {
      console.error("Failed to fetch student profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!profileData?.student) return;
    const newStatus = profileData.student.status === "active" ? "inactive" : "active";
    try {
      await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkUpdate",
          studentIds: [profileData.student.id],
          updates: { status: newStatus },
        }),
      });
      fetchProfile();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReportWhatsApp = () => {
    if (!profileData) return;
    const s = profileData.student;
    const g = profileData.group;
    const phone = s.parentPhone?.replace(/\D/g, "");
    if (!phone) {
      alert("رقم هاتف ولي الأمر غير مسجل");
      return;
    }

    const attendanceRate =
      profileData.attendance?.length > 0
        ? Math.round(
            (profileData.attendance.filter((a: any) => a.status === "attended").length /
              profileData.attendance.length) *
              100
          )
        : 100;

    const gradesSummary =
      profileData.grades?.length > 0
        ? profileData.grades
            .slice(0, 3)
            .map((grd: any) => `• ${grd.examName}: ${grd.score}/${grd.totalScore}`)
            .join("\n")
        : "لا توجد اختبارات مسجلة بعد";

    const msg = `السلام عليكم ورحمة الله،
تقرير متابعة الطالب: *${s.name}*
الصف الدراسي: ${s.academicYear}
المجموعة: ${g?.name || s.groupName || "-"}
المعلم: ${g?.teacher || "-"}

📊 نسبة الحضور والالتزام: ${attendanceRate}%
📝 نتائج آخر الاختبارات:
${gradesSummary}

كود الطالب للمسح والدخول: *${s.code}*
نتمنى له دوام التفوق والنجاح!`;

    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleSendQrWhatsApp = () => {
    if (!profileData) return;
    const s = profileData.student;
    const phone = s.parentPhone?.replace(/\D/g, "");
    if (!phone) {
      alert("رقم هاتف ولي الأمر غير مسجل");
      return;
    }

    const token = s.code || s.id;
    const portalUrl = getStudentQrUrl(token);
    const msg = `مرحباً ولي أمر الطالب: *${s.name}*
رابط بطاقة المتابعة المباشرة للطالب (حضور، درجات واشتراكات):
${portalUrl}

كود الحضور: *${s.code}*
يمكنك مسح كود QR أو فتح الرابط أعلاه في أي وقت لمتابعة مستوى الطالب والاطلاع على الدرجات والحضور فورياً.`;

    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleCheckParentWhatsApp = () => {
    if (!profileData) return;
    const s = profileData.student;
    const g = profileData.group;
    const phone = s.parentPhone?.replace(/\D/g, "");
    if (!phone) {
      alert("رقم هاتف ولي الأمر غير مسجل لهذا الطالب");
      return;
    }

    const groupName = g?.name || s.groupName || "المجموعة";
    const teacherName = g?.teacher ? `للأستاذ / ${g.teacher}` : "";

    const msg = `السلام عليكم ورحمة الله وبركاته،
تحية طيبة لحضرتك من إدارة السنتر ${teacherName}.

نود التأكد والتحقق من أن هذا الرقم المسجل لدينا يخص بالفعل ولي أمر الطالب/ة: *${s.name}* (كود الطالب: ${s.code}) المقيد لدينا في: ${groupName}.

نرجو من سيادتكم التكرم بالرد وتأكيد الاستلام، للتأكد من صحة بيانات الاتصال والاطمئنان لعدم تسجيل رقم غير صحيح أو وهمي، حتى تصلكم تقارير الحضور والغياب ودرجات الاختبارات والمصروفات أولاً بأول.

شاكرين لحضرتكم حسن التعاون ونسعد دائماً بتواصلكم!`;

    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (isLoading || !profileData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <div className="bg-white rounded-3xl p-8 shadow-2xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-700">جاري تحميل ملف الطالب...</span>
        </div>
      </div>
    );
  }

  const { student, group, financials, attendance, grades } = profileData;
  const isInactive = student.status === "inactive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 flex flex-col my-auto max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Header Card */}
        <div className={`p-6 sm:p-7 border-b border-slate-100 transition-colors ${isInactive ? "bg-slate-50" : "bg-gradient-to-r from-blue-50/50 via-white to-slate-50"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* QR Code thumbnail / Avatar */}
              <div className="relative group/qr shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold shadow-xs">
                  {student.code}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {student.name}
                  </h2>
                  {isInactive ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      طالب منقطع / غير مفعّل
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      نشط ومسجل
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-medium">
                  <span>{student.academicYear}</span>
                  <span>•</span>
                  <span className="text-blue-600 font-bold">{group?.name || student.groupName}</span>
                  <span>•</span>
                  <span>المعلم: {group?.teacher || "-"}</span>
                </p>

                {/* Contacts Row */}
                <div className="flex items-center gap-3 sm:gap-4 mt-3 text-xs text-slate-600 flex-wrap">
                  {student.parentPhone && (
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-slate-500">ولي الأمر:</span>
                      <a href={`tel:${student.parentPhone}`} className="font-mono font-bold hover:text-blue-600">
                        {student.parentPhone}
                      </a>
                    </div>
                  )}

                  {student.studentPhone && (
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500">الطالب:</span>
                      <a href={`tel:${student.studentPhone}`} className="font-mono font-bold hover:text-blue-600">
                        {student.studentPhone}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-slate-500">الاشتراك:</span>
                    <span className="font-bold text-slate-800">{student.monthlyFee || 250} ج.م/شهر</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-200/60 flex-wrap">
            <button
              onClick={handleSendReportWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>إرسال تقرير لولي الأمر (واتساب)</span>
            </button>

            <button
              onClick={handleCheckParentWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer border border-amber-600/30"
              title="إرسال رسالة تحقق عبر واتساب للتأكد من أن الرقم يخص ولي الأمر وليس رقماً وهمياً"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>فحص رقم ولي الأمر (واتساب)</span>
            </button>

            <button
              onClick={handleSendQrWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>إرسال QR للواتساب</span>
            </button>

            <button
              onClick={handleToggleActive}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isInactive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
            >
              {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
              <span>{isInactive ? "إعادة تفعيل الطالب" : "تعطيل الحساب (طالب منقطع)"}</span>
            </button>

            <button
              onClick={() => {
                onEditStudent(student);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>تعديل البيانات</span>
            </button>

            <button
              onClick={() => {
                if (confirm(`هل أنت متأكد من حذف الطالب ${student.name} نهائياً؟`)) {
                  onDeleteStudent(student.id);
                  onClose();
                }
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors mr-auto cursor-pointer"
              title="حذف الطالب نهائياً"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 gap-6 bg-white text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "attendance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>سجل الحضور والغياب</span>
          </button>
          <button
            onClick={() => setActiveTab("financials")}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "financials"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>الاشتراكات الشهرية</span>
          </button>
          <button
            onClick={() => setActiveTab("grades")}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "grades"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>سجل درجات الاختبارات</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Notes callout if any */}
              {student.notes && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="w-4 h-4" />
                    <span>ملاحظات المعلم والإدارة:</span>
                  </div>
                  <p className="leading-relaxed">{student.notes}</p>
                </div>
              )}

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">حضور الحصص</span>
                  <div className="text-xl font-black text-slate-800">
                    {attendance?.filter((a: any) => a.status === "attended").length || 0} / {attendance?.length || 0}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    نسبة الالتزام: {attendance?.length ? Math.round((attendance.filter((a: any) => a.status === "attended").length / attendance.length) * 100) : 100}%
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">الاشتراكات الشهرية</span>
                  <div className="text-xl font-black text-slate-800">
                    {financials?.filter((f: any) => f.status === "paid").length || 0} شهر مسدد
                  </div>
                  <span className="text-[10px] text-slate-500">
                    قيمة الاشتراك: {student.monthlyFee} ج.م
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">متوسط درجات الاختبارات</span>
                  <div className="text-xl font-black text-blue-600 font-mono">
                    {grades?.length > 0
                      ? `${Math.round(
                          (grades.reduce((acc: number, g: any) => acc + (g.score / g.totalScore), 0) /
                            grades.length) *
                            100
                        )}%`
                      : "لا يوجد"}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {grades?.length || 0} اختبارات مسجلة
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">سجل أيام الحضور والغياب</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    حاضر
                  </span>
                  <span className="flex items-center gap-1 text-red-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    غائب
                  </span>
                </div>
              </div>

              {attendance && attendance.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attendance.map((rec: any) => {
                    const isAttended = rec.status === "attended";
                    return (
                      <div
                        key={rec.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                          isAttended
                            ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                            : "bg-red-50/60 border-red-200 text-red-950"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isAttended ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <div>
                            <span className="text-xs font-bold">{rec.date}</span>
                            {rec.time && (
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{rec.time}</span>
                                {rec.method === "camera_qr" && (
                                  <span className="text-blue-600 font-semibold">(مسح QR)</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isAttended
                              ? "bg-emerald-200/60 text-emerald-800"
                              : "bg-red-200/60 text-red-800"
                          }`}
                        >
                          {isAttended ? "حاضر" : "غائب"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
                  لا توجد تسجيلات حضور حتى الآن
                </div>
              )}
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-700 block">
                تاريخ دفع الاشتراكات الشهرية
              </span>

              {financials && financials.length > 0 ? (
                <div className="space-y-2.5">
                  {financials.map((fin: any) => {
                    const isPaid = fin.status === "paid" && fin.paidAmount >= fin.totalAmount;
                    const isPartial = fin.status === "paid" && fin.paidAmount < fin.totalAmount;
                    const isReturned = fin.status === "returned";
                    const isUnpaid = fin.status === "unpaid";

                    return (
                      <div
                        key={fin.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                          isPaid
                            ? "bg-emerald-50/50 border-emerald-200"
                            : isPartial
                            ? "bg-amber-50/60 border-amber-200 text-amber-900"
                            : isReturned
                            ? "bg-slate-100 border-slate-200 text-slate-600"
                            : "bg-red-50/50 border-red-200 text-red-900"
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span>شهر {fin.month}</span>
                            {isPartial && (
                              <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded-full text-amber-800 font-bold">
                                دفع جزئي
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            المدفوع: {fin.paidAmount || 0} ج.م من {fin.totalAmount || student.monthlyFee} ج.م
                            {fin.notes && ` • ${fin.notes}`}
                          </p>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            isPaid
                              ? "bg-emerald-600 text-white"
                              : isPartial
                              ? "bg-amber-600 text-white"
                              : isReturned
                              ? "bg-slate-300 text-slate-700"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {isPaid
                            ? "مدفوع بالكامل"
                            : isPartial
                            ? `مدفوع ${fin.paidAmount} ج.م`
                            : isReturned
                            ? "مسترجع"
                            : "غير مدفوع"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
                  لا توجد اشتراكات مسجلة
                </div>
              )}
            </div>
          )}

          {activeTab === "grades" && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-700 block">
                سجل درجات الاختبارات والامتحانات
              </span>

              {grades && grades.length > 0 ? (
                <div className="space-y-2.5">
                  {grades.map((grd: any) => {
                    const percentage = Math.round((grd.score / grd.totalScore) * 100);
                    return (
                      <div
                        key={grd.id}
                        className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <span className="font-bold text-slate-800 block text-sm">
                            {grd.examName}
                          </span>
                          <p className="text-[11px] text-slate-400">
                            {grd.date || "اختبار دوري"}
                            {grd.method === "camera_ai" && (
                              <span className="text-blue-600 font-semibold mr-2">(رصد عبر AI كاميرا)</span>
                            )}
                          </p>
                        </div>

                        <div className="text-left">
                          <div className="text-base font-black text-blue-600 font-mono">
                            {grd.score} / {grd.totalScore}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">
                            النسبة: {percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
                  لا توجد درجات مسجلة لهذا الطالب حتى الآن
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
