"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Lock, LogIn, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "فشل تسجيل الدخول. يرجى التحقق من البيانات.");
        setIsLoading(false);
        return;
      }

      // Detection and routing is dictated entirely by server response:
      // data.redirectUrl is '/admin' for SUPER_ADMIN, and '/exam-builder' for TENANT
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push("/exam-builder");
      }
    } catch (err: any) {
      setErrorMessage("حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10 transition-all">
        {/* Brand / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">تسجيل الدخول</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            منصة بنك الاختبارات والتدريس التفاعلي
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Number Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">رقم الهاتف</label>
            <div className="relative flex items-center">
              <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 rounded-2xl text-sm font-semibold text-slate-900 transition-all outline-none"
              />
            </div>
          </div>

          {/* Password Field with Eye Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">كلمة المرور</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir={showPassword ? "ltr" : undefined}
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 rounded-2xl text-sm font-semibold text-slate-900 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-3.5 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer p-1"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-3.5 px-6 rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التحقق والدخول...</span>
              </>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
