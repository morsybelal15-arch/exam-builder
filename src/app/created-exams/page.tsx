"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Printer,
  Download,
  Edit3,
  Calendar,
  Layers,
  Award,
  CheckCircle2,
  Trash2,
  Shuffle,
  X,
  ExternalLink,
} from "lucide-react";
import {
  getCachedPageData,
  setCachedPageData,
  notifyTenantDataMutated,
} from "@/lib/client-session-cache";

function sanitizeFormattedText(raw?: string): string {
  if (!raw) return "";
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  s = s.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u class="underline underline-offset-2 decoration-1.5 decoration-slate-900 font-bold">$1</u>');
  s = s.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<strong class="font-bold">$1</strong>');
  s = s.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong class="font-bold">$1</strong>');
  s = s.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<em class="italic">$1</em>');
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
  s = s.replace(/\b_([^_]+)_\b/g, '<u class="underline underline-offset-2 decoration-1.5 decoration-slate-900 font-bold">$1</u>');
  return s;
}

interface ExamCardItem {
  id: string;
  title: string;
  paper_title?: string;
  paperTitle?: string;
  exam_code?: string;
  examCode?: string;
  subject: string;
  grade: string;
  date_created?: string;
  dateCreated?: string;
  questions_count?: number;
  questionsCount?: number;
  total_points?: number;
  totalPoints?: number;
  models?: any;
  _fullLoaded?: boolean;
  questions?: Array<{
    id: string;
    type?: string;
    text: string;
    options?: string[];
    correctOptionIndex?: number;
    points?: number;
    imageUrl?: string;
  }>;
}

const fallbackExams: ExamCardItem[] = [
  {
    id: "exam-1",
    title: "اختبار مادة العلوم - الفصل الدراسي الأول",
    paper_title: "اختبار مادة العلوم - الفصل الدراسي الأول",
    exam_code: "BEEQ",
    subject: "العلوم والبيئة",
    grade: "الصف الثالث الثانوي",
    dateCreated: "١٠ أكتوبر ٢٠٢٦",
    questionsCount: 2,
    totalPoints: 20,
    questions: [
      {
        id: "q-1",
        text: "عند ترسيب 10 جرام من العنصر A تبعاً للمعادلة (A=63.5) A⁺² + 2e⁻ ────> A يلزم كمية كهربية قدرها",
        options: ["0.315 F", "30393 F", "0.675 C", "15196 C"],
        correctOptionIndex: 0,
        points: 2,
      },
      {
        id: "q-2",
        text: "صدأ الحديد هو:",
        options: ["هيدروكسيد حديد II", "أكسيد حديد II", "أكسيد حديد III", "أكسدة للحديد"],
        correctOptionIndex: 2,
        points: 2,
      },
    ],
  },
  {
    id: "exam-2",
    title: "امتحان الرياضيات الموحد - الجبر والهندسة",
    paper_title: "امتحان الرياضيات الموحد - الجبر والهندسة الفراغية",
    exam_code: "MATH",
    subject: "الرياضيات",
    grade: "الصف الثاني الثانوي",
    dateCreated: "٠٧ أكتوبر ٢٠٢٦",
    questionsCount: 2,
    totalPoints: 30,
    questions: [
      {
        id: "q-m1",
        text: "مجموعة حل المعادلة س² - ٥س + ٦ = ٠ في ح هي:",
        options: ["{٢، ٣}", "{-٢، -٣}", "{١، ٦}", "{٠، ٥}"],
        correctOptionIndex: 0,
        points: 3,
      },
      {
        id: "q-m2",
        text: "قياس الزاوية بين مستقيمين متعامدين يساوي:",
        options: ["٤٥°", "٩٠°", "١٨٠°", "٦٠°"],
        correctOptionIndex: 1,
        points: 2,
      },
    ],
  },
];

