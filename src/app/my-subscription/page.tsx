import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma, isDatabaseReachable } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { findTenantById, findTenantByPhone, findTenantByDomain } from "@/lib/tenants-repository";
import { getTenantUsageStats } from "@/lib/db";
import {
  APP_FEATURES_REGISTRY,
  SIDEBAR_SECTIONS_ORDER,
  normalizeEnabledFeatures,
} from "@/lib/app-features";
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
  Building2,
  GraduationCap,
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

  let tenant: any = null;
  let examsCount = 0;
  let filesCount = 0;
  const localUsage = getTenantUsageStats(session.id);

  try {
    const h = await headers();
    const host = (h.get("host") || "").split(":")[0].trim().toLowerCase();
    const domainTenant = host ? await findTenantByDomain(host) : null;
    const isDedicatedTenantDomain = Boolean(
      domainTenant &&
        host !== "exambuilderapp.oqabagency.com" &&
        host !== "exambuilderadmin.oqabagency.com" &&
        host !== "localhost" &&
        host !== "127.0.0.1"
    );
    const userTenant =
      (await findTenantById(session.id)) || (await findTenantByPhone(session.phone));
    tenant = isDedicatedTenantDomain ? domainTenant : userTenant || domainTenant;
    const isReachable = await isDatabaseReachable();
    if (isReachable) {
      const [examsTotal, filesTotal] = await Promise.all([
        prisma.exam.count({
          where: { tenantId: session.id },
        }),
        prisma.uploadedFile.count({
          where: { tenantId: session.id },
        }),
      ]);

      examsCount = Math.max(examsTotal, localUsage.examsCount);
      filesCount = Math.max(filesTotal, localUsage.filesCount);
    } else {
      examsCount = localUsage.examsCount;
      filesCount = localUsage.filesCount;
    }
  } catch {
    examsCount = localUsage.examsCount;
    filesCount = localUsage.filesCount;
  }

  const clientName = tenant?.name || session.name || "العميل المشترك";
  const subscriptionType = tenant?.subscriptionType === "معلم" ? "معلم" : "سنتر";
  const planType =
    tenant?.planType ||
    (subscriptionType === "سنتر" ? "باقة إدارة السنتر المتكاملة" : "باقة المعلم الذكي");
  const status = tenant?.subscriptionStatus || "ACTIVE";
  const isActive = status === "ACTIVE";
  const enabledFeatures = normalizeEnabledFeatures(tenant?.enabledFeatures);

  // Start Date & Due Date
  const createdAt = tenant?.createdAt ? new Date(tenant.createdAt) : new Date();
  const startDate = tenant?.subscriptionStartDate
    ? new Date(tenant.subscriptionStartDate)
    : createdAt;
  const dueDate = tenant?.subscriptionDueDate
    ? new Date(tenant.subscriptionDueDate)
    : new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Storage calculation
  const storageLimitBytes = tenant?.storageLimitBytes ?? 1073741824; // 1GB
  const usedStorageBytes = Math.max(
    Number(tenant?.usedStorageBytes ?? 0),
    localUsage.usedStorageBytes
  );
  const storageLimitNum = Number(storageLimitBytes);
  const usedStorageNum = Number(usedStorageBytes);
  const storagePercent = Math.min(
    100,
    storageLimitNum > 0 ? Math.round((usedStorageNum / storageLimitNum) * 100) : 0
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 sm:p-10" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-blue-600" />
              <span>تفاصيل اشتراك: {clientName}</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              معلومات الباقة، فترة الاشتراك، وسعة المساحة السحابية
            </p>
          </div>

          {/* Status & Subscription Type Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {subscriptionType === "معلم" ? (
                <GraduationCap className="w-4 h-4" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              <span>نوع الاشتراك: {subscriptionType}</span>
            </span>

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

        {/* Section 1: Subscription Dates & Plan Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Plan Info */}
            <div className="lg:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-100">
                <Sparkles className="w-3.5 h-3.5" />
                <span>الخطة الحالية ({subscriptionType})</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">{planType}</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                نسخة مخصصة باسم ({clientName}) مفعلة ومتصلة بسيرفر المنصة السحابي.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-bold text-slate-600">
                <span className="bg-slate-100 px-3 py-1.5 rounded-xl">
                  تاريخ بداية الاشتراك:{" "}
                  <strong className="text-slate-900">
                    {startDate.toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </strong>
                </span>
                {tenant?.domain && (
                  <span className="bg-slate-100 px-3 py-1.5 rounded-xl font-mono" dir="ltr">
                    {tenant.domain}
                  </span>
                )}
              </div>
            </div>

            {/* Due Date Countdown Box */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">
                تاريخ نهاية الاشتراك (End Date)
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

        {/* Section 2: Storage Limit Only */}
        <div className="space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <span>سعة المساحة السحابية (Storage Capacity)</span>
          </h3>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 max-w-md">
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
        </div>
      </div>
    </div>
  );
}
