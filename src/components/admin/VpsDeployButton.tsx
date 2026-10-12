"use client";

import React, { useState, useTransition } from "react";
import { deployExamBuilderToVpsAction, VpsDeployResult } from "@/app/actions/vps-provisioning";
import {
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Server,
  X,
  RefreshCw,
  Terminal,
} from "lucide-react";

export default function VpsDeployButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<VpsDeployResult | null>(null);

  const handleDeploy = () => {
    setResult(null);
    startTransition(async () => {
      const res = await deployExamBuilderToVpsAction();
      setResult(res);
    });
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setResult(null);
        }}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
        title="تثبيت ونشر منصة بنك الاختبارات على سيرفر Hostinger VPS مباشرة"
      >
        <Rocket className="w-3.5 h-3.5 text-blue-200" />
        <span>نشر المنصة على VPS</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-5"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    نشر وتثبيت المنصة على خادم VPS
                  </h3>
                  <p className="text-xs text-slate-500">
                    تشغيل التطبيق على منفذ 3015 وتفعيل Nginx لدومينات المعلمين تلقائياً
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-2 text-slate-600">
              <p className="font-bold text-slate-800">ماذا سيحدث عند النقر على بدء النشر؟</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
                <li>سحب أحدث كود للمنصة من GitHub إلى مجلد <code className="text-blue-600 font-mono">/var/www/exam-builder</code>.</li>
                <li>توليد نماذج قاعدة البيانات (Prisma) وبناء النسخة الإنتاجية.</li>
                <li>تشغيل التطبيق تلقائياً عبر PM2 على منفذ <strong>3015</strong> لمنع أي تضارب مع المواقع الأخرى.</li>
                <li>تفعيل ملف Nginx الشامل لربط كافة دومينات المعلمين <code className="text-emerald-600 font-mono">*.oqabagency.com</code> فورياً.</li>
              </ul>
            </div>

            {/* In Progress */}
            {isPending && (
              <div className="py-6 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  جاري النشر وتجهيز السيرفر... قد يستغرق دقيقة واحدة.
                </p>
                <p className="text-xs text-slate-500">
                  يتم سحب التحديثات وتفعيل إعدادات Nginx على خادم Hostinger VPS.
                </p>
              </div>
            )}

            {/* Results */}
            {!isPending && result && (
              <div className="space-y-3">
                {result.success ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{result.message}</span>
                    </div>
                    <p className="text-emerald-700">
                      المنصة الآن تعمل على خادم VPS، وكافة دومينات المستأجرين ستفتح التطبيق بنجاح!
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 space-y-1 text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <span>{result.message}</span>
                    </div>
                    <p className="text-red-700 mr-7">{result.error}</p>
                  </div>
                )}

                {result.logs && result.logs.length > 0 && (
                  <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono text-[10px] max-h-36 overflow-y-auto" dir="ltr">
                    {result.logs.join("\n")}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                إغلاق
              </button>

              <button
                type="button"
                onClick={handleDeploy}
                disabled={isPending}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Rocket className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                <span>{isPending ? "جاري النشر..." : "بدء النشر التلقائي الآن"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
