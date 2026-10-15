"use client";

import React from "react";
import {
  X,
  Shuffle,
  RotateCw,
  CheckCircle2,
  Layers,
  ShieldCheck,
  AlertCircle,
  Copy,
} from "lucide-react";

interface ModelGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelCount: number;
  questionsCount: number;
  onGenerate: (count: 2 | 3) => void;
  onReshuffle: () => void;
  onResetSingleModel: () => void;
}

export default function ModelGenerationModal({
  isOpen,
  onClose,
  currentModelCount,
  questionsCount,
  onGenerate,
  onReshuffle,
  onResetSingleModel,
}: ModelGenerationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in select-none no-print"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 text-slate-800 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                توليد نماذج الاختبار (أ - ب - ج)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                توزيع عشوائي ذكي لمنع الغش وتبادل الإجابات بين الطلاب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Info */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">آلية العمل الدقيقة: </span>
            يتم الاحتفاظ بالترتيب الأصلي كـ <span className="font-bold text-blue-700">نموذج (أ)</span>، وتوليد نسخ مخلوطة عشوائياً بخوارزمية فيشر-يتس للنماذج الأخرى، مع تحديث أرقام الأسئلة تلقائياً بحسب ترتيبها الرأسي الجديد.
          </div>
        </div>

        {questionsCount === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>يرجى إضافة أسئلة إلى الاختبار أولاً قبل توليد النماذج.</span>
          </div>
        )}

        {/* Model Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Option 1: 2 Models (A - B) */}
          <div
            onClick={() => {
              if (questionsCount > 0) {
                onGenerate(2);
                onClose();
              }
            }}
            className={`rounded-xl border-2 p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer ${
              currentModelCount === 2
                ? "border-blue-600 bg-blue-50/40 shadow-xs"
                : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/70"
            } ${questionsCount === 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center shadow-2xs">
                  أ
                </span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-2xs">
                  ب
                </span>
              </div>
              {currentModelCount === 2 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  مُفعّل حالياً
                </span>
              )}
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-slate-900 mb-1">
                نموذجين (أ - ب)
              </h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                مثالي للفصول العادية بتوزيع متناوب بين كل طالبين متجاورين في الصف.
              </p>
            </div>

            <button
              type="button"
              className="w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {currentModelCount === 2 ? "تحديث نموذجين (أ - ب)" : "توليد نموذجين (أ - ب)"}
            </button>
          </div>

          {/* Option 2: 3 Models (A - B - C) */}
          <div
            onClick={() => {
              if (questionsCount > 0) {
                onGenerate(3);
                onClose();
              }
            }}
            className={`rounded-xl border-2 p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer ${
              currentModelCount === 3
                ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
                : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/70"
            } ${questionsCount === 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center shadow-2xs">
                  أ
                </span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-2xs">
                  ب
                </span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="w-6 h-6 rounded-lg bg-purple-600 text-white text-xs font-black flex items-center justify-center shadow-2xs">
                  ج
                </span>
              </div>
              {currentModelCount === 3 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                  مُفعّل حالياً
                </span>
              )}
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-slate-900 mb-1">
                ٣ نماذج (أ - ب - ج)
              </h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                حماية قصوى وتوزيع ثلاثي داخل قاعات الامتحانات والصفوف المكتظة.
              </p>
            </div>

            <button
              type="button"
              className="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {currentModelCount === 3 ? "تحديث ٣ نماذج (أ - ب - ج)" : "توليد ٣ نماذج (أ - ب - ج)"}
            </button>
          </div>
        </div>

        {/* Existing Models Actions (Reshuffle / Revert) */}
        {currentModelCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onReshuffle();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600" />
              <span>إعادة خلط الأسئلة (Reshuffle)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onResetSingleModel();
                onClose();
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              إلغاء النماذج والعودة لنموذج واحد
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
