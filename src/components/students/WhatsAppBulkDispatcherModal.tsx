"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MessageCircle,
  Phone,
  Send,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Student, Group } from "@/lib/types/management";
import { generateQrDataUrl } from "@/lib/qr-service";

export type BulkWhatsAppActionType = "parent_check" | "send_qr" | "send_report" | "qr" | "report";

interface WhatsAppBulkDispatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: BulkWhatsAppActionType;
  students: Student[];
  group?: Group | null;
  groupName?: string;
}

export default function WhatsAppBulkDispatcherModal({
  isOpen,
  onClose,
  actionType,
  students,
  group,
  groupName,
}: WhatsAppBulkDispatcherModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentStudentIds, setSentStudentIds] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedQr, setCopiedQr] = useState(false);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const isQr = actionType === "send_qr" || actionType === "qr";
  const isReport = actionType === "send_report" || actionType === "report";

  const currentStudent = students[currentIndex] || students[0];
  const total = students.length;
  const progressPercent = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  // Generate QR or fetch Profile when current student changes
  useEffect(() => {
    if (!isOpen || !currentStudent) return;

    if (isQr) {
      setQrDataUrl("");
      generateQrDataUrl(currentStudent.code, 280).then((url) => {
        setQrDataUrl(url);
      });
    }

    if (isReport) {
      setIsLoadingProfile(true);
      fetch(`/api/students?id=${currentStudent.id}&profile=true`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.profile) {
            setStudentProfile(data.profile);
          } else {
            setStudentProfile(null);
          }
        })
        .catch((e) => {
          console.error(e);
          setStudentProfile(null);
        })
        .finally(() => setIsLoadingProfile(false));
    }
  }, [isOpen, currentStudent?.id, currentStudent?.code, isQr, isReport]);

  if (!isOpen || students.length === 0 || !currentStudent) return null;

  const getTitle = () => {
    if (actionType === "parent_check") {
      return "فحص والتحقق من أرقام أولياء الأمور عبر واتساب";
    }
    if (isQr) {
      return "إرسال بطاقة ورمز QR للطلاب عبر واتساب";
    }
    return "إرسال تقرير متابعة الطالب لولي الأمر عبر واتساب";
  };

  const handleCopyQrImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 2500);
    } catch (err) {
      console.error("Clipboard copy error:", err);
      alert("تعذر نسخ الصورة إلى الحافظة في هذا المتصفح، يمكنك تحميل الصورة واستخدامها مباشرة.");
    }
  };

  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-${currentStudent.name}-${currentStudent.code}.png`;
    a.click();
  };

  const handleOpenPrintableCard = () => {
    const url = `/qr-printing?groupId=${currentStudent.groupId}&studentIds=${currentStudent.id}`;
    window.open(url, "_blank");
  };

  const generateMessage = (student: Student) => {
    const finalGroupName = groupName || group?.name || student.groupName || "المجموعة التعليمية";
    const teacherName = group?.teacher ? `للأستاذ / ${group.teacher}` : "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const parentPortalUrl = `${origin}/s/${student.code}`;

    if (actionType === "parent_check") {
      return `السلام عليكم ورحمة الله وبركاته،
تحية طيبة لحضرتك من إدارة السنتر ${teacherName}.

نود التأكد والتحقق من أن هذا الرقم المسجل لدينا يخص بالفعل ولي أمر الطالب/ة: *${student.name}* (كود الطالب: ${student.code}) المقيد لدينا في: ${finalGroupName}.

نرجو من سيادتكم التكرم بالرد وتأكيد الاستلام، للتأكد من صحة بيانات الاتصال والاطمئنان لعدم تسجيل رقم غير صحيح أو وهمي، حتى تصلكم تقارير الحضور والغياب ودرجات الاختبارات والمصروفات أولاً بأول.

شاكرين لحضرتكم حسن التعاون ونسعد دائماً بتواصلكم!`;
    }

    if (isQr) {
      const pdfPrintUrl = `${origin}/qr-printing?groupId=${student.groupId}&studentIds=${student.id}`;
      return `مرحباً بحضرتك، ولي أمر الطالب/ة: *${student.name}*
