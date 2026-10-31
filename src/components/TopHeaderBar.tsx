"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Users,
  UserCheck,
  X,
  ArrowUpLeft,
  Check,
  Palette,
  Clock,
} from "lucide-react";
import { getCachedSession, setCachedSession } from "@/lib/client-session-cache";

interface QuickStudent {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  groupName?: string;
}

interface QuickGroup {
  id: string;
  name: string;
  academicYear: string;
  subject: string;
}

interface ThemePreset {
  id: string;
  label: string;
  subtitle: string;
  swatch: string;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "الأزرق الملكي",
    subtitle: "الثيم الافتراضي للنظام",
    swatch: "#1B64F2",
  },
  {
    id: "orange",
    label: "البرتقالي الدافئ",
    subtitle: "ثيم حيوي عالي التباين",
    swatch: "#EA580C",
  },
  {
    id: "burgundy",
    label: "أحمر برجاندي",
    subtitle: "ثيم كلاسيكي فخم",
    swatch: "#881337",
  },
  {
    id: "emerald",
    label: "الأخضر الزمردي",
    subtitle: "ثيم مريح للعين",
    swatch: "#047857",
  },
  {
    id: "violet",
    label: "البنفسجي الملكي",
    subtitle: "ثيم عصري أنيق",
    swatch: "#6D28D9",
  },
  {
    id: "dark",
    label: "الوضع الليلي (Dark)",
    subtitle: "مظهر داكن هادئ",
    swatch: "#0F172A",
  },
];

