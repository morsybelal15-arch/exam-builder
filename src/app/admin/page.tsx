import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, isDatabaseReachable } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import TenantStatusToggle from "@/components/admin/TenantStatusToggle";
import {
  Users,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  AlertCircle,
  FileText,
  UserCheck,
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

export default async function AdminDashboardPage() {
  // 1. Strict Server-Side Super Admin Authentication Verification
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/denied");
  }

  // 2. Secure Data Fetching via React Server Component
  let totalTenants = 0;
  let activeSubscriptions = 0;
  let totalStorageUsedBytes = BigInt(0);
  let tenants: Array<{
    id: string;
    name: string | null;
    phone: string;
    role: string;
    subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
    storageLimitBytes: bigint;
    usedStorageBytes: bigint;
    createdAt: Date;
    _count: {
      exams: number;
      uploadedFiles: number;
    };
  }> = [];
  let dbError: string | null = null;

  try {
    const isReachable = await isDatabaseReachable();
    if (!isReachable) {
      dbError = "قاعدة بيانات PostgreSQL غير متصلة حالياً (تأكد من تشغيل خادم قاعدة البيانات أو نشر حاوية Docker).";
    } else {
      const [tenantsCount, activeCount, tenantsList, storageAggregate] = await Promise.all([
        prisma.tenant.count({
          where: { role: "TENANT" },
        }),
        prisma.tenant.count({
          where: { role: "TENANT", subscriptionStatus: "ACTIVE" },
        }),
        prisma.tenant.findMany({
          where: { role: "TENANT" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            subscriptionStatus: true,
            storageLimitBytes: true,
            usedStorageBytes: true,
            createdAt: true,
            _count: {
              select: {
                exams: true,
                uploadedFiles: true,
              },
            },
          },
        }),
        prisma.tenant.aggregate({
          _sum: {
            usedStorageBytes: true,
          },
        }),
      ]);

      totalTenants = tenantsCount;
      activeSubscriptions = activeCount;
      tenants = tenantsList;
      totalStorageUsedBytes = storageAggregate._sum.usedStorageBytes ?? BigInt(0);
    }
  } catch (error: any) {
    dbError = "تعذر جلب بيانات المستأجرين من قاعدة البيانات في الوقت الحالي.";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  لوحة تحكم مدير النظام
                </h1>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  SUPER_ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                إدارة المعلمين، المستأجرين، وصلاحيات التخزين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/exam-builder"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/70 px-4 py-2.5 rounded-xl transition-all"
            >
              <span>منشئ الاختبارات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/70 border border-red-200/60 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Database Notice if offline */}
        {dbError && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">تنبيه اتصال قاعدة البيانات:</p>
              <p className="text-xs text-amber-700 mt-0.5">
                تأكد من تشغيل خادم PostgreSQL الخاص بك أو تطبيق الهجرات (Prisma Migrations).
              </p>
            </div>
          </div>
        )}

        {/* Section 1: Quick Stats (Three White Cards) */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Total Tenants */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex items-center gap-5 transition-all hover:shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  إجمالي المستأجرين (Total Tenants)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {totalTenants}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">معلم مسجل</span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Subscriptions */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex items-center gap-5 transition-all hover:shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  الاشتراكات النشطة (Active Subscriptions)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-black text-emerald-600 tracking-tight">
                    {activeSubscriptions}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    من أصل {totalTenants}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Total System Storage Used */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex items-center gap-5 transition-all hover:shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                <HardDrive className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  إجمالي التخزين المستخدم (Storage Used)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatBytes(totalStorageUsedBytes)}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">ملفات ومستندات</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Tenant Management Table */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span>إدارة المستأجرين والمعلمين (Tenant Management)</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                قائمة المعلمين المسجلين في النظام وإدارة تفعيل أو تعليق الحسابات مباشرة
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl">
              <span>إجمالي المسجلين:</span>
              <span className="font-bold text-slate-900">{tenants.length}</span>
            </div>
          </div>

          {tenants.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                لا يوجد مستأجرين مسجلين بعد
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                عند قيام المعلمين بإنشاء حساباتهم، ستظهر بياناتهم هنا مع إمكانية إدارة اشتراكاتهم مباشرة.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">المعلم / المستأجر</th>
                    <th className="py-4 px-6">رقم الهاتف</th>
                    <th className="py-4 px-6">نوع الخطة والمساحة</th>
                    <th className="py-4 px-6">النشاط (اختبارات / ملفات)</th>
                    <th className="py-4 px-6 text-center">حالة الحساب والتحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center border border-slate-200">
                            {(tenant.name || tenant.phone).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900">
                              {tenant.name || "معلم بدون اسم"}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-normal">
                              مسجل منذ{" "}
                              {new Date(tenant.createdAt).toLocaleDateString("ar-EG", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-6 text-xs font-semibold text-slate-700 font-mono" dir="ltr">
                        {tenant.phone}
                      </td>

                      {/* Plan Type */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          خطة قياسية (1GB)
                        </span>
                      </td>

                      {/* Activity */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>{tenant._count.exams} اختبار</span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>{tenant._count.uploadedFiles} ملف</span>
                        </div>
                      </td>

                      {/* Status & Toggle Button */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center">
                          <TenantStatusToggle
                            tenantId={tenant.id}
                            initialStatus={tenant.subscriptionStatus}
                            tenantName={tenant.name || tenant.phone}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
