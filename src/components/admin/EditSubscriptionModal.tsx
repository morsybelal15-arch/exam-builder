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
  FolderUp,
  Globe,
  Key,
  Lock,
  Pause,
  Play,
  Trash2,
  PlusCircle,
  Server,
  Terminal,
  Copy,
  Check,
} from "lucide-react";

export interface TenantData {
  id: string;
  name: string | null;
  phone: string;
  domain?: string | null;
  planType: string;
  subscriptionStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
  subscriptionDueDate?: Date | string | null;
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
  onUpdated?: () => void;
}

export default function EditSubscriptionModal({
  tenant,
  isOpen,
  onClose,
  onUpdated,
}: EditSubscriptionModalProps) {
  const [isPending, startTransition] = useTransition();

  // Form Fields
  const [name, setName] = useState(tenant.name || "");
  const [phone, setPhone] = useState(tenant.phone);
  const [domain, setDomain] = useState(tenant.domain || "");
  const [planType, setPlanType] = useState(tenant.planType || "الخطة الاحترافية للمعلمين");
  const [verificationCode, setVerificationCode] = useState(tenant.verificationCode || "");
  const [newPassword, setNewPassword] = useState("");

  const currentStorageGb = Math.round(Number(tenant.storageLimitBytes) / 1073741824) || 1;
  const [storageLimitGb, setStorageLimitGb] = useState(currentStorageGb);
  const [examsLimit, setExamsLimit] = useState(tenant.examsLimit || 150);
  const [filesLimit, setFilesLimit] = useState(tenant.filesLimit || 200);

  // Due Date
  const initialDueDate = tenant.subscriptionDueDate
    ? new Date(tenant.subscriptionDueDate).toISOString().split("T")[0]
    : "";
  const [dueDateStr, setDueDateStr] = useState(initialDueDate);

  const [notes, setNotes] = useState(tenant.notes || "");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // VPS automated command view
  const [showVpsCommands, setShowVpsCommands] = useState(false);
  const [copiedVps, setCopiedVps] = useState(false);

  const isActive = tenant.subscriptionStatus === "ACTIVE";

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    startTransition(async () => {
      const res = await updateTenantSubscriptionAction({
        tenantId: tenant.id,
        name,
        phone,
        domain,
        planType,
        subscriptionDueDate: dueDateStr ? new Date(dueDateStr).toISOString() : undefined,
        storageLimitGb,
        examsLimit,
        filesLimit,
        verificationCode,
        newPassword: newPassword || undefined,
        notes,
      });

      if (res.error) {
        setMsg({ text: res.error, isError: true });
        return;
      }

      setMsg({ text: res.message || "تم حفظ التعديلات بنجاح", isError: false });
      if (onUpdated) onUpdated();
    });
  };

  const handleExtend = (days: number) => {
    setMsg(null);
    startTransition(async () => {
      const res = await extendSubscriptionAction(tenant.id, days);
      if (res.error) {
        setMsg({ text: res.error, isError: true });
      } else {
        setMsg({ text: res.message || `تم تمديد الاشتراك ${days} يوم بنجاح`, isError: false });
        if (res.newDueDate) {
          setDueDateStr(new Date(res.newDueDate).toISOString().split("T")[0]);
        }
        if (onUpdated) onUpdated();
      }
    });
  };

  const handleToggleStatus = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await toggleTenantStatusAction(tenant.id);
      if (res.error) {
        setMsg({ text: res.error, isError: true });
      } else {
        setMsg({
          text: res.newStatus === "ACTIVE" ? "تم تفعيل الحساب بنجاح" : "تم إيقاف الحساب مؤقتاً",
          isError: false,
        });
        if (onUpdated) onUpdated();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`هل أنت متأكد تماماً من حذف حساب المعلم (${tenant.name || tenant.phone}) وكافة اختباراته وملفاته؟`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteTenantAction(tenant.id);
      if (res.error) {
        setMsg({ text: res.error, isError: true });
      } else {
        alert("تم حذف المستأجر بنجاح");
        onClose();
        if (onUpdated) onUpdated();
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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  إدارة وتعديل اشتراك: {tenant.name || tenant.phone}
                </h3>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {isActive ? "نشط" : "متوقف مؤقتاً"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                التحكم في مدة الاشتراك، سعة التخزين، النطاق المخصص، وإجراءات السيرفر
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
              {msg.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Quick Automated Control Bar (Pause & Extensions) */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <span className="text-xs font-bold text-slate-700 block">
              التحكم السريع في حالة ومدة الاشتراك:
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
                <span>{isActive ? "إيقاف الاشتراك مؤقتاً" : "استئناف وتنشيط الحساب"}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعلم / المؤسسة</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (رقم الدخول)</label>
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

              {/* Due Date Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>تاريخ انتهاء / تجديد الاشتراك</span>
                </label>
                <input
                  type="date"
                  value={dueDateStr}
                  onChange={(e) => setDueDateStr(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* Storage Limit (GB) */}
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

              {/* Exams Limit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>حد إنشاء الاختبارات</span>
                </label>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  value={examsLimit}
                  onChange={(e) => setExamsLimit(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* Verification Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  <span>كود التحقق / رمز التفعيل</span>
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-blue-600 focus:bg-white focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>إعادة تعيين كلمة المرور (اختياري)</span>
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
                <span className="text-[11px] text-blue-600">{showVpsCommands ? "إخفاء" : "عرض الأوامر"}</span>
              </button>

              {showVpsCommands && (
                <div className="p-4 bg-slate-900 text-slate-200 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">إعدادات النطاق {domain || "المستأجر"} في Nginx:</span>
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
                <span>حذف المستأجر</span>
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
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
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
