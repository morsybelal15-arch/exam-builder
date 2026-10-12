"use client";

import React, { useState, useTransition } from "react";
import { updateAppFromRepoAction, AutoUpdateResult, GitCommitInfo } from "@/app/actions/auto-update";
import {
  GitPullRequest,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Copy,
  Check,
  X,
  Server,
  Sparkles,
} from "lucide-react";

interface AutoUpdateButtonProps {
  initialCommit?: GitCommitInfo | null;
}

export default function AutoUpdateButton({ initialCommit }: AutoUpdateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AutoUpdateResult | null>(null);
  const [copiedVps, setCopiedVps] = useState(false);
  const [latestCommit, setLatestCommit] = useState<GitCommitInfo | null>(initialCommit || null);

  const handleUpdate = () => {
    setResult(null);
    startTransition(async () => {
      const res = await updateAppFromRepoAction();
      setResult(res);
      if (res.commit) {
        setLatestCommit(res.commit);
      }
    });
  };

  const handleCopyVpsCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedVpsV(true);
    setTimeout(() => setCopiedVpsV(false), 2500);
  };

  const setCopiedVpsV = (val: boolean) => {
    setCopiedVps(val);
  };

  return (
    <>
      {/* Trigger Button in Header */}
      <button
        onClick={() => {
          setIsOpen(true);
          setResult(null);
        }}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
        title="تحديث التطبيق وسحب أحدث نسخة من المستودع"
      >
        <RefreshCw className="w-3.5 h-3.5 text-emerald-100" />
        <span className="hidden sm:inline">تحديث من المستودع</span>
        <span className="sm:hidden">تحديث</span>
        {latestCommit && (
          <span className="bg-emerald-900/40 text-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {latestCommit.hash}
          </span>
        )}
      </button>

      {/* Auto Update Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-5"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <GitPullRequest className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تحديث التطبيق التلقائي من المستودع
                  </h3>
                  <p className="text-xs text-slate-500">
                    مزامنة وسحب أحدث التحديثات البرمجية من GitHub مباشرة
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

            {/* Current Commit Info */}
            {latestCommit && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-bold">الإصدار الحالي المثبت:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800">
                    {latestCommit.hash}
                  </span>
                </div>
                <p className="text-slate-700 font-medium truncate">
                  {latestCommit.message}
                </p>
                <p className="text-[10px] text-slate-400">
                  بواسطة {latestCommit.author} ({latestCommit.date})
                </p>
              </div>
            )}

            {/* Action State / Results */}
            {isPending && (
              <div className="py-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  جاري فحص مستودع GitHub وسحب التحديثات (git pull)...
                </p>
                <p className="text-xs text-slate-500">
                  يتم تحديث الملفات وتطهير الكاش المؤقت تلقائياً.
                </p>
              </div>
            )}

            {!isPending && result && (
              <div className="space-y-4">
                {result.success ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{result.message}</span>
                    </div>
                    {result.commit && (
                      <p className="text-xs text-emerald-700 mr-7">
                        أحدث تعديل: <strong>{result.commit.message}</strong> ({result.commit.hash})
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 space-y-1 text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <span>{result.message}</span>
                    </div>
                    <p className="mr-7">{result.error}</p>
                  </div>
                )}

                {/* VPS Remote Command */}
                {result.vpsCommand && (
                  <div className="p-3.5 bg-slate-900 text-slate-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Server className="w-3.5 h-3.5 text-blue-400" />
                        <span>لتحديث خادم Hostinger VPS أيضاً بنقرة:</span>
                      </span>
                      <button
                        onClick={() => handleCopyVpsCommand(result.vpsCommand!)}
                        className="inline-flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-white transition-all cursor-pointer"
                      >
                        {copiedVps ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>نسخ الأمر</span>
                          </>
                        )}
                      </button>
                    </div>
                    <code className="block bg-black/40 p-2.5 rounded-xl font-mono text-[11px] text-emerald-400 break-all select-all" dir="ltr">
                      {result.vpsCommand}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
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
                onClick={handleUpdate}
                disabled={isPending}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                <span>{isPending ? "جاري التحديث..." : "بدء التحديث الآن"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
