"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAllLocalPcFiles } from "@/lib/local-pc-files";
import {
  formatUsedStorageArabic,
  formatStorageLimitMbArabic,
  computeStoragePercent,
} from "@/lib/storage-format";
import {
  HardDrive,
  Zap,
  RotateCcw,
  AlertTriangle,
  MessageCircle,
  Megaphone,
  CheckCircle2,
  Loader2,
  X,
  PhoneCall,
  Sparkles,
} from "lucide-react";

interface MySubscriptionClientProps {
  clientName: string;
  initialUsedStorageBytes: number;
  initialStorageLimitBytes: number;
  initialPinnedNotice: string | null;
}

export default function MySubscriptionClient({
  clientName,
  initialUsedStorageBytes,
  initialStorageLimitBytes,
  initialPinnedNotice,
}: MySubscriptionClientProps) {
  const router = useRouter();
  const [usedBytes, setUsedBytes] = useState<number>(initialUsedStorageBytes);
  const [limitBytes, setLimitBytes] = useState<number>(initialStorageLimitBytes);
  const [pinnedNotice, setPinnedNotice] = useState<string | null>(initialPinnedNotice);

  // Factory Reset Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setUsedBytes(initialUsedStorageBytes);
  }, [initialUsedStorageBytes]);

  useEffect(() => {
    setLimitBytes(initialStorageLimitBytes);
  }, [initialStorageLimitBytes]);

  useEffect(() => {
    setPinnedNotice(initialPinnedNotice);
  }, [initialPinnedNotice]);

  // Listen to live session sync from SubscriptionGuard so storage, limits, and pinned admin messages update in real time
  useEffect(() => {
    const onSync = (e: Event) => {
      const custom = e as CustomEvent;
      const data = custom.detail;
      if (!data || !data.authenticated) return;
      if (data.storageLimitBytes !== undefined) {
        setLimitBytes(Number(data.storageLimitBytes) || initialStorageLimitBytes);
      }
      if (data.usage && data.usage.filesBytes !== undefined) {
        setUsedBytes(Number(data.usage.filesBytes) || 0);
      }
      if (data.notes !== undefined) {
        setPinnedNotice(data.notes || null);
      }
    };
    window.addEventListener("tenant-session-sync", onSync);
    return () => window.removeEventListener("tenant-session-sync", onSync);
  }, [initialStorageLimitBytes]);

  const { barWidthPercent, displayPercent } = computeStoragePercent(usedBytes, limitBytes);
  const remainingBytes = Math.max(0, limitBytes - usedBytes);

  const whatsappUrl = `https://wa.me/201091713815?text=${encodeURIComponent(
    `مرحباً الدعم الفني، أحتاج مساعدة بخصوص اشتراك المنصة (${clientName})`
  )}`;

  const handleConfirmFactoryReset = async () => {
    setIsResetting(true);
    setResetFeedback(null);
    try {
      const res = await fetch("/api/tenant/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل تنفيذ إعادة ضبط المصنع");
      }

      // Clear local IndexedDB PC files & browser viewer caches
      try {
        await clearAllLocalPcFiles();
      } catch {
        // ignore
      }
      try {
        sessionStorage.removeItem("eb_exam_builder_viewer_freeze_v1");
        localStorage.removeItem("exam_builder_draft");
      } catch {
        // ignore
      }

      setUsedBytes(0);
      setIsResetModalOpen(false);
      setResetFeedback({
        type: "success",
        text: "تمت إعادة ضبط المصنع وتصفير جميع البيانات والاختبارات بنجاح!",
      });

      // Immediately zero out Sidebar & TopHeaderBar usage counters, then confirm with fresh session fetch
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tenant-session-sync", {
            detail: {
              authenticated: true,
              usage: {
                studentsCount: 0,
                activeStudentsCount: 0,
                groupsCount: 0,
                filesBytes: 0,
              },
            },
          })
        );
      }

      fetch(`/api/auth/session?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((sessionData) => {
          if (sessionData && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tenant-session-sync", { detail: sessionData }));
          }
        })
        .catch(() => {});

      router.refresh();
    } catch (err: any) {
      setResetFeedback({
        type: "error",
        text: err?.message || "حدث خطأ أثناء إعادة ضبط المصنع",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Pinned Admin Messages / News & Updates Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 border border-amber-200/90 rounded-3xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="text-sm sm:text-base font-black text-amber-950">
              رسائل وأخبار الإدارة المثبتة
            </h3>

            {pinnedNotice && pinnedNotice.trim() ? (
              <p className="text-xs sm:text-sm font-bold text-amber-900 leading-relaxed whitespace-pre-line bg-white/80 border border-amber-200/70 rounded-2xl p-4 mt-2">
                {pinnedNotice}
              </p>
            ) : (
              <p className="text-xs font-semibold text-amber-800/80">
                لا توجد رسائل حالياً
              </p>
            )}
          </div>
        </div>
      </div>

      {resetFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 ${
            resetFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {resetFeedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{resetFeedback.text}</span>
          </div>
          <button
            onClick={() => setResetFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Storage Capacity, Technical Support & Factory Reset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Real Storage Usage (KB / MB) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <HardDrive className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-purple-700 bg-purple-50 border border-purple-200/60 px-3 py-1 rounded-xl font-mono">
                {displayPercent}
              </span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-600" />
                <span>الاستهلاك الفعلي للمساحة السحابية</span>
              </h4>
              <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                <span className="text-lg sm:text-xl font-black text-slate-900">
                  {formatUsedStorageArabic(usedBytes)}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  / {formatStorageLimitMbArabic(limitBytes)}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${barWidthPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: WhatsApp Technical Support (01091713815) */}
        <div className="bg-white rounded-3xl border border-emerald-200/80 shadow-xs p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900">التحدث مع الدعم الفني</h4>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                تواصل مباشرة عبر واتساب مع فريق الدعم الفني للاستفسارات، تجديد الباقة، أو طلب إضافة مميزات جديدة لنسختك.
              </p>
            </div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>تحدث مع الدعم الفني عبر واتساب</span>
          </a>
        </div>

        {/* Card 3: Factory Reset (إعادة ضبط المصنع وتصفير البيانات) */}
        <div className="bg-white rounded-3xl border border-rose-200/80 shadow-xs p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-xl">
                إعادة ضبط المصنع
              </span>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900">
                تصفير النظام وإعادة ضبط المصنع (Reset)
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                حذف كافة البيانات المسجلة (الطلاب، المجموعات، الحسابات، الغياب، الاختبارات المنشأة، والملفات) وإرجاع التطبيق فارغاً كما كان عند التسطيب.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة ضبط المصنع وتصفير البيانات (Reset)</span>
          </button>
        </div>
      </div>

      {/* Warning Confirmation Modal before Factory Reset */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900">
                تحذير هام: هل أنت متأكد من إعادة ضبط المصنع؟
              </h3>
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                سيؤدي هذا الإجراء إلى <strong className="text-rose-600">تصفير النظام بالكامل وحذف جميع البيانات نهائياً</strong> ولا يمكن التراجع عنه، ويشمل:
              </p>
              <ul className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/70 rounded-2xl p-3.5 space-y-1.5 list-disc list-inside">
                <li>جميع المجموعات الدراسية وسجلات الطلاب والحسابات المالية</li>
                <li>سجلات الحضور والغياب ودرجات الامتحانات وأوراق الـ QR</li>
                <li>كافة الاختبارات المنشأة والملفات المحفوظة والمساحة المستخدمة</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmFactoryReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تصفير النظام...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>نعم، تصفير كل البيانات الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

