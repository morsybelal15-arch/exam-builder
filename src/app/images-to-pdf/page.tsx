"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  ImagePlus,
  FileDown,
  Trash2,
  ArrowRight,
  ArrowLeft,
  GripVertical,
  CheckCircle2,
  Loader2,
  Eye,
  FileText,
  RotateCw,
  Plus,
} from "lucide-react";

interface QueuedImage {
  id: string;
  name: string;
  previewUrl: string;
  size: string;
}

const initialQueuedImages: QueuedImage[] = [
  {
    id: "img-1",
    name: "ورقة_الأسئلة_صفحة_١.jpg",
    previewUrl: "/sample-textbook.svg",
    size: "١.٢ ميجابايت",
  },
  {
    id: "img-2",
    name: "ورقة_الأسئلة_صفحة_٢.jpg",
    previewUrl: "/sample-textbook.svg",
    size: "٩٨٠ كيلوبايت",
  },
  {
    id: "img-3",
    name: "نموذج_الإجابة_المعتمد.jpg",
    previewUrl: "/sample-textbook.svg",
    size: "١.٥ ميجابايت",
  },
];

export default function ImagesToPdfPage() {
  const [images, setImages] = useState<QueuedImage[]>(initialQueuedImages);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [pdfName, setPdfName] = useState<string>("مستند_أوراق_الاختبار.pdf");
  const [savedFile, setSavedFile] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop image reordering states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleImagesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newImages: QueuedImage[] = Array.from(fileList).map((f, i) => {
      const mbSize = (f.size / (1024 * 1024)).toFixed(1);
      return {
        id: `img-${Date.now()}-${i}`,
        name: f.name,
        previewUrl: URL.createObjectURL(f),
        size: `${mbSize} ميجابايت`,
      };
    });

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleMove = (index: number, direction: "prev" | "next") => {
    const targetIndex = direction === "prev" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const updated = [...images];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    setImages(updated);
  };

  const handleDelete = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleOpenNamingModal = () => {
    if (images.length === 0 || isGenerating) return;
    setIsNameModalOpen(true);
  };

  const handleConfirmCreateAndSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (images.length === 0 || isGenerating) return;

    setIsNameModalOpen(false);
    setIsGenerating(true);
    setIsSuccess(false);

    const trimmed = pdfName.trim() || "مستند_أوراق_الاختبار";
    const finalName = trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;

    // Process simulation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newFileItem = {
      id: `f-${Date.now()}`,
      name: finalName,
      type: "pdf" as const,
      size: `${(images.length * 0.9).toFixed(1)} ميجابايت`,
      date: "اليوم",
      filepath: images[0]?.previewUrl || "/sample-textbook.svg",
    };

    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFileItem),
      });
    } catch (err) {
      console.error("Failed to save PDF to uploaded files", err);
    }

    setSavedFile(newFileItem);
    setIsGenerating(false);
    setIsSuccess(true);
  };

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              تحويل الصور إلى PDF
            </h1>
          </div>
        </div>

        {/* Success Banner */}
        {isSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">تم إنشاء ملف PDF وحفظه في قسم الملفات المرفوعة بنجاح!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  تم دمج {images.length} صفحات وحفظ الملف باسم <strong className="font-bold text-slate-900">«{savedFile?.name || pdfName}»</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/uploaded-files"
                className="inline-flex items-center justify-center gap-1 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <span>قسم الملفات المرفوعة</span>
              </Link>
              <Link
                href="/exam-builder"
                className="inline-flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>منشئ الاختبارات</span>
              </Link>
              <button
                onClick={() => alert(`جاري تحميل الملف: ${savedFile?.name || pdfName}`)}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>تحميل</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden Multiple File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleImagesSelected(e.target.files)}
          multiple
          className="hidden"
          accept="image/*"
        />

        {/* Drag-and-Drop Zone specifically for multiple images */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            handleImagesSelected(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer bg-white shadow-sm flex flex-col items-center justify-center gap-3 select-none ${
            isDraggingOver
              ? "border-blue-600 bg-blue-50/40 scale-[1.005]"
              : "border-slate-300/90 hover:border-blue-500 hover:bg-slate-50/60"
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            <ImagePlus className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              اسحب وأفلت صور الاختبارات هنا، أو تصفح جهازك
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              يمكنك تحديد صور متعددة معاً (JPG, PNG, WebP) لدمجها تلقائياً
            </p>
          </div>
          <span className="mt-1 text-xs font-semibold text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-xl">
            اختيار صور متعددة
          </span>
        </div>

        {/* Sortable Grid of Queued Images */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border-none space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-base">
                الصور المجهزة للدمج والترتيب
              </span>
              <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full">
                {images.length} صفحات
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              استخدم الأسهم أو اسحب لترتيب الصفحات حسب تسلسل الاختبار
            </p>
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2">
              {images.map((img, index) => {
                const isFirst = index === 0;
                const isLast = index === images.length - 1;
                const isBeingDragged = draggedIdx === index;
                const isDragTarget = dragOverIdx === index;

                return (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => setDraggedIdx(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIdx(index);
                    }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={() => {
                      if (draggedIdx === null || draggedIdx === index) return;
                      const updated = [...images];
                      const [dragged] = updated.splice(draggedIdx, 1);
                      updated.splice(index, 0, dragged);
                      setImages(updated);
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`group relative bg-slate-50 rounded-2xl border p-3 flex flex-col justify-between transition-all select-none ${
                      isBeingDragged ? "opacity-30 border-blue-600 border-dashed" : "border-slate-200/80 hover:shadow-md"
                    } ${isDragTarget ? "border-blue-600 bg-blue-50/50" : ""}`}
                  >
                    {/* Page Number Badge & Delete Button */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold bg-white text-blue-700 border border-blue-100 shadow-2xs px-2.5 py-1 rounded-xl">
                        صفحة {index + 1}
                      </span>
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="حذف هذه الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Image Preview Thumbnail */}
                    <div className="w-full aspect-[1/1.4] bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-2xs relative flex items-center justify-center p-2 mb-3">
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>

                    {/* Card Footer: Name, Size, & Reorder Controls */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={img.name}>
                        {img.name}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{img.size}</span>
                        {/* Move Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMove(index, "prev")}
                            disabled={isFirst}
                            className="p-1 rounded bg-white text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:pointer-events-none shadow-2xs cursor-pointer"
                            title="تقديم الصفحة"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMove(index, "next")}
                            disabled={isLast}
                            className="p-1 rounded bg-white text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:pointer-events-none shadow-2xs cursor-pointer"
                            title="تأخير الصفحة"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              لم تقم بإدراج أي صور بعد. قم بسحب وإسقاط الصور في الصندوق أعلاه.
            </div>
          )}

          {/* Prominent Primary Blue Button at Bottom: 'إنشاء ملف PDF' */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              سيتم تجميع الصفحات بنفس الترتيب المرئي الظاهر أعلاه وضغطها بجودة عالية.
            </div>

            <button
              onClick={handleOpenNamingModal}
              disabled={images.length === 0 || isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-8 py-3.5 rounded-2xl font-bold text-sm sm:text-base shadow-md shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري معالجة وتوليد PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  <span>إنشاء ملف PDF ({images.length} صفحات)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* PDF Naming Modal */}
      {isNameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleConfirmCreateAndSave}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-4 text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">تسمية ملف الـ PDF</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حدد اسماً للمستند ليتم حفظه تلقائياً في قسم الملفات المرفوعة
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستند:
              </label>
              <input
                type="text"
                value={pdfName}
                onChange={(e) => setPdfName(e.target.value)}
                placeholder="أدخل اسم الملف..."
                autoFocus
                required
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setIsNameModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                إنشاء وحفظ في الملفات المرفوعة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
