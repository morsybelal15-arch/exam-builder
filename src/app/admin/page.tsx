import React from "react";
import Link from "next/link";
import { ShieldCheck, Users, Key, HardDrive, ArrowLeft, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col" dir="rtl">
      {/* Admin Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
              <span>لوحة تحكم مدير النظام</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                SUPER_ADMIN
              </span>
            </h1>
            <p className="text-xs text-slate-400">إدارة المعلمين والمستأجرين والاشتراكات والمساحات</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/exam-builder"
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl transition-all"
          >
            <span>منشئ الاختبارات</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 sm:p-10 max-w-6xl mx-auto w-full space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">إجمالي المستأجرين (المعلمين)</p>
              <h3 className="text-2xl font-black text-white mt-1">SaaS Tenants</h3>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">مفاتيح التفعيل (Activation Keys)</p>
              <h3 className="text-2xl font-black text-white mt-1">إدارة التراخيص</h3>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">سعة التخزين المخصصة</p>
              <h3 className="text-2xl font-black text-white mt-1">1GB / Tenant</h3>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-3xl">
          <h2 className="text-lg font-bold text-white mb-2">مرحباً بك في لوحة تحكم المنصة الموحدة</h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
            تم تسجيل دخولك بنجاح بصفتك <strong>Super Admin</strong>. يتم توجيه المعلمين تلقائياً إلى مساحة عمل منشئ الاختبارات الخاصة بهم، بينما يتم توجيه حسابك الإداري إلى هذه البوابة لتنظيم الحسابات والاشتراكات.
          </p>
        </div>
      </main>
    </div>
  );
}
