"use client";

import React, { useState, useTransition } from "react";
import EditSubscriptionModal, { TenantData } from "./EditSubscriptionModal";
import {
  extendSubscriptionAction,
  toggleTenantStatusAction,
} from "@/app/actions/admin-tenants";
import {
  Search,
  Users,
  Calendar,
  Globe,
  HardDrive,
  FileText,
  FolderUp,
  Key,
  Phone,
  Edit3,
  Pause,
  Play,
  Copy,
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
  ShieldCheck,
} from "lucide-react";
import { HOSTINGER_VPS_CONFIG, generateNginxConfig } from "@/lib/vps-service";

interface TenantListViewProps {
  initialTenants: TenantData[];
  onOpenCreateModal?: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "STOPPED" | "EXPIRED">("ALL");
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vpsQuickModalTenant, setVpsQuickModalTenant] = useState<TenantData | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedVpsId, setCopiedVpsId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filtered tenants list
  const filteredTenants = initialTenants.filter((tenant) => {
    // Search match
    const nameMatch = tenant.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = tenant.phone.includes(searchTerm);
    const domainMatch = tenant.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    const codeMatch = tenant.verificationCode?.includes(searchTerm);
    const matchesSearch = !searchTerm || nameMatch || phoneMatch || domainMatch || codeMatch;

    // Status filter match
    let matchesStatus = true;
    if (statusFilter === "ACTIVE") matchesStatus = tenant.subscriptionStatus === "ACTIVE";
    if (statusFilter === "STOPPED") matchesStatus = tenant.subscriptionStatus === "STOPPED";
    if (statusFilter === "EXPIRED") matchesStatus = tenant.subscriptionStatus === "EXPIRED";

    return matchesSearch && matchesStatus;
  });

  const handleCopyCode = (tenantId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(tenantId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCopyVpsNginx = (tenant: TenantData) => {
    const domain = tenant.domain || "example.com";
    const configStr = generateNginxConfig(domain);
    navigator.clipboard.writeText(configStr);
    setCopiedVpsId(tenant.id);
    setTimeout(() => setCopiedVpsId(null), 2500);
  };

  const handleToggleStatus = (tenantId: string) => {
    startTransition(async () => {
      await toggleTenantStatusAction(tenantId);
    });
  };

  const handleQuickExtend = (tenantId: string) => {
    startTransition(async () => {
      await extendSubscriptionAction(tenantId, 30);
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، رقم الهاتف، الدومين، أو رمز التحقق..."
            className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 ml-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>الحالة:</span>
          </span>

          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            الكل ({initialTenants.length})
          </button>

          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 border border-emerald-200/60"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>النشطة ({initialTenants.filter((t) => t.subscriptionStatus === "ACTIVE").length})</span>
          </button>

          <button
            onClick={() => setStatusFilter("STOPPED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "STOPPED"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 border border-amber-200/60"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>الموقوفة ({initialTenants.filter((t) => t.subscriptionStatus === "STOPPED").length})</span>
          </button>

          <button
            onClick={() => setStatusFilter("EXPIRED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "EXPIRED"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-red-50 text-red-700 hover:bg-red-100/70 border border-red-200/60"
            }`}
          >
            <span>المنتهية ({initialTenants.filter((t) => t.subscriptionStatus === "EXPIRED").length})</span>
          </button>
        </div>
      </div>

      {/* Tenants Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredTenants.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {searchTerm || statusFilter !== "ALL"
                ? "لا توجد نتائج مطابقة لخيارات البحث"
                : "لا يوجد مستأجرين مسجلين بعد"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {searchTerm || statusFilter !== "ALL"
                ? "جرب كتابة رقم هاتف أو اسم آخر أو تغيير الفلتر لعرض جميع المستأجرين."
                : "ابدأ بإضافة أول مستأجر ومعلم وتخصيص دومين له على سيرفر Hostinger VPS مباشرة."}
            </p>
            {onOpenCreateModal && (
              <button
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مستأجر جديد الآن</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-5">المعلم / المستأجر</th>
                  <th className="py-4 px-5">الهاتف ورمز التحقق</th>
                  <th className="py-4 px-5">الدومين وخادم VPS</th>
                  <th className="py-4 px-5">خطة الاشتراك والمدة</th>
                  <th className="py-4 px-5">استهلاك الموارد</th>
                  <th className="py-4 px-5 text-center">الحالة</th>
                  <th className="py-4 px-5 text-center">أزرار التحكم التلقائية (VPS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredTenants.map((tenant) => {
                  const usedBytesNum = Number(tenant.usedStorageBytes) || 0;
                  const limitBytesNum = Number(tenant.storageLimitBytes) || 1073741824;
                  const storagePercent = Math.min(100, Math.round((usedBytesNum / limitBytesNum) * 100));
                  const examsLimit = tenant.examsLimit || 150;
                  const examsCount = tenant._count?.exams || 0;
                  const filesLimit = tenant.filesLimit || 200;
                  const filesCount = tenant._count?.uploadedFiles || 0;
                  const dueInfo = getDaysRemaining(tenant.subscriptionDueDate);

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* 1. Tenant Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                            {(tenant.name || tenant.phone).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                              {tenant.name || "معلم بدون اسم"}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-normal">
                              مسجل:{" "}
                              {new Date(tenant.createdAt).toLocaleDateString("ar-EG", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {tenant.notes && (
                              <span className="inline-block mt-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {tenant.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Phone and Verification Code */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800" dir="ltr">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{tenant.phone}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold">كود التحقق:</span>
                            <button
                              onClick={() => handleCopyCode(tenant.id, tenant.verificationCode || "123456")}
                              title="نسخ كود التحقق"
                              className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer"
                            >
                              <span>{tenant.verificationCode || "123456"}</span>
                              {copiedCodeId === tenant.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-amber-600" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 3. Domain & VPS */}
                      <td className="py-4 px-5">
                        {tenant.domain ? (
                          <div className="space-y-1">
                            <a
                              href={`https://${tenant.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                              dir="ltr"
                            >
                              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="truncate max-w-[140px]">{tenant.domain}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono" dir="ltr">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{HOSTINGER_VPS_CONFIG.ip}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-slate-300" />
                            <span>دومين مشترك / لم يعين</span>
                          </div>
                        )}
                      </td>

                      {/* 4. Plan & Due Date */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <span className="inline-block text-xs font-bold text-slate-800">
                            {tenant.planType || "الخطة الاحترافية"}
                          </span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <Clock className={`w-3.5 h-3.5 ${dueInfo.isUrgent ? "text-red-500" : "text-slate-400"}`} />
                            <span
                              className={`font-semibold ${
                                dueInfo.isExpired
                                  ? "text-red-600 font-bold"
                                  : dueInfo.isUrgent
                                  ? "text-amber-600 font-bold"
                                  : "text-slate-500"
                              }`}
                            >
                              {dueInfo.text}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Resource Limits & Quotas */}
                      <td className="py-4 px-5 min-w-[170px]">
                        <div className="space-y-2">
                          {/* Storage Bar */}
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold mb-1">
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3 text-slate-400" />
                                <span>التخزين:</span>
                              </span>
                              <span dir="ltr">
                                {formatBytes(usedBytesNum)} / {formatBytes(limitBytesNum)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  storagePercent > 90
                                    ? "bg-red-500"
                                    : storagePercent > 70
                                    ? "bg-amber-500"
                                    : "bg-blue-600"
                                }`}
                                style={{ width: `${storagePercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Exams and Files Count */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>{examsCount}/{examsLimit} اختبار</span>
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium">
                              <FolderUp className="w-3 h-3 text-slate-400" />
                              <span>{filesCount}/{filesLimit} ملف</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 6. Subscription Status */}
                      <td className="py-4 px-5 text-center">
                        {tenant.subscriptionStatus === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>نشط</span>
                          </span>
                        ) : tenant.subscriptionStatus === "STOPPED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>موقوف</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span>منتهي</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Automated VPS Action Buttons */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Pause / Resume button */}
                          <button
                            onClick={() => handleToggleStatus(tenant.id)}
                            disabled={isPending}
                            title={tenant.subscriptionStatus === "ACTIVE" ? "إيقاف مؤقت للاشتراك" : "تفعيل الاشتراك"}
                            className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <span>+30ي</span>
                          </button>

                          {/* VPS Setup Commands Copy */}
                          {tenant.domain && (
                            <button
                              onClick={() => handleCopyVpsNginx(tenant)}
                              title="نسخ كود إعداد Nginx على VPS Hostinger"
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              {copiedVpsId === tenant.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Terminal className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </button>
                          )}

                          {/* Edit Full Subscription Modal Trigger */}
                          <button
                            onClick={() => {
                              setEditingTenant(tenant);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
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
          tenant={editingTenant}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTenant(null);
          }}
          onUpdated={() => {
            setIsModalOpen(false);
            setEditingTenant(null);
          }}
        />
      )}
    </div>
  );
}
