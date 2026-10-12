"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  X,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (newKey: string) => void;
  hasServerKey?: boolean;
}

export default function GeminiKeyModal({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  hasServerKey = false,
}: GeminiKeyModalProps) {
  const [inputKey, setInputKey] = useState<string>(apiKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    model?: string;
  } | null>(null);

  useEffect(() => {
    setInputKey(apiKey);
    setTestResult(null);
  }, [apiKey, isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setTestResult({
        success: false,
        message: "يرجى كتابة أو لصق مفتاح Gemini API أولاً.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/config/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed, saveToEnv: true }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || "تم التحقق من المفتاح بنجاح!",
          model: data.model,
        });
        onSaveKey(trimmed);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setTestResult({
          success: false,
          message: data.error || "فشل التحقق من المفتاح. تأكد من صحته.",
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "تعذر الاتصال بالخادم لفحص المفتاح.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    setInputKey("");
    setTestResult(null);
    onSaveKey("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6 relative overflow-hidden"
        dir="rtl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              إعدادات مفتاح API
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              أدخل مفتاح Google Gemini API لاستخراج الأسئلة وتنسيقها تلقائياً.
            </p>
          </div>
        </div>

        {/* Server key info if present */}
        {hasServerKey && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>المفتاح محفوظ ونشط في الخادم.</span>
          </div>
        )}

        {/* Input Field */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            مفتاح Gemini API Key
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <Key className="w-4 h-4" />
            </div>
            <input
              type={showKey ? "text" : "password"}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono transition-all"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Help Link */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            ليس لديك مفتاح؟ يمكنك الحصول عليه مجاناً بدقيقة واحدة:
          </span>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold hover:underline"
          >
            <span>Google AI Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Feedback message */}
        {testResult && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2 ${
              testResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p>{testResult.message}</p>
              {testResult.model && (
                <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                  النموذج النشط: {testResult.model}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {inputKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-600 hover:text-red-700 font-semibold px-3 py-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
            >
              مسح المفتاح
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={isTesting || !inputKey.trim()}
              onClick={handleTestAndSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-all cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق والحفظ...</span>
                </>
              ) : (
                <span>حفظ المفتاح</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
