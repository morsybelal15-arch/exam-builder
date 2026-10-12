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
} from "lucide-react";

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
  const [exams, setExams] = useState<ExamCardItem[]>(fallbackExams);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load exams from local SQLite database
  useEffect(() => {
    fetchExamsFromDb();
  }, []);

  const fetchExamsFromDb = async () => {
    try {
      const res = await fetch("/api/exams");
      const data = await res.json();
      if (data.success && data.exams && data.exams.length > 0) {
        setExams(data.exams);
      }
    } catch (err) {
      console.error("Failed to fetch exams from local DB", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setExams((prev) => prev.filter((e) => e.id !== id));
      await fetch(`/api/exams?id=${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (title: string) => {
    window.print();
  };

  const handleDownload = (title: string) => {
    alert(`جاري تجهيز وتحميل ملف PDF للاختبار: ${title}`);
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
                                      className={`flex items-center gap-1 px-1 py-0.5 rounded truncate border ${
                                        isCorrect
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
                      onClick={() => handlePrint(exam.title)}
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
    </div>
  );
}
