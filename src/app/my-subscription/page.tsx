import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  CreditCard,
  Calendar,
  HardDrive,
  FileText,
  FolderUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Zap,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatBytes(bytes: bigint | number): string {
  const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!num || num === 0) return "0 ميجابايت";
  const k = 1024;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت", "تيرابايت"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default async function MySubscriptionPage() {
  const session = await getSessionUser();
  if (!session || !session.id) {
    redirect("/login");
  }

  // Fetch tenant details, usage, and limits
  let tenant: any = null;
  let examsCount = 0;
  let filesCount = 0;

  try {
    const [tenantData, examsTotal, filesTotal] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: session.id },
      }),
      prisma.exam.count({
        where: { tenantId: session.id },
      }),
      prisma.uploadedFile.count({
        where: { tenantId: session.id },
      }),
    ]);

    tenant = tenantData;
    examsCount = examsTotal;
    filesCount = filesTotal;
  } catch (error) {
    console.error("Subscription page fetch error:", error);
  }

  // Fallback defaults if new user or offline DB
  const planType = tenant?.planType || "الخطة الاحترافية للمعلمين (Teacher Pro)";
  const status = tenant?.subscriptionStatus || "ACTIVE";
  const isActive = status === "ACTIVE";

  // Calculate Due Date (defaults to 1 year from creation if null)
  const createdAt = tenant?.createdAt ? new Date(tenant.createdAt) : new Date();
  const dueDate = tenant?.subscriptionDueDate
    ? new Date(tenant.subscriptionDueDate)
    : new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Storage calculation
  const storageLimitBytes = tenant?.storageLimitBytes ?? BigInt(1073741824); // 1GB
  const usedStorageBytes = tenant?.usedStorageBytes ?? BigInt(0);
  const storageLimitNum = Number(storageLimitBytes);
  const usedStorageNum = Number(usedStorageBytes);
  const storagePercent = Math.min(
    100,
    storageLimitNum > 0 ? Math.round((usedStorageNum / storageLimitNum) * 100) : 0
  );

  // Limits
  const examsLimit = 150;
  const examsPercent = Math.min(100, Math.round((examsCount / examsLimit) * 100));

  const filesLimit = 200;
  const filesPercent = Math.min(100, Math.round((filesCount / filesLimit) * 100));

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 sm:p-10" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-blue-600" />
              <span>تفاصيل اشتراكي والخطة (My Subscription)</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              معلومات خطتك الحالية، موعد التجديد، وسعة التخزين والحدود المتاحة
            </p>
          </div>

          {/* Status Pill */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold border shadow-xs ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {isActive ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>الاشتراك ساري ونشط</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>الاشتراك معلق / متوقف</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Section 1: Subscription Due Date & Plan Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Plan Info */}
            <div className="lg:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-100">
                <Sparkles className="w-3.5 h-3.5" />
                <span>الخطة الحالية</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">{planType}</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                تمنحك هذه الخطة وصولاً كاملاً إلى الذكاء الاصطناعي لاستخراج الأسئلة، رفع ملفات PDF عالية الدقة، دمج الصور، مع سعة تخزين سحابية خاصة بك.
              </p>
            </div>

            {/* Due Date Countdown Box */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">
                تاريخ استحقاق التجديد (Due Date)
              </span>
              <span className="text-lg font-black text-slate-900 mt-1">
                {dueDate.toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-100/60 px-3 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                <span>متبقي {diffDays} يوم</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Usage Limits & Quotas (Three Cards) */}
        <div className="space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <span>حدود الاستهلاك والمساحة (Usage & Limits)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Storage Limit Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-xl">
                  {storagePercent}%
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  سعة التخزين (Storage Limit)
                </h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-slate-900">
                    {formatBytes(usedStorageBytes)}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {formatBytes(storageLimitBytes)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                المتبقي: {formatBytes(BigInt(Math.max(0, storageLimitNum - usedStorageNum)))}
              </p>
            </div>

            {/* Exams Limit Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">
                  {examsPercent}%
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  حد الاختبارات (Exams Quota)
                </h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-slate-900">{examsCount}</span>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {examsLimit} اختبار
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${examsPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                متاح إنشاء {Math.max(0, examsLimit - examsCount)} اختبار إضافي
              </p>
            </div>

            {/* Uploaded Files Limit Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FolderUp className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">
                  {filesPercent}%
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  المستندات المرفوعة (Uploaded Files)
                </h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-slate-900">{filesCount}</span>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {filesLimit} ملف
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${filesPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                متاح رفع {Math.max(0, filesLimit - filesCount)} ملف إضافي
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Features Included */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>المميزات المضمنة في باقتك</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">استخراج الأسئلة بالذكاء الاصطناعي</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">تحليل وتفريغ الأسئلة من الصور والـ PDF تلقائياً</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">سحب وإفلات على صفحات A4</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">تصميم امتحانات احترافية جاهزة للطباعة الفورية</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">تحويل وتجميع الصور إلى PDF</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">دمج المستندات وإعادة ترتيبها بدقة عالية</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
