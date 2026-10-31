"use client";

import React, { useState } from "react";
import {
  PlayCircle,
  Home,
  Users,
  UserCheck,
  QrCode,
  FileSpreadsheet,
  PenTool,
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Video,
  Film,
} from "lucide-react";

interface VideoPlaceholderItem {
  id: string;
  title: string;
  subtitle: string;
  durationHint: string;
  highlights: string[];
}

interface GuideSection {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: any;
  badgeColor: string;
  videos: VideoPlaceholderItem[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "dashboard",
    title: "الرئيسية والداشبورد",
    shortTitle: "الرئيسية والداشبورد",
    description:
      "شرح كامل للوحة المتابعة اليومية، إحصائيات الدخل الشهري، أعداد الطلاب، الغياب اليومي، المتأخرين عن الدفع، والبحث الفوري.",
    icon: Home,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    videos: [
      {
        id: "dash-1",
        title: "جولة شاملة في الداشبورد ومتابعة السنتر لحظة بلحظة",
        subtitle: "قراءة مؤشرات الدخل الشهري، الطلاب الفعليين، ونسب الحضور والغياب اليومي",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "متابعة إجمالي التحصيل الشهري والمقارنة بالمستهدف",
          "كشف المتأخرين عن الدفع والغياب اليومي بضغطة واحدة",
          "استخدام شريط البحث الذكي للوصول لأي طالب أو مجموعة فوراً",
        ],
      },
    ],
  },
  {
    id: "groups",
    title: "المجموعات الدراسية",
    shortTitle: "المجموعات",
    description:
      "كيفية إنشاء مجموعات منفصلة لكل صف دراسي، تحديد المواعيد وقيمة الاشتراك الشهري، وإدارة قائمة طلاب كل مجموعة.",
    icon: Users,
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    videos: [
      {
        id: "grp-1",
        title: "إنشاء وإدارة المجموعات الدراسية وتنظيم المواعيد",
        subtitle: "إضافة المجموعات حسب الصفوف الدراسية وربط الطلاب بكل مجموعة بسهولة",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "إنشاء مجموعة جديدة وتحديد الصف الدراسي والمواعيد والمصروفات",
          "استعراض قائمة الطلاب داخل كل مجموعة ونقل الطلاب بين المجموعات",
          "متابعة إحصائيات كل مجموعة بشكل منفصل",
        ],
      },
    ],
  },
  {
    id: "students",
    title: "الطلاب والحسابات",
    shortTitle: "الطلاب والحسابات",
    description:
      "إضافة الطلاب، تسجيل الحضور والغياب والدفع الشهري بالـ QR، رصد درجات الامتحانات بالكاميرا، ومشاركة بروفايل متابعة ولي الأمر.",
    icon: UserCheck,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    videos: [
      {
        id: "std-1",
        title: "إضافة الطلاب وتسجيل الحضور والدفع الشهري بالكاميرا (QR)",
        subtitle: "إدارة ملف الطالب الكامل وحساباته الشهرية وسجل حضوره وغيابه",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "إضافة طالب جديد وتوليد الكود الخاص به تلقائياً",
          "تسجيل الحضور والغياب والدفع الشهري السريع عبر مسح كود الـ QR",
          "إرسال تقارير المتابعة وبروفايل الطالب المباشر لولي الأمر",
        ],
      },
      {
        id: "std-2",
        title: "تسجيل ورصد درجات الامتحانات للطلاب بالكاميرا",
        subtitle: "طريقة رصد الدرجات الفورية وربطها بملف كل طالب وتقارير ولي الأمر",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "فتح الكاميرا وقراءة درجات الطلاب وتسجيلها أوتوماتيك في الكشوف",
          "مراجعة سجل درجات كل طالب على مدار الشهور",
        ],
      },
    ],
  },
  {
    id: "qr-printing",
    title: "طباعة رموز الـ QR",
    shortTitle: "طباعة رموز الـ QR",
    description:
      "توليد وطباعة كروت الـ QR الفورية لأي عدد من الطلاب أو لمجموعة كاملة بتصميم جاهز للطباعة مباشرة.",
    icon: QrCode,
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    videos: [
      {
        id: "qr-1",
        title: "توليد وطباعة كروت الـ QR الفورية لأي عدد من الطلاب",
        subtitle: "تجهيز كروت حضور ودفع الطلاب لمجموعة كاملة أو طلاب محددين بضغطة زر",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "اختيار مجموعة كاملة أو تحديد طلاب معينين لطباعة الكروت",
          "ضبط مقاسات الكروت وتصديرها جاهزة للطباعة الفورية",
        ],
      },
    ],
  },
  {
    id: "excel-sheets",
    title: "تصدير واستيراد Excel",
    shortTitle: "تصدير واستيراد Excel",
    description:
      "كيفية استيراد بيانات الطلاب من شيت إكسيل أو نقل داتا من أي برنامج سابق، وتصدير كشوف الحسابات والدرجات والغياب.",
    icon: FileSpreadsheet,
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    videos: [
      {
        id: "xls-1",
        title: "استيراد وتصدير شيتات الـ Excel والنقل من أي برنامج سابق",
        subtitle: "رفع أسماء وأرقام الطلاب دفعة واحدة وتحميل تقارير السنتر بصيغة Excel",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "رفع شيت إكسيل ببيانات الطلاب والمجموعات في ثوانٍ بدون إدخال يدوي",
          "تصدير كشوف الحضور والغياب والمدفوعات الشهرية والدرجات لملف إكسيل منظم",
        ],
      },
    ],
  },
  {
    id: "exam-builder",
    title: "منشئ الاختبارات",
    shortTitle: "منشئ الاختبارات",
    description:
      "اختيار الأسئلة من PDF أو صور، دعم الأسئلة الاختياري والمقالي والقطعة، إنشاء نماذج متعددة لمنع الغش، العلامة المائية، والطباعة الفورية A4.",
    icon: PenTool,
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    videos: [
      {
        id: "exm-1",
        title: "إنشاء امتحان كامل من ملف PDF أو صورة في دقائق",
        subtitle: "قص واستخراج الأسئلة (اختياري، مقالي، قطعة) بالعربي والإنجليزي وتنسيق الورقة",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "فتح أي مذكرة أو كتاب PDF وتحديد الأسئلة لإضافتها لورقة الامتحان فوراً",
          "إدراج الصور التوضيحية والرسومات داخل السؤال والتحكم في حجم الخط والأعمدة",
          "إضافة ترويسة الامتحان، العلامة المائية باسمك، وشعار السنتر",
        ],
      },
      {
        id: "exm-2",
        title: "توليد نماذج متعددة (أ، ب، ج) لمنع الغش والطباعة الفورية A4",
        subtitle: "تبديل ترتيب الأسئلة أوتوماتيكياً وحفظ الامتحان في الأرشيف أو تحميله PDF",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "إنشاء نموذجين أو 3 نماذج مختلفة الترتيب بضغطة زر واحدة",
          "معاينة وتصدير الامتحان PDF جاهز للطباعة الفورية بمقاس A4",
        ],
      },
    ],
  },
  {
    id: "tools",
    title: "الأدوات (تحويل الصور لـ PDF، الملفات، والثيمات)",
    shortTitle: "الأدوات",
    description:
      "شرح أداة تحويل الصور إلى PDF عالي الدقة، إدارة مكتبة الملفات والاختبارات المنشأة، وتخصيص ألوان وثيمات التطبيق.",
    icon: Wrench,
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    videos: [
      {
        id: "tls-1",
        title: "تحويل الصور إلى PDF، أرشيف الملفات، وتغيير ثيمات ومظهر التطبيق",
        subtitle: "تجميع صور الملازم والامتحانات في ملف PDF واحد وتخصيص ألوان المنصة",
        durationHint: "قريباً • بعد 16 نوفمبر",
        highlights: [
          "دمج وترتيب صور الموبايل أو المذكرات وتحويلها لملف PDF جاهز",
          "إدارة الملفات المرفوعة والرجوع لأي اختبار منشأ لتعديله أو إعادة طباعته",
          "اختيار الثيم المفضل (الأزرق الملكي، البرجاندي، الأخضر الزمردي، البرتقالي، البنفسجي، أو الوضع الليلي)",
        ],
      },
    ],
  },
];

