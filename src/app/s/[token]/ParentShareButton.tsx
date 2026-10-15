"use client";

import React, { useState } from "react";
import { Share2, Bookmark, Check, Copy } from "lucide-react";

interface ParentShareButtonProps {
  studentName: string;
}

export default function ParentShareButton({ studentName }: ParentShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `بطاقة متابعة الطالب: ${studentName}`;
    const text = `تقرير متابعة الطالب ${studentName} - الدرجات والحضور والمصروفات فورياً`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or unsupported, fallback to copy
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3500);
      } catch {
        // Fallback prompt
        window.prompt("انسخ رابط المتابعة التالي:", url);
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white px-7 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-300" />
            <span>تم نسخ الرابط! احفظه في المفضلة</span>
          </>
        ) : (
          <>
            <Bookmark className="w-4 h-4" />
            <span>حفظ ومشاركة رابط المتابعة</span>
            <Share2 className="w-4 h-4 opacity-80" />
          </>
        )}
      </button>

      {copied && (
        <p className="text-xs font-semibold text-emerald-600 animate-in fade-in">
          تم نسخ الرابط بنجاح! يمكنك الآن لصقه في المتصفح أو إضافته للشاشة الرئيسية.
        </p>
      )}
    </div>
  );
}
