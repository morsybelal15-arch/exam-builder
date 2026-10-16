"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  description: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "نظرة عامة",
    items: [
      {
        name: "الرئيسية",
        href: "/",
        icon: Home,
        description: "لوحة التحكم، المسح السريع والإحصائيات",
      },
    ],
  },
  {
    title: "السنتر",
    items: [
      {
        name: "المجموعات",
        href: "/groups",
        icon: Users,
        description: "إدارة الصفوف والمجموعات الدراسية",
      },
      {
        name: "الطلاب",
        href: "/students",
        icon: UserCheck,
        description: "بيانات الطلاب، الحضور، المالية والدرجات",
      },
      {
        name: "طباعة رموز QR",
        href: "/qr-printing",
        icon: QrCode,
        description: "طباعة بطاقات ورموز QR للطلاب",
      },
    ],
  },
  {
    title: "الامتحانات",
    items: [
      {
        name: "منشئ الاختبارات",
        href: "/exam-builder",
        icon: PenTool,
        description: "إعداد وصياغة أسئلة الامتحانات",
      },
      {
        name: "الاختبارات المنشأة",
        href: "/created-exams",
        icon: FileText,
        description: "أرشيف ونماذج الاختبارات السابقة",
      },
      {
        name: "الملفات المرفوعة",
        href: "/uploaded-files",
        icon: FolderUp,
        description: "إدارة المستندات والمراجع",
      },
      {
        name: "تحويل الصور إلى PDF",
        href: "/images-to-pdf",
        icon: ImageIcon,
        description: "دمج وتحويل المستندات المصورة",
      },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      {
        name: "اشتراكي",
        href: "/my-subscription",
        icon: CreditCard,
        description: "تفاصيل الخطة وتاريخ التجديد والحدود",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>("المعلم المشرف");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.name) {
          setUserName(data.name);
        }
      })
      .catch(() => {});
  }, []);

  // Hide sidebar on login, admin, and denied pages
  if (
    pathname === "/login" ||
    pathname.startsWith("/admin") ||
    pathname === "/denied" ||
    pathname.startsWith("/s/") ||
    pathname === "/s"
  ) {
    return null;
  }

  const initialLetter = userName?.trim().charAt(0) || "م";

  return (
    <aside className="w-72 shrink-0 bg-white shadow-sm h-screen overflow-y-auto flex flex-col justify-between select-none z-20 print:hidden border-l border-slate-100">
      <div>
        {/* Header / Brand */}
        <div className="p-6 pb-8 border-b border-slate-100/80">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-800 tracking-tight">
                السنتر
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                نظام إدارة السناتر
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="px-4 py-5 space-y-4">
          {navSections.map((section, sectionIdx) => (
            <div key={section.title} className={sectionIdx > 0 ? "pt-4 border-t border-slate-100" : ""}>
              <div className="text-[11px] font-bold text-slate-400 px-3 mb-2 flex items-center justify-between">
                <span>{section.title}</span>
              </div>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* User / Workspace Footer */}
      <div className="p-4 m-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
        <Link
          href="/my-subscription"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            {initialLetter}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {userName}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              اشتراك نشط
            </p>
          </div>
        </Link>

        {/* Logout Button */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50/80 hover:bg-red-100/80 py-2 px-3 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
