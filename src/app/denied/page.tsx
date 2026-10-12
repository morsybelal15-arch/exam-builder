import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Home } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-red-100">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-2">غير مصرح بالدخول</h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          هذه الصفحة مخصصة لمدير النظام (Super Admin) فقط. ليس لديك الصلاحية الكافية للوصول إلى لوحة التحكم هذه.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/exam-builder"
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-5 rounded-2xl text-sm transition-all shadow-md shadow-blue-500/20 active:scale-[0.99]"
          >
            <Home className="w-4 h-4" />
            <span>العودة إلى منشئ الاختبارات</span>
          </Link>

          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-5 rounded-2xl text-sm transition-all active:scale-[0.99]"
          >
            <ArrowRight className="w-4 h-4" />
            <span>تسجيل الدخول بحساب آخر</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
