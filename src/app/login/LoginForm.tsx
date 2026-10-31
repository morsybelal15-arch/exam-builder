"use client";

import React, { useState } from "react";
import { Phone, Lock, LogIn, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { clearCachedSession } from "@/lib/client-session-cache";

export default function LoginForm({
  isAdmin = false,
  tenantName = null,
  subscriptionType = null,
  initialBlockedMessage = null,
}: {
  isAdmin?: boolean;
  tenantName?: string | null;
  subscriptionType?: string | null;
  initialBlockedMessage?: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialBlockedMessage);

  React.useEffect(() => {
    clearCachedSession();
    const blocked = new URLSearchParams(window.location.search).get("blocked");
    if (blocked) setErrorMessage(blocked);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "فشل تسجيل الدخول. يرجى التحقق من البيانات.");
        setIsLoading(false);
        return;
      }

      // Honor ?callbackUrl= only for same-site relative paths and only when it matches the role
      let target: string = data.redirectUrl || "/exam-builder";
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl");
      if (
        callbackUrl &&
        callbackUrl.startsWith("/") &&
        !callbackUrl.startsWith("//") &&
        !callbackUrl.startsWith("/login") &&
        (data.role === "SUPER_ADMIN" || !callbackUrl.startsWith("/admin"))
      ) {
        target = callbackUrl;
      }

      // Full page navigation guarantees the new session cookie is sent to the middleware
      window.location.assign(target);

      // Safety net: if navigation doesn't happen (e.g. cookie blocked), release the button
      setTimeout(() => {
        setIsLoading(false);
        setErrorMessage("تم التحقق بنجاح لكن تعذر حفظ جلسة الدخول. تأكد من تفعيل ملفات تعريف الارتباط (Cookies) في المتصفح.");
      }, 8000);
    } catch {
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
            {isAdmin ? <ShieldCheck className="w-8 h-8" /> : <LogIn className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isAdmin
              ? "لوحة تحكم مدير النظام"
              : tenantName
              ? `منصة ${tenantName}`
              : "تسجيل الدخول"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            {isAdmin
              ? "دخول مخصص لمدير النظام فقط"
              : subscriptionType === "معلم"
              ? "منصة المعلم الذكية لإدارة الطلاب والاختبارات"
              : "منصة إدارة السنتر وبنك الاختبارات التفاعلي"}
          </p>
        </div>

        {/* Error / Trial Expired Notification */}
        {errorMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-xs sm:text-sm space-y-3 animate-in fade-in ${
              errorMessage.includes("الفترة التجريبية") || errorMessage.includes("24 ساعة")
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-start gap-2.5 font-bold">
              <AlertCircle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  errorMessage.includes("الفترة التجريبية") || errorMessage.includes("24 ساعة")
                    ? "text-amber-600"
                    : "text-red-500"
                }`}
              />
              <div className="space-y-1">
                {(errorMessage.includes("الفترة التجريبية") ||
                  errorMessage.includes("24 ساعة")) && (
                  <p className="text-sm font-black text-amber-900">
                    انتهت الفترة المجانية (24 ساعة)
                  </p>
                )}
                <p>{errorMessage}</p>
              </div>
            </div>

            {(errorMessage.includes("الفترة التجريبية") ||
              errorMessage.includes("24 ساعة") ||
              errorMessage.includes("انتهت") ||
              errorMessage.includes("انتهى")) && (
              <a
                href="https://wa.me/201091713815?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%AA%D9%81%D8%B9%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B4%D8%AA%D8%B1%D8%A7%D9%83%20%D8%A7%D9%84%D9%83%D8%A7%D9%85%D9%84%20%D9%81%D9%8A%20%D9%85%D9%86%D8%B5%D8%A9%20inCenter"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>تواصل مع الإدارة عبر واتساب لتفعيل الاشتراك الكامل</span>
              </a>
            )}
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