export default function CreatedExamsPage() {
  const [exams, setExams] = useState<ExamCardItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [printModalExam, setPrintModalExam] = useState<ExamCardItem | null>(null);
  const [selectedPrintModel, setSelectedPrintModel] = useState<"ALL" | "A" | "B" | "C">("ALL");

  // Load exams from local SQLite database with 0ms client cache hydration
  useEffect(() => {
    const cached = getCachedPageData<ExamCardItem[]>("created_exams");
    if (cached) {
      setExams(cached);
      setIsLoading(false);
    }
    fetchExamsFromDb();

    const onSync = () => {
      fetchExamsFromDb();
    };
    window.addEventListener("tenant-data-mutated", onSync);
    window.addEventListener("focus", onSync);
    return () => {
      window.removeEventListener("tenant-data-mutated", onSync);
      window.removeEventListener("focus", onSync);
    };
  }, []);

  const fetchExamsFromDb = async () => {
    try {
      const res = await fetch(`/api/exams?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.exams)) {
        setExams(data.exams);
        setCachedPageData("created_exams", data.exams);
      }
    } catch (err) {
      console.error("Failed to fetch exams from local DB", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setExams((prev) => {
        const next = prev.filter((e) => e.id !== id);
        setCachedPageData("created_exams", next);
        return next;
      });
      await fetch(`/api/exams?id=${id}`, { method: "DELETE" });
      notifyTenantDataMutated("created_exams");
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintClick = async (exam: ExamCardItem) => {
    let targetExam = exam;
    if (!exam._fullLoaded) {
      try {
        const res = await fetch(`/api/exams?id=${encodeURIComponent(exam.id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success && data.exam) {
          targetExam = { ...exam, ...data.exam, _fullLoaded: true };
          setExams((prev) => prev.map((e) => (e.id === exam.id ? targetExam : e)));
        }
      } catch (err) {
        console.error("Failed to load full exam for print:", err);
      }
    }

    setPrintModalExam(targetExam);
    if (
      targetExam.models &&
      (targetExam.models.modelCount > 1 || targetExam.models.models?.B)
    ) {
      setSelectedPrintModel("ALL");
    } else {
      setSelectedPrintModel("A");
      setTimeout(() => {
        window.print();
      }, 250);
    }
  };

  const executePrint = (modelKey: "ALL" | "A" | "B" | "C") => {
    setSelectedPrintModel(modelKey);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleDownload = (title: string) => {
    alert(`جاري تجهيز وتحميل ملف PDF للاختبار: ${title}`);
  };

  const getSheetsForPrint = (exam: ExamCardItem, modelKey: "ALL" | "A" | "B" | "C") => {
    const sheets: Array<{ modelKey: string; modelBadge: string; questions: any[] }> = [];
    const modelsData = exam.models;

    if (modelsData && modelsData.models) {
      if (modelKey === "ALL") {
        if (modelsData.models.A) {
          sheets.push({
            modelKey: "A",
            modelBadge: "نموذج (أ)",
            questions: modelsData.models.A.questions || exam.questions || [],
          });
        }
        if (modelsData.models.B) {
          sheets.push({
            modelKey: "B",
            modelBadge: "نموذج (ب)",
            questions: modelsData.models.B.questions || [],
          });
        }
        if (modelsData.models.C) {
          sheets.push({
            modelKey: "C",
            modelBadge: "نموذج (ج)",
            questions: modelsData.models.C.questions || [],
          });
        }
      } else {
        const targetModel = modelsData.models[modelKey];
        if (targetModel) {
          const badge =
            modelKey === "A" ? "نموذج (أ)" : modelKey === "B" ? "نموذج (ب)" : "نموذج (ج)";
          sheets.push({
            modelKey,
            modelBadge: badge,
            questions: targetModel.questions || [],
          });
        }
      }
    } else {
      sheets.push({
        modelKey: "A",
        modelBadge: "",
        questions: exam.questions || [],
      });
    }

    return sheets;
  };

  const filteredExams = exams.filter((exam) => {
    return exam.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              الاختبارات المنشأة
            </h1>
          </div>
          <Link
            href="/exam-builder?new=true"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-medium shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>إنشاء اختبار جديد</span>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 items-center border-none">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث في عناوين الاختبارات..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 border border-slate-200/70"
            />
          </div>
        </div>

        {/* Portfolio-Style Grid of Cards */}
        {filteredExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between border border-slate-100 hover:border-slate-200"
              >
                <div>
                  {/* Real A4 Paper Preview Thumbnail */}
                  <div className="w-full aspect-[1/1.414] bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between select-none group-hover:border-blue-400 group-hover:shadow-sm transition-all mb-4 text-slate-800">
                    {/* Real Header Box */}
                    <div className="border border-slate-800 rounded-lg p-2 mb-2 bg-slate-50/50">
                      <div className="flex items-center justify-between gap-1.5 text-[7px] leading-tight">
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-slate-900 truncate flex items-center gap-1">
                            <span className="text-[6px] text-slate-500 font-normal shrink-0">عنوان الامتحان:</span>
                            <span className="truncate">{exam.paper_title || exam.paperTitle || exam.title}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-[6px] text-slate-500">
                            <span className="shrink-0">اسم الطالب:</span>
                            <div className="flex-1 border-b border-dotted border-slate-400 h-1"></div>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <div className="border border-slate-700 rounded px-1.5 py-0.5 text-[6.5px] font-mono font-bold bg-white text-slate-800">
                            {exam.exam_code || exam.examCode || "BEEQ"}
                          </div>
                          <div className="border border-slate-700 rounded px-1.5 py-0.5 text-[6.5px] font-bold bg-slate-100 text-slate-800">
                            {exam.total_points ?? exam.totalPoints ?? 20} / ....
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Real Questions Preview Content */}
                    <div className="flex-1 overflow-hidden space-y-2 min-h-0 py-0.5">
                      {Array.isArray(exam.questions) && exam.questions.length > 0 ? (
                        exam.questions.slice(0, 3).map((q: any, idx: number) => (
                          <div key={q.id || idx} className="text-[6.5px] leading-tight border-b border-slate-100 pb-1.5">
                            <div className="flex items-start justify-between gap-1 font-bold text-slate-900">
                              <span className="line-clamp-2 flex-1">
                                س{idx + 1}: {q.text?.replace(/^س\d+[\s:.-]*/, "") || "نص السؤال"}
                              </span>
                              <span className="text-[5.5px] text-blue-600 font-bold shrink-0">
                                [{q.points || 1} د]
                              </span>
                            </div>
                            {/* Real Options snippet */}
                            {Array.isArray(q.options) && q.options.length > 0 && (
                              <div className="grid grid-cols-2 gap-1 mt-1 text-[5.5px] text-slate-600">
                                {q.options.slice(0, 4).map((opt: string, optIdx: number) => {
                                  const letters = ["أ", "ب", "ج", "د"];
                                  const isCorrect = q.correctOptionIndex === optIdx;
                                  return (
                                    <div
                                      key={optIdx}
                                      className={`flex items-center gap-1 px-1 py-0.5 rounded truncate border ${isCorrect
                                          ? "bg-blue-50/80 border-blue-200 text-blue-900 font-semibold"
                                          : "bg-slate-50 border-slate-100"
                                        }`}
                                    >
                                      <span className="text-[5px] text-slate-400 font-mono">({letters[optIdx] || optIdx + 1})</span>
                                      <span className="truncate">{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-[7px] text-slate-400">
                          لا توجد أسئلة مسجلة
                        </div>
                      )}
                    </div>

                    {/* Real Footer */}
                    <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between items-center text-[5.5px] text-slate-400">
                      <span>انتهت الأسئلة (إجمالي: {exam.questions_count ?? exam.questions?.length ?? 0} سؤال)</span>
                      <span>صفحة ١ من ١</span>
                    </div>

                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors pointer-events-none rounded-xl" />
                  </div>

                  {/* Multi-Model Badge if available */}
                  {exam.models && (exam.models.modelCount > 1 || exam.models.models?.B) && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-2xs">
                        <Shuffle className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {exam.models.modelCount === 3 || exam.models.models?.C
                            ? "٣ نماذج (أ - ب - ج)"
                            : "نموذجين (أ - ب)"}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Exam Title */}
                  <h3 className="font-bold text-base text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors" title={exam.title}>
                    {exam.title}
                  </h3>

                  {/* Date Created */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>تاريخ الإنشاء: {exam.date_created || exam.dateCreated || "١٠ أكتوبر ٢٠٢٦"}</span>
                  </div>
                </div>

                {/* Action Buttons: 'تعديل', 'تحميل PDF', 'طباعة' */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Link
                      href={`/exam-builder?id=${exam.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="فتح وتعديل أسئلة الاختبار"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </Link>

                    <button
                      onClick={() => handleDownload(exam.title)}
                      className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      title="تحميل ملف PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handlePrintClick(exam)}
                      className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      title="طباعة الاختبار مباشرة"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(exam.id)}
                    className="p-2 rounded-xl text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="حذف الاختبار من قاعدة البيانات المحلية"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">
              لا توجد اختبارات تطابق معايير البحث الحالية
            </p>
            <p className="text-xs text-slate-400 mt-1">
              جرب تغيير كلمات البحث أو اختر مادة دراسية أخرى.
            </p>
          </div>
        )}
      </div>

      {/* Multi-Model Print Selection Modal */}
      {printModalExam && printModalExam.models && (printModalExam.models.modelCount > 1 || printModalExam.models.models?.B) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 no-print animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-100 text-right space-y-5" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Shuffle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">طباعة نماذج الاختبار</h3>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{printModalExam.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalExam(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              يحتوي هذا الاختبار على نماذج متعددة لمنع الغش بترتيبات أسئلة مختلفة. اختر طباعة جميع النماذج معاً في أمر طباعة واحد أو طباعة نموذج محدد:
            </p>

            {/* Print Options */}
            <div className="space-y-2.5">
              {/* Print All Models (Primary) */}
              <button
                type="button"
                onClick={() => executePrint("ALL")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold transition-all shadow-md hover:shadow-lg cursor-pointer group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold">طباعة جميع النماذج معاً</div>
                    <div className="text-[11px] text-slate-300 font-normal">
                      {printModalExam.models?.modelCount === 3 ? "طباعة النماذج (أ - ب - ج) متتالية" : "طباعة النموذجين (أ - ب) متتاليين"}
                    </div>
                  </div>
                </div>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-400/30 font-bold">
                  موصى به
                </span>
              </button>

              {/* Individual Model Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => executePrint("A")}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-900 font-bold text-xs transition-colors cursor-pointer"
                >
                  <span className="font-extrabold text-sm mb-0.5">نموذج (أ)</span>
                  <span className="text-[10px] text-blue-600 font-normal">الترتيب الأصلي</span>
                </button>

                <button
                  type="button"
                  onClick={() => executePrint("B")}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-900 font-bold text-xs transition-colors cursor-pointer"
                >
                  <span className="font-extrabold text-sm mb-0.5">نموذج (ب)</span>
                  <span className="text-[10px] text-indigo-600 font-normal">ترتيب متبادل</span>
                </button>

                {(printModalExam.models?.modelCount === 3 || printModalExam.models?.models?.C) && (
                  <button
                    type="button"
                    onClick={() => executePrint("C")}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-900 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <span className="font-extrabold text-sm mb-0.5">نموذج (ج)</span>
                    <span className="text-[10px] text-purple-600 font-normal">ترتيب عشوائي</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer Links */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
              <Link
                href={`/exam-builder?id=${printModalExam.id}`}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold hover:underline"
              >
                <span>فتح وتعديل النماذج في منشئ الاختبارات</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setPrintModalExam(null)}
                className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Sheets rendering sequentially for Print Preview */}
      {printModalExam && (
        <div className="hidden print:block print:w-full print:m-0 print:p-0 a4-print-container">
          {getSheetsForPrint(printModalExam, selectedPrintModel).map((sheet, sIdx) => (
            <div
              key={`created-print-${sheet.modelKey}-${sIdx}`}
              className="a4-page-sheet"
              dir="rtl"
            >
              {/* Main Content */}
              <div className="main-paper-content">
                {/* Header Box */}
                <div className="border-2 border-slate-800 rounded-xl p-2.5 mb-2 bg-white exam-header-box">
                  <div className="flex items-stretch justify-between gap-3">
                    <div className="flex-1 flex flex-col justify-between gap-1.5 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900 whitespace-nowrap">عنوان الامتحان :</span>
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {printModalExam.paper_title || printModalExam.paperTitle || printModalExam.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900 whitespace-nowrap">اسم الطالب :</span>
                        <div className="flex-1 border-b-2 border-dotted border-slate-400 h-3.5 mr-1" />
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col justify-between items-end gap-1.5 min-w-[140px]">
                      {sheet.modelBadge && (
                        <div className="w-full flex items-center justify-center bg-white text-black rounded-lg py-1 px-2 border-2 border-black">
                          <span className="font-black text-xs">{sheet.modelBadge}</span>
                        </div>
                      )}
                      <div className="w-full flex items-center justify-between gap-2 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                        <span className="text-[10px] font-bold text-slate-700">كود الامتحان :</span>
                        <span className="font-mono font-extrabold text-xs">
                          {printModalExam.exam_code || printModalExam.examCode || "EXAM"}
                        </span>
                      </div>
                      <div className="w-full flex items-center justify-between gap-1.5 bg-white border-2 border-slate-800 rounded px-2 py-0.5">
                        <span className="text-xs font-extrabold text-slate-900">الدرجة :</span>
                        <span className="font-extrabold text-xs text-slate-900">
                          ..... / {printModalExam.total_points ?? printModalExam.totalPoints ?? 20}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Questions */}
                <div className="questions-container">
                  {sheet.questions.map((q: any, qIdx: number) => (
                    <div key={q.id || qIdx} className="question-card">
                      <div className="flex items-start gap-1.5 font-bold text-slate-900 text-xs">
                        <span className="font-extrabold text-blue-950 shrink-0">س{qIdx + 1}:</span>
                        <p
                          className="flex-1 leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeFormattedText(q.text?.replace(/^(\s*(س\s*\d+|Q\s*\d+|\d+)[\s:.\-\)]+)/i, "").trim() || q.text),
                          }}
                        />
                      </div>
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-1.5 text-xs text-slate-800">
                          {q.options.map((opt: string, optIdx: number) => {
                            const letters = ["أ", "ب", "ج", "د"];
                            return (
                              <div key={optIdx} className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {letters[optIdx] || optIdx + 1}
                                </span>
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeFormattedText(opt),
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="page-footer">
                <span className="text-[10px] text-slate-500">- انتهت الأسئلة -</span>
                <span className="text-[10px] text-slate-500 font-mono">- 1 -</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
