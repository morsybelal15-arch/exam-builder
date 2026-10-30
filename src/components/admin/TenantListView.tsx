"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditSubscriptionModal, { TenantData } from "./EditSubscriptionModal";
import {
  extendSubscriptionAction,
  toggleTenantStatusAction,
} from "@/app/actions/admin-tenants";
import {
  autoDeployTenantVpsAction,
  syncAllTenantsToVpsAction,
} from "@/app/actions/vps-provisioning";
import {
  Search,
  Users,
  Globe,
  HardDrive,
  FileText,
  FolderUp,
  Phone,
  Edit3,
  Pause,
  Play,
  Check,
  ExternalLink,
  Server,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  RefreshCw,
  Plus,
  Loader2,
  Sparkles,
  Layers,
  Building2,
  GraduationCap,
} from "lucide-react";
import { HOSTINGER_VPS_CONFIG, generateNginxConfig } from "@/lib/vps-service";
import {
  ALL_FEATURE_IDS,
  APP_FEATURES_REGISTRY,
  normalizeEnabledFeatures,
} from "@/lib/app-features";
import {
  DEFAULT_STORAGE_LIMIT_BYTES,
  formatUsedStorageShortArabic,
  formatStorageLimitMbArabic,
  computeStoragePercent,
} from "@/lib/storage-format";

interface TenantListViewProps {
  initialTenants: TenantData[];
  onOpenCreateModal?: () => void;
}

function getDaysRemaining(dueDateStr?: string | Date | null): {
  days: number;
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
} {
  if (!dueDateStr) {
    return { days: 0, text: "غير محدد", isUrgent: false, isExpired: false };
  }
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      days: diffDays,
      text: `منتهي منذ ${Math.abs(diffDays)} يوم`,
      isUrgent: true,
      isExpired: true,
    };
  }
  if (diffDays <= 7) {
    return {
      days: diffDays,
      text: `ينتهي خلال ${diffDays} أيام!`,
      isUrgent: true,
      isExpired: false,
    };
  }
  return {
    days: diffDays,
    text: `متبقي ${diffDays} يوم`,
    isUrgent: false,
    isExpired: false,
  };
}