export default function TopHeaderBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string>("العميل المشترك");
  const [subscriptionType, setSubscriptionType] = useState<string>("سنتر");
  const [isTrial, setIsTrial] = useState<boolean>(false);
  const [subscriptionDueDate, setSubscriptionDueDate] = useState<string | null>(null);
  const [maxExtractedQuestions, setMaxExtractedQuestions] = useState<number>(30);
  const [extractedQuestionsUsed, setExtractedQuestionsUsed] = useState<number>(0);
  const [trialCountdown, setTrialCountdown] = useState<string>("24:00:00");
  const [query, setQuery] = useState<string>("");
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<string>("default");
  const [students, setStudents] = useState<QuickStudent[]>([]);
  const [groups, setGroups] = useState<QuickGroup[]>([]);
  const [hasLoadedDirectory, setHasLoadedDirectory] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Restore saved theme & cached user info synchronously before paint
  useLayoutEffect(() => {
    try {
      const saved =
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("app_theme_preset") ||
        "default";
      setActiveTheme(saved);
      if (saved === "default") {
        document.documentElement.removeAttribute("data-theme");
        document.documentElement.style.backgroundColor = "";
        document.documentElement.style.colorScheme = "";
      } else {
        document.documentElement.setAttribute("data-theme", saved);
        if (saved === "dark") {
          document.documentElement.style.backgroundColor = "#0b1120";
          document.documentElement.style.colorScheme = "dark";
        }
      }
    } catch {
      // ignore storage errors
    }

    const cached = getCachedSession();
    if (cached && cached.authenticated) {
      if (cached.name) setUserName(cached.name);
      if (cached.subscriptionType) setSubscriptionType(cached.subscriptionType);
      setIsTrial(Boolean(cached.isTrial || cached.subscriptionType === "تجربة مجانية"));
      if (cached.subscriptionDueDate !== undefined) {
        setSubscriptionDueDate(cached.subscriptionDueDate || null);
      }
      if (cached.maxExtractedQuestions !== undefined) {
        setMaxExtractedQuestions(Number(cached.maxExtractedQuestions) || 30);
      }
      if (cached.extractedQuestionsUsed !== undefined) {
        setExtractedQuestionsUsed(Number(cached.extractedQuestionsUsed) || 0);
      }
    }
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setActiveTheme(themeId);
    try {
      localStorage.setItem("app_theme_preset", themeId);
      document.cookie = `app_theme_preset=${encodeURIComponent(themeId)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
    if (themeId === "default") {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.backgroundColor = "";
      document.documentElement.style.colorScheme = "";
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
      if (themeId === "dark") {
        document.documentElement.style.backgroundColor = "#0b1120";
        document.documentElement.style.colorScheme = "dark";
      } else {
        document.documentElement.style.backgroundColor = "";
        document.documentElement.style.colorScheme = "";
      }
    }
  };

  useEffect(() => {
    const onSync = (e: Event) => {
      const custom = e as CustomEvent;
      const data = custom.detail;
      if (data && data.authenticated) {
        setCachedSession(data);
        if (data.name) setUserName(data.name);
        if (data.subscriptionType) setSubscriptionType(data.subscriptionType);
        if (data.isTrial !== undefined || data.subscriptionType !== undefined) {
          setIsTrial(Boolean(data.isTrial || data.subscriptionType === "تجربة مجانية"));
        }
        if (data.subscriptionDueDate !== undefined) {
          setSubscriptionDueDate(data.subscriptionDueDate || null);
        }
        if (data.maxExtractedQuestions !== undefined) {
          setMaxExtractedQuestions(Number(data.maxExtractedQuestions) || 30);
        }
        if (data.extractedQuestionsUsed !== undefined) {
          setExtractedQuestionsUsed(Number(data.extractedQuestionsUsed) || 0);
        } else if (data.usage?.extractedQuestionsUsed !== undefined) {
          setExtractedQuestionsUsed(Number(data.usage.extractedQuestionsUsed) || 0);
        }
      }
    };
    window.addEventListener("tenant-session-sync", onSync);
    return () => window.removeEventListener("tenant-session-sync", onSync);
  }, []);

  useEffect(() => {
    if (!isTrial || !subscriptionDueDate) return;
    const tick = () => {
      const diffMs = Math.max(0, new Date(subscriptionDueDate).getTime() - Date.now());
      const totalSec = Math.floor(diffMs / 1000);
      const hrs = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const secs = String(totalSec % 60).padStart(2, "0");
      setTrialCountdown(`${hrs}:${mins}:${secs}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isTrial, subscriptionDueDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(e.target as Node)
      ) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadDirectoryIfNeeded = async (force = false) => {
    if (!force && hasLoadedDirectory && students.length > 0) return;
    setHasLoadedDirectory(true);
    try {
      const ts = Date.now();
      const [stdRes, grpRes] = await Promise.all([
        fetch(`/api/students?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/groups?t=${ts}`, { cache: "no-store" }),
      ]);
      if (stdRes.ok) {
        const stdData = await stdRes.json();
        if (Array.isArray(stdData)) setStudents(stdData);
        else if (Array.isArray(stdData?.students)) setStudents(stdData.students);
      }
      if (grpRes.ok) {
        const grpData = await grpRes.json();
        if (Array.isArray(grpData)) setGroups(grpData);
        else if (Array.isArray(grpData?.groups)) setGroups(grpData.groups);
      }
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    const onMutated = () => {
      setHasLoadedDirectory(false);
      loadDirectoryIfNeeded(true);
    };
    window.addEventListener("tenant-data-mutated", onMutated);
    return () => window.removeEventListener("tenant-data-mutated", onMutated);
  }, []);

  const isValidTenantPage =
    pathname === "/" ||
    pathname === "/groups" ||
    pathname === "/students" ||
    pathname.startsWith("/students/") ||
    pathname === "/qr-printing" ||
    pathname === "/excel-sheets" ||
    pathname === "/exam-builder" ||
    pathname === "/created-exams" ||
    pathname === "/uploaded-files" ||
    pathname === "/images-to-pdf" ||
    pathname === "/my-subscription" ||
    pathname === "/subscription" ||
    pathname === "/how-to-use";

  if (!isValidTenantPage) {
    return null;
  }

  const initialLetter = userName?.trim().charAt(0) || "م";
  const q = query.trim().toLowerCase();

  const matchingStudents = q
    ? students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.groupName || "").toLowerCase().includes(q)
      )
      .slice(0, 5)
    : [];

  const matchingGroups = q
    ? groups
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.academicYear.toLowerCase().includes(q) ||
          g.subject.toLowerCase().includes(q)
      )
      .slice(0, 4)
    : [];

  return (
    <header className="h-20 bg-white px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 border-b border-slate-100/80 z-30 print:hidden">
      {/* Global Rounded Pill Search Bar */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute right-4 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => {
              setIsSearchOpen(true);
              loadDirectoryIfNeeded();
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            placeholder="ابحث عن طالب بالاسم أو الكود، أو مجموعة دراسية..."
            className="w-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-slate-800 placeholder:text-slate-400 text-xs sm:text-sm font-medium rounded-full py-2.5 pr-11 pl-10 border border-transparent focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute left-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Search Dropdown (Animated by GSAP) */}
        {isSearchOpen && q.length > 0 && (
          <div className="gsap-popover absolute top-full mt-2 w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 p-3 space-y-3 z-50 max-h-96 overflow-y-auto">
            {matchingStudents.length === 0 && matchingGroups.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                لا توجد نتائج مطابقة لـ &quot;{query}&quot;
              </div>
            ) : (
              <>
                {matchingStudents.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 px-3 block">
                      الطلاب ({matchingStudents.length})
                    </span>
                    {matchingStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false);
                          setQuery("");
                          router.push(`/students/${s.id}`);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-blue-50/70 text-right transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{s.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {s.academicYear} • {s.groupName || "مجموعة"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {s.code}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {matchingGroups.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 px-3 block">
                      المجموعات الدراسية ({matchingGroups.length})
                    </span>
                    {matchingGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false);
                          setQuery("");
                          router.push(`/students?groupId=${g.id}`);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-slate-100 text-right transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{g.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {g.academicYear} • {g.subject}
                            </p>
                          </div>
                        </div>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Left User Avatar & Theme Selector Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {isTrial && (
          <Link
            href="/my-subscription"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-extrabold transition-colors"
            title="الوقت المتبقي والأسئلة المتبقية في النسخة التجريبية المجانية"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>متبقي:</span>
            <span className="font-mono font-black text-amber-700" dir="ltr">
              {trialCountdown}
            </span>
            <span className="text-amber-300">|</span>
            <span>
              الأسئلة المتبقية:{" "}
              <strong className="font-mono text-amber-800">
                {Math.max(0, maxExtractedQuestions - extractedQuestionsUsed)}/{maxExtractedQuestions}
              </strong>
            </span>
          </Link>
        )}

        <Link
          href="/my-subscription"
          className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full hover:bg-slate-100 transition-colors"
        >
          <div className="hidden md:flex flex-col items-end leading-tight">
            <span className="text-xs font-extrabold text-slate-800 max-w-[160px] truncate">
              {userName}
            </span>
            <span className="text-[10px] font-bold text-blue-600">
              {isTrial || subscriptionType === "تجربة مجانية"
                ? "النسخة المجانية (24 ساعة)"
                : subscriptionType === "معلم"
                ? "باقة معلم"
                : "باقة سنتر"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shadow-sm shadow-blue-600/25">
            {initialLetter}
          </div>
        </Link>

        {/* Orange-circled button converted into Theme & Colors Selector */}
        <div ref={themeMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen((prev) => !prev)}
            className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${isThemeMenuOpen
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            title="تحديد الثيم والألوان"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          {isThemeMenuOpen && (
            <div className="gsap-popover absolute left-0 top-full mt-2 w-68 bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-3.5 space-y-2.5 z-50">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-extrabold text-slate-800">
                    ثيم وألوان النظام
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  تطبيق فوري
                </span>
              </div>

              <div className="space-y-1">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = activeTheme === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        handleSelectTheme(preset.id);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-right transition-all cursor-pointer border ${isSelected
                          ? "bg-blue-50/80 border-blue-600 shadow-2xs"
                          : "bg-transparent hover:bg-slate-50 border-transparent"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-6 h-6 rounded-xl shadow-xs shrink-0 flex items-center justify-center border border-black/10"
                          style={{ backgroundColor: preset.swatch }}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          )}
                        </span>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800 leading-tight">
                            {preset.label}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {preset.subtitle}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-extrabold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                          مفعّل
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
