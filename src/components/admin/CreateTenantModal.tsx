"use client";

import React, { useState, useTransition } from "react";
import { createTenantAction } from "@/app/actions/admin-tenants";
import { autoDeployTenantVpsAction } from "@/app/actions/vps-provisioning";
import {
  UserPlus,
  X,
  Loader2,
  Copy,
  Check,
  Globe,
  Phone,
  Lock,
  User,
  Calendar,
  HardDrive,
  FileText,
  Server,
  Sparkles,
  AlertTriangle,
  Building2,
  GraduationCap,
  Layers,
  CheckSquare,
  Square,
  Database,
} from "lucide-react";
import { HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import {
  APP_FEATURES_REGISTRY,
  SIDEBAR_SECTIONS_ORDER,
  ALL_FEATURE_IDS,
  SubscriptionCategory,
  getDefaultFeaturesForCategory,
} from "@/lib/app-features";

interface CreateTenantModalProps {
  onCreated?: () => void;
}

function toInputDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function CreateTenantModal({ onCreated }: CreateTenantModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 1. Client Identity & Credentials (No Verification Code)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("Tenant123456$");

  // 2. Domain & Server Auto-Setup
  const [domain, setDomain] = useState("");

  // 3. Subscription Start & End Dates (Calendar)
  const [startDateStr, setStartDateStr] = useState(() => toInputDateStr(new Date()));
  const [dueDateStr, setDueDateStr] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return toInputDateStr(d);
  });

  // 4. Subscription Type (معلم / سنتر)
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionCategory>("سنتر");

  // 5. Modular Sidebar Features Installer
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(() => [...ALL_FEATURE_IDS]);

  // Quotas
  const [storageLimitGb, setStorageLimitGb] = useState(2);
  const [examsLimit, setExamsLimit] = useState(300);
  const [filesLimit, setFilesLimit] = useState(300);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedVps, setCopiedVps] = useState(false);
  const [isDeployingVps, startDeployVps] = useTransition();
  const [deploySuccessMsg, setDeploySuccessMsg] = useState<string | null>(null);
  const [deployErrorMsg, setDeployErrorMsg] = useState<string | null>(null);

  const handleOpen = () => {
    setErrorMsg(null);
    setCreatedResult(null);
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setStartDateStr(toInputDateStr(today));
    setDueDateStr(toInputDateStr(nextYear));
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!isPending) {
      setIsOpen(false);
      setCreatedResult(null);
      setErrorMsg(null);
    }
  };

  const handleSelectSubscriptionType = (type: SubscriptionCategory) => {
    setSubscriptionType(type);
    setEnabledFeatures(getDefaultFeaturesForCategory(type));
  };

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

  const applyQuickDurationDays = (days: number) => {
    const base = startDateStr ? new Date(startDateStr) : new Date();
    const end = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    setDueDateStr(toInputDateStr(end));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (enabledFeatures.length === 0) {
      setErrorMsg("يرجى اختيار ميزة واحدة على الأقل لتسطيبها في التطبيق.");
      return;
    }

    startTransition(async () => {
      const res = await createTenantAction({
        name,
        phone,
        password,
        domain: domain || undefined,
        subscriptionType,
        subscriptionStartDate: startDateStr,
        subscriptionDueDate: dueDateStr,
        enabledFeatures,
        storageLimitGb,
        examsLimit,
        filesLimit,
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      setCreatedResult(res);
      if (onCreated) onCreated();
    });
  };

  const copyActivationCard = () => {
    if (!createdResult) return;
    const installedNames = APP_FEATURES_REGISTRY.filter((f) =>
      (createdResult.tenant.enabledFeatures || []).includes(f.id)
    )
      .map((f) => f.name)
      .join(" ، ");

    const cardText = `🎉 مرحباً بك في منصتك التعليمية الخاصة (${createdResult.tenant.name})!
تم تسطيب التطبيق وبناء قاعدة البيانات وتفعيل اشتراكك بنجاح.

👤 اسم العميل (الظاهر بالتطبيق): ${createdResult.tenant.name}
🏷️ نوع الاشتراك: ${createdResult.tenant.subscriptionType}
📱 رقم الهاتف (الدخول): ${createdResult.tenant.phone}
🔑 كلمة المرور: ${password}
🌐 رابط المنصة: ${
      createdResult.tenant.domain
        ? `https://${createdResult.tenant.domain}/login`
        : "رابط المنصة الرئيسي"
    }
📅 بداية الاشتراك: ${new Date(createdResult.tenant.startDate).toLocaleDateString("ar-EG")}
📅 نهاية الاشتراك: ${new Date(createdResult.tenant.dueDate).toLocaleDateString("ar-EG")}
🧩 المميزات المثبتة: ${installedNames}`;

    navigator.clipboard.writeText(cardText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const copyVpsConfig = () => {
    if (!createdResult?.vpsConfig) return;
    navigator.clipboard.writeText(createdResult.vpsConfig);
    setCopiedVps(true);
    setTimeout(() => setCopiedVps(false), 3000);
  };

  // Calculate total days between startDateStr and dueDateStr
  const totalDays = React.useMemo(() => {
    if (!startDateStr || !dueDateStr) return 0;
    const s = new Date(startDateStr).getTime();
    const e = new Date(dueDateStr).getTime();
    return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
  }, [startDateStr, dueDateStr]);

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        <span>إضافة وتسطيب تطبيق عميل جديد (App Installer)</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تسطيب تطبيق عميل جديد وبناء قاعدة البيانات على السيرفر
                  </h3>
                  <p className="text-xs text-slate-500">
                    تحديد اسم العميل، الدومين، فترة الاشتراك بالـ Calendar، نوع الاشتراك (معلم/سنتر)، وتسطيب مميزات الـ Sidebar
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* SUCCESS VIEW */}
              {createdResult ? (
                <div className="space-y-6 animate-in fade-in">
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                    <Check className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-bold text-emerald-900">
                        {createdResult.message}
                      </h4>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-1.5 text-emerald-700">
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            تم إنشاء حساب العميل ({createdResult.tenant.name}) وبناء قاعدة بياناته المعزولة تلقائياً
                          </span>
                        </li>
                        <li className="flex items-center gap-1.5 text-emerald-700">
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            تم تسطيب ({createdResult.tenant.enabledFeatures?.length || 0}) ميزة في الـ Sidebar حسب اختيارك
                          </span>
                        </li>
                        {createdResult.vpsSync && (
                          <li
                            className={`flex items-center gap-1.5 ${
                              createdResult.vpsSync.synced ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {createdResult.vpsSync.synced ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            <span>{createdResult.vpsSync.message}</span>
                          </li>
                        )}
                        {createdResult.domainSetup && (
                          <li
                            className={`flex items-center gap-1.5 ${
                              createdResult.domainSetup.synced ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {createdResult.domainSetup.synced ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            <span>{createdResult.domainSetup.message}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Credentials Card (Without Verification Code) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-blue-600" />
                        <span>بطاقة بيانات تطبيق العميل</span>
                      </span>
                      <button
                        onClick={copyActivationCard}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? "تم النسخ بنجاح!" : "نسخ بيانات الدخول"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">اسم العميل بالتطبيق:</span>
                        <span className="font-extrabold text-slate-900">
                          {createdResult.tenant.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">نوع الاشتراك:</span>
                        <span className="font-extrabold text-blue-600">
                          {createdResult.tenant.subscriptionType}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">رقم الهاتف (الدخول):</span>
                        <span className="font-bold text-slate-800 font-mono" dir="ltr">
                          {createdResult.tenant.phone}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">كلمة المرور:</span>
                        <span className="font-bold text-slate-800 font-mono" dir="ltr">
                          {password}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">بداية الاشتراك:</span>
                        <span className="font-bold text-slate-800">
                          {new Date(createdResult.tenant.startDate).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">نهاية الاشتراك:</span>
                        <span className="font-bold text-emerald-700">
                          {new Date(createdResult.tenant.dueDate).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Automated VPS Deployment Section */}
                  {createdResult.tenant.domain && (
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 space-y-4 border border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              تفعيل الدومين على خادم Hostinger VPS ({HOSTINGER_VPS_CONFIG.ip})
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                              {createdResult.tenant.domain}
                            </span>
                          </div>
                        </div>

                        <a
                          href={`https://${createdResult.tenant.domain}/login`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>فتح تطبيق العميل</span>
                        </a>
                      </div>

                      {deploySuccessMsg && (
                        <div className="p-3 bg-emerald-950/70 border border-emerald-600/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{deploySuccessMsg}</span>
                        </div>
                      )}

                      {deployErrorMsg && (
                        <div className="p-3 bg-red-950/70 border border-red-600/40 text-red-300 rounded-xl text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{deployErrorMsg}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <button
                          type="button"
                          disabled={isDeployingVps}
                          onClick={() => {
                            setDeploySuccessMsg(null);
                            setDeployErrorMsg(null);
                            startDeployVps(async () => {
                              const res = await autoDeployTenantVpsAction(
                                createdResult.tenant.id,
                                createdResult.tenant.domain
                              );
                              if (res.success) {
                                setDeploySuccessMsg(res.message);
                              } else {
                                setDeployErrorMsg(res.error || res.message);
                              }
                            });
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                        >
                          {isDeployingVps ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>جاري إطلاق وإعداد Nginx على VPS...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>إعادة التفعيل والفحص على VPS</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={copyVpsConfig}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedVps ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedVps ? "تم نسخ الأمر" : "نسخ أمر Nginx اليدوي"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleClose}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      إتمام وإغلاق
                    </button>
                  </div>
                </div>
              ) : (
                /* FORM VIEW */
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Step 1: Client Identity & Credentials */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
                        1
                      </span>
                      <span>بيانات العميل وبيانات الدخول (بدون كود تحقق)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* Client Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          اسم المستخدم (العميل - يظهر في التطبيق) *
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="مثال: سنتر الأوائل / أ. بلال مرسي"
                            className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          رقم تليفون العميل (للدخول) *
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                            className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:bg-white focus:border-blue-600 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          كلمة المرور *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                          <input
                            type="text"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            dir="ltr"
                            className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:bg-white focus:border-blue-600 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Domain & Auto Server + DB Provisioning */}
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-black text-blue-950 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
                          2
                        </span>
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span>الدومين وتسطيب التطبيق وقاعدة البيانات أوتوماتيكياً على السيرفر</span>
                      </label>
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                        <Database className="w-3 h-3" />
                        <span>بناء تلقائي لقاعدة البيانات + Nginx</span>
                      </span>
                    </div>

                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="مثال: teacher1.alasima-erp.com أو center.domain.com"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:border-blue-600 outline-none transition-all"
                    />
                    <p className="text-[11px] text-blue-700">
                      بمجرد الحفظ يتم تسطيب نسخة العميل، تهيئة قاعدة بياناته المعزولة على السيرفر، وربط الدومين تلقائياً.
                    </p>
                  </div>

                  {/* Step 3: Calendar Subscription Start & End Dates */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
                          3
                        </span>
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span>تحديد مدة الاشتراك (تاريخ البداية والنهاية بالـ Calendar)</span>
                      </h4>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => applyQuickDurationDays(30)}
                          className="text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          شهر (30 يوم)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyQuickDurationDays(90)}
                          className="text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          3 شهور
                        </button>
                        <button
                          type="button"
                          onClick={() => applyQuickDurationDays(180)}
                          className="text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          ترم (6 شهور)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyQuickDurationDays(365)}
                          className="text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          سنة كاملة
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          تاريخ بداية الاشتراك (Start Date) *
                        </label>
                        <input
                          type="date"
                          required
                          value={startDateStr}
                          onChange={(e) => setStartDateStr(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-600 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          تاريخ نهاية الاشتراك (End Date) *
                        </label>
                        <input
                          type="date"
                          required
                          value={dueDateStr}
                          min={startDateStr}
                          onChange={(e) => setDueDateStr(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-600 outline-none"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-blue-700 flex items-center justify-between pt-1">
                      <span>إجمالي مدة الصلاحية المحددة: {totalDays} يوم</span>
                      <span>يتوقف التطبيق تلقائياً عند انتهاء التاريخ المحدد</span>
                    </div>
                  </div>

                  {/* Step 4: Subscription Type (معلم / سنتر) */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
                        4
                      </span>
                      <span>نوع الاشتراك (معلم / سنتر)</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => handleSelectSubscriptionType("سنتر")}
                        className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                          subscriptionType === "سنتر"
                            ? "bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            subscriptionType === "سنتر"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900">اشتراك سنتر تعليمي</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            إدارة السنتر والمجموعات والطلاب والاختبارات
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSubscriptionType("معلم")}
                        className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                          subscriptionType === "معلم"
                            ? "bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            subscriptionType === "معلم"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900">اشتراك معلم</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            مخصص للمعلم الفردي وإنشاء الاختبارات والطلاب
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Step 5: Modular App Features Installer (Referenced from Sidebar) */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
                            5
                          </span>
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span>تسطيب خواص ومميزات التطبيق (مرجعية الـ Sidebar)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          اختر المميزات التي تريد تسطيبها لهذا العميل فقط (المميزات غير المحددة لن تظهر في الـ Sidebar ولن تُفتح في التطبيق)
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setEnabledFeatures([...ALL_FEATURE_IDS])}
                          className="text-[10px] font-extrabold bg-blue-600 text-white px-2.5 py-1 rounded-lg cursor-pointer hover:bg-blue-700"
                        >
                          تحديد الكل ({ALL_FEATURE_IDS.length})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEnabledFeatures([
                              "exam-builder",
                              "created-exams",
                              "uploaded-files",
                              "images-to-pdf",
                              "my-subscription",
                            ])
                          }
                          className="text-[10px] font-bold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-slate-100"
                        >
                          قسم الاختبارات فقط
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {SIDEBAR_SECTIONS_ORDER.map((sectionTitle) => {
                        const sectionFeatures = APP_FEATURES_REGISTRY.filter(
                          (f) => f.section === sectionTitle
                        );
                        const selectedInSection = sectionFeatures.filter((f) =>
                          enabledFeatures.includes(f.id)
                        ).length;
                        const allInSectionSelected =
                          selectedInSection === sectionFeatures.length;

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
                                  {selectedInSection} / {sectionFeatures.length} مثبت
                                </span>
                              </span>

                              <button
                                type="button"
                                onClick={() => toggleSectionFeatures(sectionTitle)}
                                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                              >
                                {allInSectionSelected ? "إلغاء تحديد القسم" : "تسطيب القسم بالكامل"}
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
                                        : "bg-slate-50/60 border-slate-200/80 text-slate-400 hover:bg-slate-100/70"
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
                                        <span className="text-[9px] font-mono opacity-60" dir="ltr">
                                          {feat.href}
                                        </span>
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

                  {/* Storage & Exams Quotas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                        <span>حد مساحة التخزين السحابية (GB)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={storageLimitGb}
                        onChange={(e) => setStorageLimitGb(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>حد إنشاء الاختبارات</span>
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="5000"
                        value={examsLimit}
                        onChange={(e) => setExamsLimit(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500">
                      سيتم تسطيب ({enabledFeatures.length} من {ALL_FEATURE_IDS.length}) خاصية في تطبيق العميل
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
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
                            <span>جاري تسطيب التطبيق وبناء قاعدة البيانات...</span>
                          </>
                        ) : (
                          <span>تسطيب التطبيق وتفعيله على السيرفر</span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