export default function TenantListView({
  initialTenants,
  onOpenCreateModal,
}: TenantListViewProps) {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantData[]>(initialTenants);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "STOPPED" | "EXPIRED">("ALL");
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedVpsId, setCopiedVpsId] = useState<string | null>(null);
  const [deployingTenantId, setDeployingTenantId] = useState<string | null>(null);
  const [deployFeedback, setDeployFeedback] = useState<{
    [id: string]: { success: boolean; message: string };
  }>({});
  const [isPending, setIsPending] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    setTenants(initialTenants);
  }, [initialTenants]);

  const patchLocalTenant = (updated?: Partial<TenantData> & { id?: string }) => {
    if (!updated || !updated.id) return;
    setTenants((prev) =>
      prev.map((t) => (t.id === updated.id ? ({ ...t, ...updated } as TenantData) : t))
    );
    setEditingTenant((prev) =>
      prev && prev.id === updated.id ? ({ ...prev, ...updated } as TenantData) : prev
    );
  };

  const reportSync = (res: any, okMsg: string) => {
    if (!res) return;
    if (res.success === false || res.error) {
      setSyncNotice({ success: false, message: res.error || res.message || "فشلت العملية" });
      return;
    }
    if (res.vpsSync && res.vpsSync.synced === false) {
      setSyncNotice({
        success: false,
        message: `تم الحفظ محلياً لكن فشلت المزامنة مع VPS: ${res.vpsSync.message || ""}. اضغط "مزامنة الكل مع VPS".`,
      });
      return;
    }
    setSyncNotice({ success: true, message: okMsg });
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res: any = await syncAllTenantsToVpsAction();
      setSyncNotice({
        success: !!res.success,
        message: res.message || (res.success ? "تمت المزامنة" : "فشلت المزامنة"),
      });
      router.refresh();
    } catch (err: any) {
      setSyncNotice({ success: false, message: err.message || "فشلت المزامنة" });
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Filtered tenants list
  const filteredTenants = tenants.filter((tenant) => {
    const nameMatch = tenant.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = tenant.phone.includes(searchTerm);
    const domainMatch = tenant.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = !searchTerm || nameMatch || phoneMatch || domainMatch;

    let matchesStatus = true;
    if (statusFilter === "ACTIVE") matchesStatus = tenant.subscriptionStatus === "ACTIVE";
    if (statusFilter === "STOPPED") matchesStatus = tenant.subscriptionStatus === "STOPPED";
    if (statusFilter === "EXPIRED") matchesStatus = tenant.subscriptionStatus === "EXPIRED";

    return matchesSearch && matchesStatus;
  });

  const handleCopyVpsNginx = (tenant: TenantData) => {
    const domain = tenant.domain || "example.com";
    const configStr = generateNginxConfig(domain);
    navigator.clipboard.writeText(configStr);
    setCopiedVpsId(tenant.id);
    setTimeout(() => setCopiedVpsId(null), 2500);
  };

  const handleAutoDeploy = async (tenant: TenantData) => {
    if (!tenant.domain) return;
    setDeployingTenantId(tenant.id);
    setIsPending(true);
    try {
      const res = await autoDeployTenantVpsAction(tenant.id, tenant.domain!);
      setDeployFeedback((prev) => ({
        ...prev,
        [tenant.id]: { success: res.success, message: res.message },
      }));
    } catch (err: any) {
      setDeployFeedback((prev) => ({
        ...prev,
        [tenant.id]: { success: false, message: err.message || "فشل التفعيل" },
      }));
    } finally {
      setDeployingTenantId(null);
      setIsPending(false);
    }
  };

  const handleToggleStatus = async (tenantId: string) => {
    setIsPending(true);
    try {
      const res: any = await toggleTenantStatusAction(tenantId);
      if (res?.tenant) {
        patchLocalTenant(res.tenant);
      } else if (res?.newStatus) {
        patchLocalTenant({ id: tenantId, subscriptionStatus: res.newStatus });
      }
      reportSync(res, "تم تغيير حالة الاشتراك ومزامنته مع تطبيق العميل والسيرفر فوراً ✓");
    } finally {
      setIsPending(false);
    }
  };

  const handleQuickExtend = async (tenantId: string) => {
    setIsPending(true);
    try {
      const res: any = await extendSubscriptionAction(tenantId, 30);
      if (res?.tenant) {
        patchLocalTenant(res.tenant);
      } else if (res?.newDueDate) {
        patchLocalTenant({
          id: tenantId,
          subscriptionDueDate: res.newDueDate,
          subscriptionStatus: "ACTIVE",
        });
      }
      reportSync(res, "تم تمديد الاشتراك 30 يوماً ومزامنته مع تطبيق العميل ✓");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Unified Section Header & Toolbar Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        {/* Top Row: Title + Live Sync Notice + Sync All Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                إدارة المستأجرين والاشتراكات
              </h2>
              <span className="text-[11px] font-extrabold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                {tenants.length} مشترك
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                مزامنة لحظية شاملة: أي تعديل في المواعيد أو نوع الاشتراك أو خواص الـ Sidebar يُطبَّق فوراً في تطبيق العميل
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              id="sync-all-vps-btn"
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              {isSyncingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{isSyncingAll ? "جاري المزامنة..." : "مزامنة الكل مع VPS"}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Search Bar + Status Filter Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم العميل، رقم الهاتف، أو الدومين..."
              className="w-full pl-3.5 pr-10 h-10 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 ml-1 whitespace-nowrap">
              <Filter className="w-3.5 h-3.5" />
              <span>الحالة:</span>
            </span>

            <button
              onClick={() => setStatusFilter("ALL")}
              className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              الكل ({tenants.length})
            </button>

            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === "ACTIVE"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 border border-emerald-200/60"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                النشطة ({tenants.filter((t) => t.subscriptionStatus === "ACTIVE").length})
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("STOPPED")}
              className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === "STOPPED"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 border border-amber-200/60"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>
                الموقوفة ({tenants.filter((t) => t.subscriptionStatus === "STOPPED").length})
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("EXPIRED")}
              className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === "EXPIRED"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-red-50 text-red-700 hover:bg-red-100/70 border border-red-200/60"
              }`}
            >
              <span>
                المنتهية ({tenants.filter((t) => t.subscriptionStatus === "EXPIRED").length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {syncNotice && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-bold flex items-center justify-between gap-2 border ${
            syncNotice.success
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {syncNotice.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            {syncNotice.message}
          </span>
          <button
            onClick={() => setSyncNotice(null)}
            className="cursor-pointer opacity-60 hover:opacity-100"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tenants Table Card - Full Width */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredTenants.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {searchTerm || statusFilter !== "ALL"
                ? "لا توجد نتائج مطابقة لخيارات البحث"
                : "لا يوجد عملاء مسجلون بعد"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {searchTerm || statusFilter !== "ALL"
                ? "جرب كتابة رقم هاتف أو اسم آخر أو تغيير الفلتر."
                : "ابدأ بتسطيب أول تطبيق لعميل جديد وتخصيص الدومين والـ Features الخاصة به."}
            </p>
            {onOpenCreateModal && (
              <button
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تسطيب تطبيق عميل جديد</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-extrabold text-slate-500 whitespace-nowrap">
                  <th className="py-4 px-6">العميل ونوع الاشتراك</th>
                  <th className="py-4 px-5">رقم الدخول والدومين</th>
                  <th className="py-4 px-5">فترة الاشتراك (Calendar)</th>
                  <th className="py-4 px-5">خواص التطبيق المثبتة (Sidebar)</th>
                  <th className="py-4 px-5">استهلاك الموارد</th>
                  <th className="py-4 px-5 text-center">الحالة</th>
                  <th className="py-4 px-6 text-left">التحكم بالاشتراك والخواص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredTenants.map((tenant) => {
                  const usedBytesNum = Number(tenant.usedStorageBytes) || 0;
                  const limitBytesNum =
                    Number(tenant.storageLimitBytes) || DEFAULT_STORAGE_LIMIT_BYTES;
                  const {
                    exactPercent: storagePercent,
                    barWidthPercent,
                    displayPercent,
                  } = computeStoragePercent(usedBytesNum, limitBytesNum);
                  const dueInfo = getDaysRemaining(tenant.subscriptionDueDate);
                  const subType = tenant.subscriptionType === "معلم" ? "معلم" : "سنتر";
                  const installedFeatures = normalizeEnabledFeatures(tenant.enabledFeatures);
                  const availableToAddCount = ALL_FEATURE_IDS.length - installedFeatures.length;
                  const startDateDisplay = tenant.subscriptionStartDate
                    ? new Date(tenant.subscriptionStartDate).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : new Date(tenant.createdAt).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                  const dueDateDisplay = tenant.subscriptionDueDate
                    ? new Date(tenant.subscriptionDueDate).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "غير محدد";

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Client Name & Subscription Type */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                            {subType === "معلم" ? (
                              <GraduationCap className="w-5 h-5" />
                            ) : (
                              <Building2 className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <span className="block font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                              {tenant.name || "عميل بدون اسم"}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                  subType === "سنتر"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                                    : "bg-purple-50 text-purple-700 border border-purple-200/60"
                                }`}
                              >
                                <span>اشتراك {subType}</span>
                              </span>
                              {tenant.notes && tenant.notes.trim() && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                                  title={tenant.notes}
                                >
                                  <span>📌 رسالة مثبتة</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Phone & Domain */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="space-y-1.5">
                          <div
                            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 bg-slate-100/80 px-2.5 py-0.5 rounded-lg"
                            dir="ltr"
                          >
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{tenant.phone}</span>
                          </div>
                          {tenant.domain ? (
                            <div>
                              <a
                                href={`https://${tenant.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                dir="ltr"
                                title="فتح تطبيق العميل على السيرفر"
                              >
                                <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{tenant.domain}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                              </a>
                              {deployFeedback[tenant.id] && (
                                <p
                                  className={`text-[10px] font-bold mt-0.5 ${
                                    deployFeedback[tenant.id].success
                                      ? "text-emerald-600"
                                      : "text-red-500"
                                  }`}
                                >
                                  {deployFeedback[tenant.id].message}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-slate-300" />
                              <span>دومين مشترك</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Subscription Start & End Dates */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-600">
                            من: <span className="text-slate-900">{startDateDisplay}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-600">
                            إلى: <span className="text-blue-700">{dueDateDisplay}</span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-md">
                            <Clock
                              className={`w-3 h-3 shrink-0 ${
                                dueInfo.isUrgent ? "text-red-500" : "text-slate-400"
                              }`}
                            />
                            <span
                              className={`font-bold ${
                                dueInfo.isExpired
                                  ? "text-red-600"
                                  : dueInfo.isUrgent
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {dueInfo.text}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Installed Sidebar Features */}
                      <td className="py-4 px-5 min-w-[260px] max-w-[360px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                              <Layers className="w-3 h-3 shrink-0" />
                              <span>
                                {installedFeatures.length} / {ALL_FEATURE_IDS.length} خاصية مثبتة
                              </span>
                            </span>
                            {availableToAddCount > 0 && (
                              <button
                                onClick={() => {
                                  setEditingTenant(tenant);
                                  setIsModalOpen(true);
                                }}
                                className="text-[10px] font-extrabold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                title="اضغط لإضافة خواص جديدة لهذا العميل"
                              >
                                +{availableToAddCount} متاح للإضافة
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {APP_FEATURES_REGISTRY.filter((f) =>
                              installedFeatures.includes(f.id)
                            )
                              .slice(0, 4)
                              .map((f) => (
                                <span
                                  key={f.id}
                                  className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md whitespace-nowrap"
                                >
                                  {f.name}
                                </span>
                              ))}
                            {installedFeatures.length > 4 && (
                              <span className="text-[10px] font-extrabold text-slate-500 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                +{installedFeatures.length - 4} أخرى
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Resource Limits & Quotas */}
                      <td className="py-4 px-5 min-w-[200px] whitespace-nowrap">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-700 font-bold gap-3">
                            <span className="inline-flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                              <span>{formatUsedStorageShortArabic(usedBytesNum)}</span>
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              / {formatStorageLimitMbArabic(limitBytesNum)} ({displayPercent})
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                storagePercent > 90
                                  ? "bg-red-500"
                                  : storagePercent > 70
                                  ? "bg-amber-500"
                                  : "bg-blue-600"
                              }`}
                              style={{ width: `${barWidthPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 6. Subscription Status */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        {tenant.subscriptionStatus === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>نشط</span>
                          </span>
                        ) : tenant.subscriptionStatus === "STOPPED" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>موقوف</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-700 border border-red-200/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span>منتهي</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Action Buttons */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Pause / Resume button */}
                          <button
                            onClick={() => handleToggleStatus(tenant.id)}
                            disabled={isPending}
                            title={
                              tenant.subscriptionStatus === "ACTIVE"
                                ? "إيقاف مؤقت للاشتراك"
                                : "تشغيل واستئناف الاشتراك"
                            }
                            className={`h-9 w-9 inline-flex items-center justify-center rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                              tenant.subscriptionStatus === "ACTIVE"
                                ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200/60"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/60"
                            }`}
                          >
                            {tenant.subscriptionStatus === "ACTIVE" ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Quick Extend +30 Days */}
                          <button
                            onClick={() => handleQuickExtend(tenant.id)}
                            disabled={isPending}
                            title="تمديد تلقائي +30 يوم"
                            className="h-9 inline-flex items-center gap-1 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>+30 يوم</span>
                          </button>

                          {/* 1-Click Automated VPS Deploy Button */}
                          {tenant.domain && (
                            <button
                              onClick={() => handleAutoDeploy(tenant)}
                              disabled={deployingTenantId === tenant.id || isPending}
                              title="تفعيل الدومين وإعداد Nginx تلقائياً على خادم VPS"
                              className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
                                deployFeedback[tenant.id]?.success
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                              } disabled:opacity-50`}
                            >
                              {deployingTenantId === tenant.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                  <span>جاري التفعيل...</span>
                                </>
                              ) : deployFeedback[tenant.id]?.success ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>مفعل VPS</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                  <span>تفعيل VPS</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* VPS Setup Commands Copy */}
                          {tenant.domain && (
                            <button
                              onClick={() => handleCopyVpsNginx(tenant)}
                              title="نسخ كود إعداد Nginx على VPS Hostinger"
                              className="h-9 w-9 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                            >
                              {copiedVpsId === tenant.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Terminal className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </button>
                          )}

                          {/* Edit Full Subscription & Features Modal Trigger */}
                          <button
                            onClick={() => {
                              setEditingTenant(tenant);
                              setIsModalOpen(true);
                            }}
                            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-2xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5 shrink-0" />
                            <span>إدارة المواعيد والخواص</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Subscription Modal */}
      {editingTenant && (
        <EditSubscriptionModal
          key={editingTenant.id}
          tenant={editingTenant}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTenant(null);
          }}
          onTenantPatched={(updatedTenant) => {
            if (updatedTenant) patchLocalTenant(updatedTenant);
          }}
          onUpdated={(updatedTenant) => {
            if (updatedTenant) patchLocalTenant(updatedTenant);
            setSyncNotice({
              success: true,
              message: "تم حفظ تعديلات الاشتراك والمميزات ومزامنتها فوراً مع تطبيق العميل ✓",
            });
            setIsModalOpen(false);
            setEditingTenant(null);
          }}
          onDeleted={(deletedId) => {
            setTenants((prev) => prev.filter((t) => t.id !== deletedId));
            setSyncNotice({
              success: true,
              message: "تم حذف حساب العميل بنجاح ✓",
            });
          }}
        />
      )}
    </div>
  );
}
