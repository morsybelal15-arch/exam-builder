"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  Calendar,
  HardDrive,
  PenTool,
} from "lucide-react";
import {
  LocalPcFileItem,
  getLocalPcFilesList,
  saveFileToLocalPc,
  deleteLocalPcFile,
  getLocalPcFileById,
  triggerImmediatePcDownload,
} from "@/lib/local-pc-files";

export default function UploadedFilesPage() {
  const [files, setFiles] = useState<LocalPcFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load past files from the tenant's PC (IndexedDB) on mount
  useEffect(() => {
    loadFilesFromLocalPc();
  }, []);

  const loadFilesFromLocalPc = async () => {
    try {
      const localList = await getLocalPcFilesList();
      setFiles(localList);
    } catch (err) {
      console.error("Failed to load files from local PC storage", err);
    }
  };

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const addedItems: LocalPcFileItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      try {
        const savedMeta = await saveFileToLocalPc(f);
        addedItems.push(savedMeta);
      } catch (err) {
        console.error("Failed to save file on local PC:", err);
      }
    }

    await loadFilesFromLocalPc();
    if (addedItems.length > 0) {
      setSuccessMessage(
        `تم ربط وحفظ ${addedItems.length} ملف محلياً على جهازك بنجاح (جاهز للاستخدام الفوري في منشئ الاختبارات بدون تحميل على السيرفر).`
      );
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      await deleteLocalPcFile(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const record = await getLocalPcFileById(id);
      if (record && record.blob) {
        triggerImmediatePcDownload(record.blob, record.name);
      }
    } catch (err) {
      console.error("Failed to download local file:", err);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileBadge = (type: "pdf" | "word" | "image") => {
    switch (type) {
      case "pdf":
        return {
          icon: <FileText className="w-5 h-5 text-red-500" />,
          bg: "bg-red-50 border-red-100",
          text: "مستند PDF",
        };
      case "word":
        return {
          icon: <FileSpreadsheet className="w-5 h-5 text-blue-600" />,
          bg: "bg-blue-50 border-blue-100",
          text: "مستند Word",
        };
      case "image":
        return {
          icon: <ImageIcon className="w-5 h-5 text-emerald-600" />,
          bg: "bg-emerald-50 border-emerald-100",
          text: "صورة وثيقة",
        };
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              الملفات المرفوعة (محلياً على جهازك)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              سجل ملفات الـ PDF والمذكرات التي تم فتحها من جهازك الشخصي لاستخدامها فوراً في منشئ الاختبارات دون استهلاك مساحة السيرفر
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl self-start sm:self-auto">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span>تخزين محلي مباشر على جهازك (Local PC)</span>
          </span>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm shadow-xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            handleFilesAdded(e.target.files);
            e.target.value = "";
          }}
          multiple
          className="hidden"
          accept=".pdf,.docx,.doc,image/*"
        />

        {/* Top Section: Dashed-border Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            handleFilesAdded(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer bg-white shadow-sm flex flex-col items-center justify-center gap-3 select-none ${
            isDraggingOver
              ? "border-blue-600 bg-blue-50/40 scale-[1.005]"
              : "border-slate-300/90 hover:border-blue-500 hover:bg-slate-50/60"
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              اسحب وأفلت ملفات الـ PDF هنا، أو انقر للاختيار من جهازك الشخصي
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              يتم قراءة وتشغيل ملفات PDF والصور مباشرةً من جهازك بسرعة فائقة دون انتظار التحميل على السيرفر
            </p>
          </div>
          <span className="mt-1 text-xs font-semibold text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-xl">
            اختيار ملف من الكمبيوتر
          </span>
        </div>

        {/* Clean Data Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border-none overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-base">
                الملفات السابقة على جهازك
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full">
                {filteredFiles.length} ملف
              </span>
            </div>

            {/* Search filter input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم الملف..."
                className="w-full pr-10 pl-4 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 border border-slate-200/70"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-bold text-slate-500">
                  <th className="py-3.5 px-5">نوع الملف</th>
                  <th className="py-3.5 px-4">اسم الملف</th>
                  <th className="py-3.5 px-4">الحجم</th>
                  <th className="py-3.5 px-4">تاريخ الإضافة</th>
                  <th className="py-3.5 px-5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredFiles.length > 0 ? (
                  filteredFiles.map((file) => {
                    const badge = getFileBadge(file.type as "pdf" | "word" | "image");
                    return (
                      <tr
                        key={file.id}
                        className="hover:bg-slate-50/60 transition-colors group"
                      >
                        {/* File Icon Column */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${badge.bg}`}
                            >
                              {badge.icon}
                            </div>
                            <span className="text-xs text-slate-400 font-medium">
                              {badge.text}
                            </span>
                          </div>
                        </td>

                        {/* File Name Column */}
                        <td className="py-4 px-4 font-semibold text-slate-800">
                          <div className="truncate max-w-xs sm:max-w-md" title={file.name}>
                            {file.name}
                          </div>
                        </td>

                        {/* Size Column */}
                        <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {file.size}
                        </td>

                        {/* Date Column */}
                        <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{file.date}</span>
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/exam-builder?localFile=${encodeURIComponent(file.name)}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                              title="فتح هذا الملف مباشرة في منشئ الاختبارات"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>فتح بمنشئ الاختبارات</span>
                            </Link>

                            <button
                              onClick={() => handleDownload(file.id)}
                              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="تنزيل نسخة على جهازك"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(file.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="إزالة الملف من سجل جهازك"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                      لا توجد ملفات محفوظة في سجل جهازك بعد — اختر ملف PDF من جهازك أو افتحه من داخل منشئ الاختبارات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
