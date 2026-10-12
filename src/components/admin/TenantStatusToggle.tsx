"use client";

import React, { useTransition } from "react";
import { toggleTenantStatusAction } from "@/app/actions/admin";
import { Loader2, Power, CheckCircle2, Ban } from "lucide-react";

interface TenantStatusToggleProps {
  tenantId: string;
  initialStatus: "ACTIVE" | "STOPPED" | "EXPIRED";
  tenantName: string;
}

export default function TenantStatusToggle({
  tenantId,
  initialStatus,
  tenantName,
}: TenantStatusToggleProps) {
  const [isPending, startTransition] = useTransition();
  const isActive = initialStatus === "ACTIVE";

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await toggleTenantStatusAction(tenantId);
      } catch (err: any) {
        alert(err.message || "فشل تحديث حالة الحساب");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Status Badge */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
          isActive
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-rose-50 text-rose-700 border-rose-200"
        }`}
      >
        {isActive ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>نشط</span>
          </>
        ) : (
          <>
            <Ban className="w-3.5 h-3.5" />
            <span>متوقف</span>
          </>
        )}
      </span>

      {/* Quick Action Toggle Button */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={isActive ? `إيقاف حساب ${tenantName}` : `تفعيل حساب ${tenantName}`}
        className={`relative inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
          isActive
            ? "bg-white hover:bg-rose-50 text-rose-600 border-rose-200 hover:border-rose-300 active:scale-95"
            : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 active:scale-95 shadow-sm shadow-emerald-600/20"
        }`}
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Power className="w-3.5 h-3.5" />
        )}
        <span>{isActive ? "إيقاف الحساب" : "تفعيل الحساب"}</span>
      </button>
    </div>
  );
}
