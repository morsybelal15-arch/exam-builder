import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { findTenantById, findTenantByPhone, findTenantByDomain } from "@/lib/tenants-repository";
import { getTenantUsageStats } from "@/lib/db";
import { getManagementStore } from "@/lib/management-db";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/storage-format";
import MySubscriptionClient from "@/components/subscription/MySubscriptionClient";
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Clock,
  Building2,
  GraduationCap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MySubscriptionPage() {
  const session = await getSessionUser();
  if (!session || !session.id) {
    redirect("/login");
  }

  let tenant: any = null;
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
  } catch {
    // non-fatal
  }

  const effectiveTenantId = tenant?.id || session.id;
  const localUsage = getTenantUsageStats(effectiveTenantId);
  const mgmtStore = getManagementStore(effectiveTenantId);

  const clientName = tenant?.name || session.name || "العميل المشترك";
  const isTrial = Boolean(tenant?.isTrial || tenant?.subscriptionType === "تجربة مجانية");
  const subscriptionType = isTrial
    ? "تجربة مجانية"
    : tenant?.subscriptionType === "معلم"
    ? "معلم"
    : "سنتر";
  const planType =
    tenant?.planType ||
    (isTrial
      ? "النسخة المجانية (24 ساعة)"
      : subscriptionType === "سنتر"
      ? "باقة إدارة السنتر المتكاملة"
      : "باقة المعلم الذكي");
  const status = tenant?.subscriptionStatus || "ACTIVE";
  const isActive = status === "ACTIVE";

  // Start Date & Due Date
  const createdAt = tenant?.createdAt ? new Date(tenant.createdAt) : new Date();
  const startDate = tenant?.subscriptionStartDate
    ? new Date(tenant.subscriptionStartDate)
    : createdAt;
  const dueDate = tenant?.subscriptionDueDate
    ? new Date(tenant.subscriptionDueDate)
    : new Date(createdAt.getTime() + (isTrial ? 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000));

  const now = new Date();
  const diffTime = Math.max(0, dueDate.getTime() - now.getTime());
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

  const storageLimitBytes = Number(tenant?.storageLimitBytes || DEFAULT_STORAGE_LIMIT_BYTES);
  const usedStorageBytes = localUsage.usedStorageBytes;
  const pinnedNotice = tenant?.notes || null;
  const maxGroups = Number(tenant?.maxGroups || (isTrial ? 2 : 0));
  const maxStudents = Number(tenant?.maxStudents || (isTrial ? 10 : 0));
  const maxExtractedQuestions = Number(tenant?.maxExtractedQuestions || (isTrial ? 30 : 0));
  const extractedQuestionsUsed = Number(tenant?.extractedQuestionsUsed || 0);
  const groupsCount = (mgmtStore.groups || []).length;
  const studentsCount = (mgmtStore.students || []).length;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 sm:p-10 pb-20" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-blue-600" />
              <span>تفاصيل اشتراك: {clientName}</span>
            </h1>
          </div>

          {/* Status & Subscription Type Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-extrabold border ${
                isTrial
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {isTrial ? (
                <Clock className="w-4 h-4 text-amber-600" />
              ) : subscriptionType === "معلم" ? (
                <GraduationCap className="w-4 h-4" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              <span>
                نوع الاشتراك:{" "}
                {isTrial ? "النسخة المجانية (24 ساعة)" : subscriptionType}
              </span>
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
              </div>
            </div>

            {/* Due Date Countdown Box */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 text-center flex flex-col items-center justify-center">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                  isTrial ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                }`}
              >
                {isTrial ? <Clock className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {isTrial
                  ? "موعد انتهاء الفترة التجريبية (24 ساعة)"
                  : "تاريخ نهاية الاشتراك (End Date)"}
              </span>
              <span className="text-lg font-black text-slate-900 mt-1">
                {dueDate.toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  ...(isTrial ? { hour: "2-digit", minute: "2-digit" } : {}),
                })}
              </span>
              <div
                className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ${
                  isTrial
                    ? "text-amber-800 bg-amber-100/80"
                    : "text-blue-700 bg-blue-100/60"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {isTrial
                    ? diffTime > 0
                      ? `متبقي ${diffHours} ساعة و ${diffMinutes} دقيقة`
                      : "انتهت فترة التجربة (24 ساعة)"
                    : `متبقي ${diffDays} يوم`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pinned Admin Messages, Trial Live Quotas, Real KB/MB Storage, WhatsApp Support & Factory Reset */}
        <MySubscriptionClient
          clientName={clientName}
          initialUsedStorageBytes={usedStorageBytes}
          initialStorageLimitBytes={storageLimitBytes}
          initialPinnedNotice={pinnedNotice}
          initialIsTrial={isTrial}
          initialSubscriptionStartDate={startDate.toISOString()}
          initialSubscriptionDueDate={dueDate.toISOString()}
          initialMaxGroups={maxGroups}
          initialMaxStudents={maxStudents}
          initialMaxExtractedQuestions={maxExtractedQuestions}
          initialExtractedQuestionsUsed={extractedQuestionsUsed}
          initialGroupsCount={groupsCount}
          initialStudentsCount={studentsCount}
        />
      </div>
    </div>
  );
}