export default function HowToUsePage() {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("ALL");

  const visibleSections =
    selectedSectionId === "ALL"
      ? GUIDE_SECTIONS
      : GUIDE_SECTIONS.filter((s) => s.id === selectedSectionId);

  return (
    <div className="h-full overflow-y-auto bg-[#F4F6FA] p-4 sm:p-8 pb-24" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
        {/* Top Hero Banner */}
        <div className="bg-gradient-to-l from-blue-600 via-blue-700 to-blue-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -left-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-xs border border-white/25 px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white">
                <PlayCircle className="w-4 h-4" />
                <span>دليل الاستخدام والشروحات المصورة</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                كيفية استخدام المنصة خطوة بخطوة
              </h1>
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium">
                تم تجهيز هذا القسم ليضم فيديوهات شرح عملية ومفصلة لكل أداة وجزء داخل التطبيق، لمساعدتك أنت وفريق عملك على تحقيق أقصى استفادة في أقل وقت.
              </p>
            </div>

            {/* Announcement Card for Nov 16 */}
            <div className="bg-white/12 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 shrink-0 lg:max-w-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-black">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>موعد إتاحة الفيديوهات</span>
              </div>
              <p className="text-sm sm:text-base font-black text-white leading-snug">
                ستتوفر جميع فيديوهات الشرح بدايةً من بعد 16 نوفمبر
              </p>
              <p className="text-[11px] text-white/80 leading-relaxed">
                جاري حالياً تصوير ومونتاج الشروحات بأحدث التحديثات لتكون متاحة للمشاهدة المباشرة هنا داخل كل قسم.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Section Filter Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedSectionId("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              selectedSectionId === "ALL"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-700"
            }`}
          >
            كل الأقسام ({GUIDE_SECTIONS.length})
          </button>

          {GUIDE_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = selectedSectionId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{sec.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Sections List */}
        <div className="space-y-8">
          {visibleSections.map((section, idx) => {
            const SectionIcon = section.icon;
            return (
              <section
                key={section.id}
                id={`section-${section.id}`}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                {/* Section Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/20">
                      <SectionIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                          القسم {idx + 1}
                        </span>
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          {section.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl whitespace-nowrap self-start sm:self-center">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>يتوفر بعد 16 نوفمبر</span>
                  </span>
                </div>

                {/* Section Video Placeholders */}
                <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {section.videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="rounded-2xl border border-slate-200/90 bg-slate-50/50 overflow-hidden flex flex-col justify-between"
                    >
                      {/* Empty Video Frame Placeholder (16:9) */}
                      <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center select-none group">
                        <div className="absolute inset-3 rounded-xl border border-dashed border-slate-600/70 pointer-events-none" />
                        <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-3 shadow-lg group-hover:scale-105 transition-transform">
                          <Film className="w-7 h-7 text-amber-400" />
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-black mb-2">
                          <Video className="w-3.5 h-3.5" />
                          <span>فيديو الشرح قيد التجهيز — متاح بعد 16 نوفمبر</span>
                        </span>
                        <p className="text-xs sm:text-sm font-extrabold text-white max-w-md px-2">
                          {vid.title}
                        </p>
                      </div>

                      {/* Video Details & Covered Points */}
                      <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between bg-white">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-slate-900">{vid.title}</h3>
                            <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                              {vid.durationHint}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{vid.subtitle}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            <span>ما سيتم شرحه في هذا الفيديو:</span>
                          </span>
                          <ul className="space-y-1">
                            {vid.highlights.map((pt, i) => (
                              <li
                                key={i}
                                className="text-xs text-slate-600 font-medium flex items-start gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

