"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FolderUp,
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
  Plus,
  Database,
  AlertCircle,
  Clock,
} from "lucide-react";

interface UploadedFileItem {
  id: string;
  name: string;
  type: "pdf" | "word" | "image";
  size: string;
  date: string;
}

const fallbackFiles: UploadedFileItem[] = [
  {
    id: "f-1",
    name: "كتاب الأحياء والبيئة - الفصل الثالث.pdf",
    type: "pdf",
    size: "١٤.٢ ميجابايت",
    date: "١٠ أكتوبر ٢٠٢٦",
  },
  {
    id: "f-2",
    name: "مذكرة النحو والصرف - التدريبات الشاملة.docx",
    type: "word",
    size: "٣.٨ ميجابايت",
    date: "٠٨ أكتوبر ٢٠٢٦",
  },
];

export default function UploadedFilesPage() {
  const [files, setFiles] = useState<UploadedFileItem[]>(fallbackFiles);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch from SQLite database on mount
  useEffect(() => {
    fetchFilesFromDb();
  }, []);

  const fetchFilesFromDb = async () => {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (data.success && data.files && data.files.length > 0) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch files from local DB", err);
    }
  };

  // Large file upload progress tracking
  interface UploadProgressState {
    isOpen: boolean;
    fileName: string;
    percent: number;
    speedMb: string;
    remainingSec: number;
    loadedMb: string;
    totalMb: string;
    status: "uploading" | "success" | "error";
  }
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      let fType: "pdf" | "word" | "image" = "pdf";
      if (f.name.endsWith(".docx") || f.name.endsWith(".doc")) fType = "word";
      else if (f.type.startsWith("image/")) fType = "image";

      const mbSize = (f.size / (1024 * 1024)).toFixed(1);
      const newFileItem: UploadedFileItem = {
        id: `f-${Date.now()}-${i}`,
        name: f.name,
        type: fType,
        size: `${mbSize} ميجابايت`,
        date: "اليوم",
      };

      const startTime = Date.now();
      setUploadProgress({
        isOpen: true,
        fileName: f.name,
        percent: 0,
        speedMb: "0.0",
        remainingSec: 0,
        loadedMb: "0.0",
        totalMb: mbSize,
        status: "uploading",
      });

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files", true);
        xhr.setRequestHeader("x-upload-mode", "stream");
        xhr.setRequestHeader("x-file-name", encodeURIComponent(f.name));
        xhr.setRequestHeader("x-file-size", String(f.size));
        xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
            const now = Date.now();
            const elapsedSec = (now - startTime) / 1000;
            const bytesPerSec = elapsedSec > 0 ? event.loaded / elapsedSec : 0;
            const remainingBytes = event.total - event.loaded;
            const remainingSec = bytesPerSec > 0 ? Math.ceil(remainingBytes / bytesPerSec) : 0;

            setUploadProgress({
              isOpen: true,
              fileName: f.name,
              percent,
              speedMb: (bytesPerSec / (1024 * 1024)).toFixed(1),
              remainingSec,
              loadedMb: (event.loaded / (1024 * 1024)).toFixed(1),
              totalMb: mbSize,
              status: "uploading",
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let uploadedItem: UploadedFileItem = newFileItem;
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (parsed?.file) {
                uploadedItem = {
                  ...newFileItem,
                  ...parsed.file,
                };
              }
            } catch {}
            setUploadProgress((prev) => (prev ? { ...prev, percent: 100, remainingSec: 0, status: "success" } : null));
            setFiles((prev) => [uploadedItem, ...prev]);
            setTimeout(() => {
              setUploadProgress(null);
              resolve();
            }, 800);
          } else {
            setUploadProgress((prev) => (prev ? { ...prev, status: "error" } : null));
            setTimeout(() => {
              setUploadProgress(null);
              resolve();
            }, 1500);
          }
        };

        xhr.onerror = () => {
          setUploadProgress((prev) => (prev ? { ...prev, status: "error" } : null));
          setTimeout(() => {
            setUploadProgress(null);
            resolve();
          }, 1500);
        };

        xhr.send(f);
      });
    }

    setSuccessMessage(`تم حفظ ${fileList.length} ملف بنجاح في قاعدة البيانات المحلية (SQLite).`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleDelete = async (id: string) => {
    try {
      const target = files.find((f) => f.id === id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      const nameParam = target?.name ? `&name=${encodeURIComponent(target.name)}` : "";
      await fetch(`/api/files?id=${encodeURIComponent(id)}${nameParam}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800">
            الملفات المرفوعة
          </h1>
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
          onChange={(e) => handleFilesAdded(e.target.files)}
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
              اسحب وأفلت الملفات هنا، أو انقر للاختيار من جهازك
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              يدعم ملفات PDF، ومستندات Word (.docx)، والصور (PNG, JPG) ويحفظها في قاعدة البيانات المحلية
            </p>
          </div>
          <span className="mt-1 text-xs font-semibold text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-xl">
            تصفح الملفات
          </span>
        </div>

        {/* Clean Data Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border-none overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-base">
                المستندات المسجلة محلياً
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
                  <th className="py-3.5 px-4">تاريخ الرفع</th>
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

                        {/* Upload Date Column */}
                        <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{file.date}</span>
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="حذف الملف من قاعدة البيانات"
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
                      لا توجد ملفات تطابق عملية البحث في قاعدة البيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Circular Upload Progress Modal */}
      {uploadProgress && uploadProgress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center border border-slate-200 animate-in zoom-in-95"
            dir="rtl"
          >
            {/* Circular Progress Ring */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-100"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - uploadProgress.percent / 100)}
                  strokeLinecap="round"
                  className={`transition-all duration-200 ${
                    uploadProgress.status === "error"
                      ? "text-red-500"
                      : uploadProgress.percent === 100
                      ? "text-emerald-500"
                      : "text-blue-600"
                  }`}
                  fill="transparent"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {uploadProgress.status === "error" ? (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                ) : uploadProgress.percent === 100 ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-in zoom-in" />
                ) : (
                  <>
                    <span className="text-2xl font-black text-slate-800 font-mono">
                      {uploadProgress.percent}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">مكتمل</span>
                  </>
                )}
              </div>
            </div>

            {/* File Information */}
            <h3 className="font-bold text-sm text-slate-800 truncate max-w-[260px] mb-1">
              {uploadProgress.fileName}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {uploadProgress.loadedMb} ميجابايت من {uploadProgress.totalMb} ميجابايت
            </p>

            {/* Speed & Remaining Time */}
            {uploadProgress.status === "uploading" && (
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 mb-2 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    الوقت المتبقي:
                  </span>
                  <span className="font-bold text-slate-800 font-mono">
                    {uploadProgress.remainingSec > 60
                      ? `${Math.floor(uploadProgress.remainingSec / 60)} دقيقة و ${uploadProgress.remainingSec % 60} ثانية`
                      : `${uploadProgress.remainingSec} ثانية`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">سرعة الرفع:</span>
                  <span className="font-bold text-slate-700 font-mono">
                    {uploadProgress.speedMb} ميجابايت/ثانية
                  </span>
                </div>
              </div>
            )}

            {uploadProgress.status === "success" && (
              <p className="text-xs font-bold text-emerald-600">
                تم رفع وحفظ المستند بنجاح!
              </p>
            )}

            {uploadProgress.status === "error" && (
              <p className="text-xs font-bold text-red-600">
                فشل رفع أو حفظ المستند.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
