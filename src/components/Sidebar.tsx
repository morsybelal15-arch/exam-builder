"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  Home,
  PenTool,
  FolderUp,
  Image as ImageIcon,
  FileText,
  GraduationCap,
  CreditCard,
  LogOut,
  Users,
  UserCheck,
  QrCode,
  FileSpreadsheet,
  Plus,
  Cloud,
  ShieldCheck,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import {
  APP_FEATURES_REGISTRY,
  SIDEBAR_SECTIONS_ORDER,
  ALL_FEATURE_IDS,
  SubscriptionCategory,
  normalizeEnabledFeatures,
  getFirstAllowedRoute,
} from "@/lib/app-features";

const ICON_MAP: Record<string, any> = {
  Home,
  Users,
  UserCheck,
  QrCode,
  FileSpreadsheet,
  PenTool,
  FileText,
  FolderUp,
  Image: ImageIcon,
  CreditCard,
};

export default function Sidebar() {
  const pathname = usePathname();
  const navListRef = useRef<HTMLElement>(null);
  const [role, setRole] = useState<string>("TENANT");
  const [clientName, setClientName] = useState<string>("السنتر");
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionCategory>("سنتر");
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(ALL_FEATURE_IDS);
  const [storageLimitBytes, setStorageLimitBytes] = useState<number>(1073741824);
  const [usage, setUsage] = useState<{
    studentsCount: number;
    activeStudentsCount: number;
    groupsCount: number;
    filesBytes: number;
  }>({
    studentsCount: 0,
    activeStudentsCount: 0,
    groupsCount: 0,
    filesBytes: 0,
  });

  const applySessionPayload = (data: any) => {
    if (!data || !data.authenticated) return;
    if (data.role) setRole(data.role);
    if (data.name) setClientName(data.name);
    if (data.subscriptionType === "معلم" || data.subscriptionType === "سنتر") {
      setSubscriptionType(data.subscriptionType);
    }
    if (Array.isArray(data.enabledFeatures)) {
      setEnabledFeatures(normalizeEnabledFeatures(data.enabledFeatures));
    }
    if (data.storageLimitBytes) {
      setStorageLimitBytes(Number(data.storageLimitBytes) || 1073741824);
    }
    if (data.usage) setUsage(data.usage);
  };

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => applySessionPayload(data))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    const onSync = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        applySessionPayload(custom.detail);
      }
    };
    window.addEventListener("tenant-session-sync", onSync);
    return () => window.removeEventListener("tenant-session-sync", onSync);
  }, []);

  // Lightweight GSAP entrance for sidebar navigation items (post-hydration safe)
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      if (!navListRef.current) return;
      const links = navListRef.current.querySelectorAll("a");
      gsap.fromTo(
        links,
        { opacity: 0, x: 14 },
        {
          opacity: 1,
          x: 0,
          duration: 0.35,
          stagger: 0.03,
          ease: "power2.out",
          clearProps: "transform,opacity",
        }
      );
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Hide sidebar on login, admin, parent portal, and denied pages
  if (
    pathname === "/login" ||
    pathname.startsWith("/admin") ||
    pathname === "/denied" ||
    pathname.startsWith("/s/") ||
    pathname === "/s"
  ) {
    return null;
  }

  const usedMb = (usage.filesBytes / (1024 * 1024)).toFixed(2);
  const limitGb = Math.max(1, Math.round(storageLimitBytes / 1073741824));
  const storagePct = Math.min(
    100,
    Math.max(6, Math.round((usage.filesBytes / Math.max(1, storageLimitBytes)) * 100))
  );
  const activeRatioPct =
    usage.studentsCount > 0
      ? Math.min(
          100,
          Math.max(8, Math.round((usage.activeStudentsCount / usage.studentsCount) * 100))
        )
      : 20;

  // Build visible sections dynamically from APP_FEATURES_REGISTRY filtered by enabledFeatures
  const visibleSections = SIDEBAR_SECTIONS_ORDER.map((sectionTitle) => ({
    title: sectionTitle,
    items: APP_FEATURES_REGISTRY.filter(
      (f) => f.section === sectionTitle && enabledFeatures.includes(f.id)
    ),
  })).filter((s) => s.items.length > 0);

  const hasExamBuilder = enabledFeatures.includes("exam-builder");
  const hasStudentsOrGroups =
    enabledFeatures.includes("students") ||
    enabledFeatures.includes("groups") ||
    enabledFeatures.includes("dashboard");
  const homeHref = getFirstAllowedRoute(enabledFeatures);

  return (
    <aside className="w-64 sm:w-68 shrink-0 bg-white h-screen flex flex-col select-none z-20 print:hidden">
      {/* Top White Brand Header showing the Client's Name & Subscription Type */}
      <div className="h-20 px-6 flex items-center justify-between bg-white shrink-0">
        <Link href={homeHref} className="flex items-center gap-3 group min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/25 group-hover:scale-105 transition-transform shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1
              className="font-extrabold text-base sm:text-lg text-blue-600 tracking-tight leading-tight truncate"
              title={clientName}
            >
              {clientName || "السنتر"}
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
              {subscriptionType === "معلم"
                ? "منصة المعلم والاختبارات"
                : "منصة إدارة السنتر والاختبارات"}
            </p>
          </div>
        </Link>
      </div>

      {/* Curved Primary Sidebar Body (Primary theme background + fluid cutout active item) */}
      <div className="flex-1 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 rounded-tl-[48px] text-white flex flex-col justify-between pr-5 pl-0 pt-7 pb-5 overflow-y-auto">
        <div className="space-y-6">
          {/* Primary White Pill Action Button — only shown if exam-builder feature is installed */}
          {hasExamBuilder && (
            <div className="pr-1 pl-6">
              <Link
                href="/exam-builder"
                className="w-full py-3 px-5 bg-white hover:bg-slate-100 text-blue-600 rounded-full text-xs font-extrabold shadow-md shadow-blue-950/15 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.99]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>إنشاء اختبار جديد</span>
              </Link>
            </div>
          )}

          {/* Navigation Links Grouped by Section (السنتر - الاختبارات - الإعدادات) */}
          <nav ref={navListRef} className="space-y-3">
            {visibleSections.map((section, sectionIdx) => (
              <div key={section.title} className="space-y-1">
                {sectionIdx > 0 && (
                  <div className="h-px bg-slate-300/25 my-2.5 mr-2 ml-6" />
                )}
                <span className="pr-4 pl-6 pb-0.5 text-[10px] font-extrabold tracking-wider text-white/70 block">
                  {section.title}
                </span>

                {section.items.map((item) => {
                  const Icon = ICON_MAP[item.iconName] || FileText;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      prefetch={true}
                      className={`group relative flex items-center gap-3.5 text-xs transition-all duration-200 ${
                        isActive
                          ? "ml-0 pr-4 pl-6 py-2.5 rounded-r-full rounded-l-none bg-[var(--background)] text-blue-600 font-extrabold z-10"
                          : "ml-4 px-4 py-2 rounded-2xl font-bold text-white opacity-90 hover:opacity-100 hover:bg-white/12"
                      }`}
                    >
                      {/* Top Fluid Inverted Curve Notch when Active */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -top-5 left-0 w-5 h-5"
                          style={{
                            background:
                              "radial-gradient(circle at 100% 0%, transparent 20px, var(--background) 20.5px)",
                          }}
                        />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                          isActive ? "text-blue-600" : "text-white"
                        }`}
                      />
                      <span
                        className={`truncate ${
                          isActive ? "text-blue-600 font-extrabold" : "text-white"
                        }`}
                      >
                        {item.name}
                      </span>

                      {/* Bottom Fluid Inverted Curve Notch when Active */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -bottom-5 left-0 w-5 h-5"
                          style={{
                            background:
                              "radial-gradient(circle at 100% 100%, transparent 20px, var(--background) 20.5px)",
                          }}
                        />
                      )}
                    </Link>
                  );
                })}

                {sectionIdx === visibleSections.length - 1 && role === "SUPER_ADMIN" && (
                  <Link
                    href="/admin"
                    className="mt-1.5 ml-4 flex items-center gap-3.5 px-4 py-2 rounded-2xl text-xs font-extrabold bg-white/18 hover:bg-white/25 text-white border border-white/30 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0 text-white" />
                    <span className="truncate text-white">لوحة السوبر أدمن</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Storage & Center Details (All text strictly White) */}
        <div className="pt-5 mt-5 pl-5 border-t border-white/20 space-y-4 text-white">
          <div className="px-1 space-y-3">
            <span className="text-[10px] font-extrabold tracking-wider text-white/90 uppercase block">
              إحصائيات السعة والمركز
            </span>

            {/* Metric 1: Active Students Bar — shown if students/groups/dashboard features are installed */}
            {hasStudentsOrGroups && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Users className="w-3.5 h-3.5 text-white" />
                  <span>الطلاب الفعليون</span>
                </div>
                <div className="w-full h-1.5 bg-blue-950/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${activeRatioPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/90">
                  {usage.activeStudentsCount} طالب نشط من إجمالي {usage.studentsCount} ({usage.groupsCount} مجموعات)
                </p>
              </div>
            )}

            {/* Metric 2: Cloud Storage Bar (White Progress) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Cloud className="w-3.5 h-3.5 text-white" />
                <span>المساحة السحابية</span>
              </div>
              <div className="w-full h-1.5 bg-blue-950/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
              <p className="text-[10px] text-white/90">
                تم استخدام {usedMb} ميجابايت من {limitGb} جيجابايت
              </p>
            </div>
          </div>

          {/* Logout Button (Danger Red) */}
          <div className="px-1 pt-1 flex items-center justify-end gap-2">
            <form action={logoutAction} className="w-full">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