كود الطالب: *${student.code}*
المجموعة: ${finalGroupName} (${student.academicYear})

📲 بطاقة كود الحضور الذكي (QR Code) الخاصة بالطالب جاهزة ومعتمدة.
يرجى حفظ كود الـ QR وإبرازه عند الحضور في كل حصة للمسح الفوري.

📄 للاطلاع على بطاقة QR وتحميلها أو طباعتها كملف PDF:
${pdfPrintUrl}

🌐 رابط صفحة متابعة الطالب لولي الأمر:
${parentPortalUrl}`;
    }

    // Report action
    const attendanceList = studentProfile?.attendance || [];
    const gradesList = studentProfile?.grades || [];
    const financialsList = studentProfile?.financials || [];

    const attendedCount = attendanceList.filter((a: any) => a.status === "attended").length;
    const absentCount = attendanceList.filter((a: any) => a.status === "absent").length;

    const latestGrade = gradesList.length > 0 ? gradesList[0] : null;

    const paidMonths = financialsList
      .filter((f: any) => f.status === "paid" && (f.paidAmount || 0) >= (f.totalAmount || student.monthlyFee || 250))
      .map((f: any) => f.month);
    const partialMonths = financialsList
      .filter((f: any) => (f.paidAmount || 0) > 0 && (f.paidAmount || 0) < (f.totalAmount || student.monthlyFee || 250))
      .map((f: any) => `${f.month} (${f.paidAmount}/${f.totalAmount || student.monthlyFee || 250} ج.م)`);
    const unpaidMonths = financialsList
      .filter((f: any) => f.status === "unpaid" || ((f.paidAmount || 0) === 0 && f.status !== "paid"))
      .map((f: any) => f.month);

    const gradeText = latestGrade
      ? `• آخر اختبار: *${latestGrade.examName}* (الدرجة: *${latestGrade.score}* من *${latestGrade.totalScore}*)`
      : "• لم يتم رصد درجات اختبارات مؤخراً";

    const paidText =
      paidMonths.length > 0
        ? `• الشهور المسددة بالكامل: ${paidMonths.join("، ")}`
        : "• لا توجد شهور مسجلة كمسددة بالكامل";

    const partialText =
      partialMonths.length > 0
        ? `\n• شهور مسددة جزئياً: ${partialMonths.join("، ")}`
        : "";

    const unpaidText =
      unpaidMonths.length > 0
        ? `\n• الشهور المستحقة: ${unpaidMonths.join("، ")}`
        : partialMonths.length === 0
        ? "\n• كافة الاشتراكات مسددة بالكامل بنجاح"
        : "";

    return `السلام عليكم ورحمة الله وبركاته،
ولي أمر الطالب/ة: *${student.name}* المحترم،
تحية طيبة لحضرتك من إدارة السنتر ${teacherName}.

📊 *تقرير المتابعة الأكاديمية والمالية الدوري:*
• كود الطالب: ${student.code}
• المجموعة: ${finalGroupName} (${student.academicYear})

🟢 *سجل الحضور والغياب:*
• عدد مرات الحضور: ${attendedCount} حصة
• عدد مرات الغياب: ${absentCount} حصة

📝 *نتائج الاختبارات والتقييم:*
${gradeText}

💳 *موقف الاشتراكات الشهرية:*
${paidText}${partialText}${unpaidText}

🔗 *رابط المتابعة المباشر والشامل لولي الأمر (بدون تسجيل دخول):*
${parentPortalUrl}

