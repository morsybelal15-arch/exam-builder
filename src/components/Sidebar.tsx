"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenTool, FolderUp, Image as ImageIcon, FileText, GraduationCap } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: typeof PenTool;
  description: string;
}

const navItems: NavItem[] = [
  {
    name: "منشئ الاختبارات",
    href: "/exam-builder",
    icon: PenTool,
    description: "إعداد وصياغة أسئلة الامتحانات",
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
  {
    name: "الاختبارات المنشأة",
    href: "/created-exams",
    icon: FileText,
    description: "أرشيف ونماذج الاختبارات السابقة",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 bg-white shadow-sm h-screen overflow-y-auto flex flex-col justify-between select-none z-20 print:hidden">
      <div>
        {/* Header / Brand */}
        <div className="p-6 pb-8 border-b border-slate-100/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-800 tracking-tight">
                منصة الاختبارات
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة وبناء النماذج التعليمية
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="px-4 py-6">
          <div className="text-xs font-semibold text-slate-400 px-3 mb-3">
            القائمة الرئيسية
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href === "/exam-builder" && pathname === "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
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
      </div>

      {/* User / Workspace Footer */}
      <div className="p-4 m-4 rounded-2xl bg-slate-50/80 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            م
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              المعلم المشرف
            </p>
            <p className="text-xs text-slate-400 truncate">
              مساحة العمل التعليمية
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
