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
  Key,
  Phone,
  Lock,
  User,
  Calendar,
  HardDrive,
  FileText,
  FolderUp,
  Server,
  Sparkles,
  ShieldCheck,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import { HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";

interface CreateTenantModalProps {
  onCreated?: () => void;
}

export default function CreateTenantModal({ onCreated }: CreateTenantModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("Tenant123456$");
  const [domain, setDomain] = useState("");
  const [verificationCode, setVerificationCode] = useState(
    () => Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [planType, setPlanType] = useState("الخطة الاحترافية للمعلمين (Teacher Pro)");
  const [durationMonths, setDurationMonths] = useState(12);
  const [storageLimitGb, setStorageLimitGb] = useState(1);
  const [examsLimit, setExamsLimit] = useState(150);
  const [filesLimit, setFilesLimit] = useState(200);
  const [notes, setNotes] = useState("");

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
    setVerificationCode(Math.floor(100000 + Math.random() * 900000).toString());
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!isPending) {
      setIsOpen(false);
      setCreatedResult(null);
      setErrorMsg(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await createTenantAction({
        name,
        phone,
        password,
        domain: domain || undefined,
        verificationCode,
        planType,
        durationMonths,
        storageLimitGb,
        examsLimit,
        filesLimit,
        notes,
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
    const cardText = `🎉 مرحباً بك في منصة بنك الاختبارات والتدريس التفاعلي!
تم إنشاء حسابك وتفعيل اشتراكك بنجاح.

👤 الاسم: ${createdResult.tenant.name}
📱 رقم الهاتف: ${createdResult.tenant.phone}
🔑 كلمة المرور: ${password}
🔢 كود التحقق / التفعيل: ${createdResult.tenant.verificationCode}
🌐 الرابط: ${createdResult.tenant.domain ? `https://${createdResult.tenant.domain}` : "رابط المنصة الرئيسي"}
📅 تاريخ التجديد: ${new Date(createdResult.tenant.dueDate).toLocaleDateString("ar-EG")}

نتمنى لك تجربة ممتعة ومثمرة!`;

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

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        <span>إضافة مستأجر جديد ونشر بيئة العمل</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    إضافة مستأجر جديد وتجهيز السيرفر
                  </h3>
                  <p className="text-xs text-slate-500">
                    إنشاء حساب المعلم، تخصيص النطاق، وتعيين حدود الاشتراك
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
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* SUCCESS VIEW: Show Activation Card & VPS Config */}
              {createdResult ? (
                <div className="space-y-6 animate-in fade-in">
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                    <Check className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">
                        {createdResult.message}
                      </h4>
                      <p className="text-xs text-emerald-700 mt-1">
                        تم تسجيل المعلم بنجاح. يمكنك الآن نسخ بيانات التفعيل وإرسالها إليه مباشرة.
                      </p>
                    </div>
                  </div>

                  {/* Credentials Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-blue-600" />
                        <span>بيانات الدخول والتفعيل للمعلم</span>
                      </span>
                      <button
                        onClick={copyActivationCard}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? "تم النسخ بنجاح!" : "نسخ البيانات"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">اسم المعلم:</span>
                        <span className="font-bold text-slate-800">{createdResult.tenant.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">رقم الهاتف:</span>
                        <span className="font-bold text-slate-800 font-mono" dir="ltr">{createdResult.tenant.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">كلمة المرور:</span>
                        <span className="font-bold text-slate-800 font-mono" dir="ltr">{password}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">كود التحقق والتفعيل:</span>
                        <span className="font-black text-blue-600 font-mono text-sm">{createdResult.tenant.verificationCode}</span>
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

                        {/* Direct Visit Button */}
                        <a
                          href={`http://${createdResult.tenant.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>فتح الدومين الآن</span>
                        </a>
                      </div>

                      {/* Deploy Success/Error messages */}
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

                      {/* 1-Click Auto Deploy Button */}
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
                              <span>تفعيل النطاق وإطلاق المنصة على VPS تلقائياً</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={copyVpsConfig}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedVps ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        اسم المعلم / المؤسسة *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="مثال: أ. بلال مرسي"
                          className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        رقم الهاتف (اسم المستخدم) *
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
                          className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        كلمة المرور الأولية *
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

                    {/* Verification Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        كود التحقق / كود التفعيل
                      </label>
                      <div className="relative flex items-center gap-2">
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          dir="ltr"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-blue-600 focus:bg-white focus:border-blue-600 outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setVerificationCode(Math.floor(100000 + Math.random() * 900000).toString())}
                          className="shrink-0 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-2.5 rounded-xl transition-colors cursor-pointer"
                        >
                          توليد جديد
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Domain on VPS Hostinger */}
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>النطاق المخصص / الدومين على VPS (اختياري)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="مثال: teacher1.alasima-erp.com أو exam.domain.com"
                        dir="ltr"
                        className="w-full px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:border-blue-600 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-blue-700">
                      سيتم تجهيز إعدادات Nginx وربط الـ DNS تلقائياً مع خادم Hostinger VPS (72.60.44.106).
                    </p>
                  </div>

                  {/* Subscription Settings & Limits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Plan Type */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        نوع الخطة
                      </label>
                      <select
                        value={planType}
                        onChange={(e) => setPlanType(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                      >
                        <option value="الخطة الاحترافية للمعلمين (Teacher Pro)">
                          الخطة الاحترافية للمعلمين (Teacher Pro)
                        </option>
                        <option value="خطة المدارس والمراكز التعليمية (Enterprise)">
                          خطة المدارس والمراكز التعليمية (Enterprise)
                        </option>
                        <option value="الخطة الأساسية (Starter)">
                          الخطة الأساسية (Starter)
                        </option>
                      </select>
                    </div>

                    {/* Duration in Months */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        مدة الاشتراك (Duration)
                      </label>
                      <select
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                      >
                        <option value={1}>شهر واحد (1 Month)</option>
                        <option value={3}>3 أشهر (Quarterly)</option>
                        <option value={6}>6 أشهر (Half Year)</option>
                        <option value={12}>سنة كاملة (1 Year - سنوي)</option>
                        <option value={24}>سنتان (2 Years)</option>
                      </select>
                    </div>

                    {/* Storage Limit */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                        <span>حد مساحة التخزين (GB)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={storageLimitGb}
                        onChange={(e) => setStorageLimitGb(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>

                    {/* Exams Limit */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>حد إنشاء الاختبارات</span>
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        value={examsLimit}
                        onChange={(e) => setExamsLimit(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
                          <span>جاري الإنشاء والربط بالسيرفر...</span>
                        </>
                      ) : (
                        <span>إنشاء وتفعيل على السيرفر</span>
                      )}
                    </button>
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