مع تحيات إدارة المجموعة وتمنياتنا بدوام التفوق والنجاح!`;
  };

  const messageText = generateMessage(currentStudent);
  const rawPhone = currentStudent.parentPhone?.replace(/\D/g, "") || "";
  const cleanPhone = rawPhone.startsWith("0") ? "2" + rawPhone : rawPhone;
  const hasPhone = Boolean(rawPhone);

  const handleOpenCurrentWhatsApp = () => {
    if (!hasPhone) {
      alert("رقم هاتف ولي الأمر غير مسجل لهذا الطالب");
      return;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    // Using a named window target 'exam_builder_whatsapp' reuses the single tab and avoids multi-tab popup hell!
    window.open(url, "exam_builder_whatsapp");

    if (!sentStudentIds.includes(currentStudent.id)) {
      setSentStudentIds((prev) => [...prev, currentStudent.id]);
    }

    // Auto move to next student if available
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const isCurrentSent = sentStudentIds.includes(currentStudent.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none" dir="rtl">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                {getTitle()}
              </h3>
              <p className="text-[11px] text-slate-400">
                إرسال متتابع في نافذة واحدة لتجنب فتح نوافذ متعددة في المتصفح
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-100 h-1.5 w-full">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              طالب <strong className="text-emerald-600 font-mono">{currentIndex + 1}</strong> من{" "}
              <strong className="font-mono">{total}</strong>
            </span>
            <span>
              تم الإرسال لـ: <strong className="text-emerald-600 font-mono">{sentStudentIds.length}</strong> طالب
            </span>
          </div>

          {/* Current Student Card */}
          <div className="p-4 rounded-2xl border-2 border-slate-200/80 bg-slate-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-base">
                {currentStudent.name}
              </h4>
              <span className="font-mono font-bold text-xs text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                كود: {currentStudent.code}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono font-bold" dir="ltr">
                  {currentStudent.parentPhone || "لا يوجد هاتف مسجل"}
                </span>
              </div>

              {isCurrentSent ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>تم الفتح</span>
                </span>
              ) : !hasPhone ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  <span>هاتف غير متوفر</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  في الانتظار
                </span>
              )}
            </div>
          </div>

          {/* QR Action Card Preview & Options */}
          {isQr && (
            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-16 h-16 rounded-xl bg-white p-1 border border-emerald-300 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white border border-dashed border-emerald-300 flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-emerald-400 animate-pulse" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-800">بطاقة كود الحضور الذكي (QR)</div>
                  <div className="text-[11px] text-slate-500">انسخ الصورة للصقها مباشرة في واتساب أو افتح PDF</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyQrImage}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="نسخ الصورة للحافظة للصقها مباشرة في محادثة واتساب (Ctrl+V)"
                >
                  {copiedQr ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedQr ? "تم النسخ!" : "نسخ صورة الـ QR"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQrImage}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  title="تحميل كصورة PNG"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenPrintableCard}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="طباعة / تحميل بطاقة PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>بطاقة PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* Report Live Summary */}
          {isReport && (
            <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200/70 text-xs text-slate-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900">ملخص بيانات التقرير الحالي:</span>
                {isLoadingProfile && (
                  <span className="text-[11px] text-blue-600 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>تحديث البيانات...</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-blue-100 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                    <span>حضور:</span>
                    <span className="font-mono">
                      {(studentProfile?.attendance || []).filter((a: any) => a.status === "attended").length}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-red-200">
                    <span>غياب:</span>
                    <span className="font-mono">
                      {(studentProfile?.attendance || []).filter((a: any) => a.status === "absent").length}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600">آخر درجة: </span>
                  <strong className="text-indigo-700 font-mono">
                    {studentProfile?.grades?.[0]
                      ? `${studentProfile.grades[0].score} / ${studentProfile.grades[0].totalScore}`
                      : "لا يوجد"}
                  </strong>
                </div>

                <a
                  href={`${typeof window !== "undefined" ? window.location.origin : ""}/s/${currentStudent.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold text-[11px] bg-white px-2 py-0.5 rounded-lg border border-blue-200"
                >
                  <span>رابط المتابعة</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Message Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">نص الرسالة التي سيتم إرسالها:</label>
            <div className="p-3 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 font-sans whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed select-text">
              {messageText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-slate-700 font-bold"
              title="الطالب السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={currentIndex >= total - 1}
              onClick={() => setCurrentIndex((p) => Math.min(total - 1, p + 1))}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-slate-700 font-bold"
              title="الطالب التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            <button
              type="button"
              disabled={!hasPhone}
              onClick={handleOpenCurrentWhatsApp}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال عبر واتساب والانتقال للتالي</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
