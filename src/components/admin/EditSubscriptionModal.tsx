"use client";

import React, { useState, useTransition } from "react";
import {
  updateTenantSubscriptionAction,
  extendSubscriptionAction,
  toggleTenantStatusAction,
  deleteTenantAction,
} from "@/app/actions/admin-tenants";
import { generateNginxConfig, HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import {
  Edit3,
  X,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FileText,
  Globe,
  Lock,
  Pause,
  Play,
  Trash2,
  PlusCircle,
  Server,
  Copy,
  Check,
  Building2,
  GraduationCap,
  Layers,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import {
  APP_FEATURES_REGISTRY,
  SIDEBAR_SECTIONS_ORDER,
  ALL_FEATURE_IDS,
  SubscriptionCategory,
  normalizeEnabledFeatures,
  getDefaultFeaturesForCategory,
} from "@/lib/app-features";

export interface TenantData {
  id: string;
  name: string | null;
  phone: string;
  domain?: string | null;
  planType: string;
  subscriptionType?: SubscriptionCategory;
  subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
  subscriptionStartDate?: Date | string | null;
  subscriptionDueDate?: Date | string | null;
  enabledFeatures?: string[];
  storageLimitBytes: bigint | number;
  usedStorageBytes: bigint | number;
  examsLimit?: number;
  filesLimit?: number;
  verificationCode?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  _count?: {
    exams: number;
    uploadedFiles: number;
  };
}

interface EditSubscriptionModalProps {
  tenant: TenantData;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updatedTenant?: any) => void;
  onTenantPatched?: (updatedTenant?: any) => void;
  onDeleted?: (tenantId: string) => void;
}

export default function EditSubscriptionModal({
  tenant,
  isOpen,
  onClose,
  onUpdated,
  onTenantPatched,
  onDeleted,
}: EditSubscriptionModalProps) {
  const [isPending, startTransition] = useTransition();

  // Form Fields
  const [name, setName] = useState(tenant.name || "");
  const [phone, setPhone] = useState(tenant.phone);
  const [domain, setDomain] = useState(tenant.domain || "");
  const [status, setStatus] = useState<"ACTIVE" | "STOPPED" | "EXPIRED">(tenant.subscriptionStatus);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionCategory>(
    tenant.subscriptionType === "معلم" ? "معلم" : "سنتر"
  );
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(() =>
    normalizeEnabledFeatures(tenant.enabledFeatures)
  );
  const [newPassword, setNewPassword] = useState("");

  const currentStorageGb = Math.round(Number(tenant.storageLimitBytes) / 1073741824) || 1;
  const [storageLimitGb, setStorageLimitGb] = useState(currentStorageGb);
  const [examsLimit, setExamsLimit] = useState(tenant.examsLimit || 150);
  const [filesLimit, setFilesLimit] = useState(tenant.filesLimit || 200);

  // Calendar Start & Due Dates
  const initialStartDate = tenant.subscriptionStartDate
    ? new Date(tenant.subscriptionStartDate).toISOString().split("T")[0]
    : tenant.createdAt
    ? new Date(tenant.createdAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const initialDueDate = tenant.subscriptionDueDate
    ? new Date(tenant.subscriptionDueDate).toISOString().split("T")[0]
    : "";

  const [startDateStr, setStartDateStr] = useState(initialStartDate);
  const [dueDateStr, setDueDateStr] = useState(initialDueDate);

  const [notes, setNotes] = useState(tenant.notes || "");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // VPS automated command view
  const [showVpsCommands, setShowVpsCommands] = useState(false);
  const [copiedVps, setCopiedVps] = useState(false);

  const isActive = status === "ACTIVE";

  const toggleFeature = (featureId: string) => {
    setEnabledFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId]
    );
  };

  const toggleSectionFeatures = (sectionTitle: string) => {
    const sectionIds = APP_FEATURES_REGISTRY.filter((f) => f.section === sectionTitle).map(
      (f) => f.id
    );
    const allSelected = sectionIds.every((id) => enabledFeatures.includes(id));
    if (allSelected) {
      setEnabledFeatures((prev) => prev.filter((id) => !sectionIds.includes(id)));
    } else {
      setEnabledFeatures((prev) => Array.from(new Set([...prev, ...sectionIds])));
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (enabledFeatures.length === 0) {
      setMsg({ text: "يرجى اختيار ميزة واحدة على الأقل لتشغيل التطبيق.", isError: true });
      return;
    }

    startTransition(async () => {
      const res = await updateTenantSubscriptionAction({
        tenantId: tenant.id,
        name,
        phone,
        domain,
        subscriptionType,
        subscriptionStatus: status,
        subscriptionStartDate: startDateStr || undefined,
        subscriptionDueDate: dueDateStr || undefined,
        enabledFeatures,
        storageLimitGb,
        examsLimit,
        filesLimit,
        newPassword: newPassword || undefined,
        notes,
      });

      if (res.error) {
        setMsg({ text: res.error, isError: true });
        return;
      }

      setMsg({
        text: res.message || "تم حفظ التعديلات ومزامنتها فورياً مع تطبيق العميل ✓",
        isError: false,
      });
      if (onTenantPatched && res.tenant) onTenantPatched(res.tenant);
      if (onUpdated) onUpdated(res.tenant);
    });
  };

  const handleExtend = (days: number) => {
    setMsg(null);
    startTransition(async () => {
      const res: any = await extendSubscriptionAction(tenant.id, days);
      if (res.error) {
        setMsg({ text: res.error, isError: true });
      } else {
        setStatus("ACTIVE");
        setMsg({
          text: res.message || `تم تمديد الاشتراك ${days} يوم بنجاح`,
          isError: false,
        });
        if (res.newDueDate) {
          setDueDateStr(new Date(res.newDueDate).toISOString().split("T")[0]);
        }
        if (onTenantPatched && res.tenant) onTenantPatched(res.tenant);
      }
    });
  };

  const handleToggleStatus = () => {
    setMsg(null);
    startTransition(async () => {
      const res: any = await toggleTenantStatusAction(tenant.id);
      if (res.error) {
        setMsg({ text: res.error, isError: true });
      } else {
        if (res.newStatus) setStatus(res.newStatus);
        const syncFailed = res.vpsSync && res.vpsSync.synced === false;
        setMsg({
          text:
            (res.newStatus === "ACTIVE"
              ? "تم استئناف وتنشيط اشتراك العميل بنجاح"
              : "تم إيقاف اشتراك العميل مؤقتاً") +
            (syncFailed
              ? " (تحذير: فشلت المزامنة مع VPS — أعد المحاولة)"
              : " وتمت المزامنة الفورية مع تطبيق العميل ✓"),
          isError: !!syncFailed,
        });
        if (onTenantPatched && res.tenant) onTenantPatched(res.tenant);
      }
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        `هل أنت متأكد تماماً من حذف حساب العميل (${tenant.name || tenant.phone}) وكافة بياناته واختباراته؟`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteTenantAction(tenant.id);
      if (res.error) {
        setMsg({ text: res.error, isError: true });
      } else {
        if (onDeleted) onDeleted(tenant.id);
        onClose();
      }
    });
  };

  const copyNginxConfig = () => {
    const d = domain || `${tenant.phone}.alasima-erp.com`;
    const cfg = generateNginxConfig(d);
    navigator.clipboard.writeText(cfg);
    setCopiedVps(true);
    setTimeout(() => setCopiedVps(false), 3000);
  };

  const unInstalledCount = ALL_FEATURE_IDS.length - enabledFeatures.length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900">
                  تعديل اشتراك ومميزات تطبيق: {tenant.name || tenant.phone}
                </h3>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {isActive ? "نشط ومتزامن" : "متوقف مؤقتاً"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                تعديل المواعيد بالـ Calendar، نوع الاشتراك (معلم/سنتر)، وإضافة أو إزالة خواص الـ Sidebar بمزامنة لحظية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {msg && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                msg.isError
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}
            >
              {msg.isError ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Quick Automated Control Bar (Pause, Resume & Extensions) */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <span className="text-xs font-bold text-slate-700 block">
              التحكم السريع في توقف وتشغيل الاشتراك وتمديد الصلاحية:
            </span>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Toggle Status Button */}
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isPending}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-xs"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                }`}
              >
                {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>
                  {isActive ? "إيقاف الاشتراك مؤقتاً" : "تشغيل واستئناف الاشتراك الآن"}
                </span>
              </button>

              <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

              {/* Quick Extend Buttons */}
              <button
                type="button"
                onClick={() => handleExtend(30)}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>+ شهر (30 يوم)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExtend(90)}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>+ 3 أشهر</span>
              </button>

              <button
                type="button"
                onClick={() => handleExtend(365)}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>+ سنة كاملة</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdate} className="space-y-5">
            {/* Client Identity, Domain & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم العميل (الظاهر في التطبيق)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف (رقم الدخول)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* Domain */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>الدومين / النطاق على السيرفر</span>
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="teacher.example.com"
                  dir="ltr"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>تغيير كلمة المرور (اختياري)</span>
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="اتركه فارغاً لعدم التغيير"
                  dir="ltr"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>
            </div>

            {/* Subscription Start & End Dates (Calendar) */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
              <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>مواعيد الاشتراك (بداية ونهاية بالـ Calendar)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    تاريخ بداية الاشتراك (Start Date)
                  </label>
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-blue-600 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    تاريخ نهاية الاشتراك (End Date)
                  </label>
                  <input
                    type="date"
                    value={dueDateStr}
                    min={startDateStr}
                    onChange={(e) => setDueDateStr(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-blue-600 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Subscription Type Selector (معلم / سنتر) */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-800 block">
                نوع الاشتراك (معلم / سنتر)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubscriptionType("سنتر")}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                    subscriptionType === "سنتر"
                      ? "bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      subscriptionType === "سنتر"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">سنتر تعليمي</div>
                    <div className="text-[10px] text-slate-500">باقة إدارة السنتر والاختبارات</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubscriptionType("معلم")}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                    subscriptionType === "معلم"
                      ? "bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      subscriptionType === "معلم"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">معلم</div>
                    <div className="text-[10px] text-slate-500">باقة المعلم والاختبارات</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Modular Sidebar Features Manager (Synced with Sidebar Registry) */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>إدارة وتحديث خواص التطبيق (مرجعية أقسام الـ Sidebar الثلاثة)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    يمكنك إضافة أي ميزة جديدة أو تعطيل ميزة حالية لهذا العميل وسيتم تحديث تطبيقه فوراً
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {unInstalledCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setEnabledFeatures([...ALL_FEATURE_IDS])}
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>تفعيل كل المميزات المتاحة (+{unInstalledCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setEnabledFeatures(getDefaultFeaturesForCategory(subscriptionType))
                    }
                    className="text-[10px] font-bold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-slate-100"
                  >
                    الافتراضي لـ ({subscriptionType})
                  </button>
                </div>
              </div>

              <div className="space-y-3.5">
                {SIDEBAR_SECTIONS_ORDER.map((sectionTitle) => {
                  const sectionFeatures = APP_FEATURES_REGISTRY.filter(
                    (f) => f.section === sectionTitle
                  );
                  const selectedInSection = sectionFeatures.filter((f) =>
                    enabledFeatures.includes(f.id)
                  ).length;
                  const allInSectionSelected = selectedInSection === sectionFeatures.length;

                  return (
                    <div
                      key={sectionTitle}
                      className="bg-white border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          <span>قسم {sectionTitle}</span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {selectedInSection} / {sectionFeatures.length} مفعل
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleSectionFeatures(sectionTitle)}
                          className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          {allInSectionSelected ? "إلغاء تحديد القسم" : "إضافة القسم بالكامل"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sectionFeatures.map((feat) => {
                          const isChecked = enabledFeatures.includes(feat.id);
                          return (
                            <button
                              key={feat.id}
                              type="button"
                              onClick={() => toggleFeature(feat.id)}
                              className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                                isChecked
                                  ? "bg-blue-50/70 border-blue-600 text-slate-900"
                                  : "bg-slate-50/60 border-dashed border-slate-300 text-slate-500 hover:bg-emerald-50/40 hover:border-emerald-400"
                              }`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-extrabold leading-tight flex items-center justify-between gap-1">
                                  <span className="truncate">{feat.name}</span>
                                  {isChecked ? (
                                    <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md">
                                      مثبت
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                      غير مثبت (+ إضافة)
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] opacity-80 mt-0.5 line-clamp-1">
                                  {feat.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quotas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                  <span>حد التخزين (GB)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={storageLimitGb}
                  onChange={(e) => setStorageLimitGb(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>حد إنشاء الاختبارات</span>
                </label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={examsLimit}
                  onChange={(e) => setExamsLimit(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>
            </div>

            {/* VPS Automation Accordion Button */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowVpsCommands(!showVpsCommands)}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100/70 text-right flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>إجراءات وإعدادات السيرفر Hostinger VPS ({HOSTINGER_VPS_CONFIG.ip})</span>
                </span>
                <span className="text-[11px] text-blue-600">
                  {showVpsCommands ? "إخفاء" : "عرض الأوامر"}
                </span>
              </button>

              {showVpsCommands && (
                <div className="p-4 bg-slate-900 text-slate-200 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      إعدادات النطاق {domain || "العميل"} في Nginx:
                    </span>
                    <button
                      type="button"
                      onClick={copyNginxConfig}
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 px-2 py-1 rounded-md cursor-pointer"
                    >
                      {copiedVps ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedVps ? "تم النسخ" : "نسخ التكوين"}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-300 max-h-36 overflow-x-auto bg-slate-950 p-2.5 rounded-lg">
                    {generateNginxConfig(domain || `${tenant.phone}.alasima-erp.com`)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف العميل</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-70"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ والمزامنة...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات ومزامنة التطبيق</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
