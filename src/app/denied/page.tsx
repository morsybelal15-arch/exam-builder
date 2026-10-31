import React from "react";
import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-[#131c31] rounded-3xl border border-slate-800 shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-blue-500/15 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-blue-500/25">
          <Compass className="w-8 h-8" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white mb-2.5 leading-snug">
          اللينك غلط.. عايز تطلع برا التطبيق ليه؟
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
          الرابط اللي كتبته غلط أو مش موجود، اضغط على الزر بالأسفل للرجوع إلى تطبيقك مباشرة.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3.5 px-5 rounded-2xl text-sm transition-all shadow-md shadow-blue-600/25 active:scale-[0.99]"
          >
            <Home className="w-4 h-4" />
            <span>الرجوع إلى تطبيقي</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
