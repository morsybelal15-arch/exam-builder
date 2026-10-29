"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  Check,
  User,
  Award,
  ChevronDown,
  Search,
} from "lucide-react";
import { Student } from "@/lib/types/management";

interface CameraAiGradeModalProps {
  groupId: string;
  examRecordId: string;
  examName: string;
  totalScore: number;
  students: Student[];
  onClose: () => void;
  onGradeRecorded: () => void;
}

export default function CameraAiGradeModal({
  groupId,
  examRecordId,
  examName,
  totalScore,
  students,
  onClose,
  onGradeRecorded,
}: CameraAiGradeModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Analysis Result
  const [ocrResult, setOcrResult] = useState<{
    detectedStudentName: string;
    matchedStudentId: string | null;
    score: number;
    notes: string;
  } | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [editableScore, setEditableScore] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [recordedCount, setRecordedCount] = useState<number>(0);

  // Start Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("الكاميرا غير مدعومة في هذا المتصفح");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setHasCamera(true);
        }
      } catch (err: any) {
        console.warn("Camera init error:", err);
        setHasCamera(false);
      }
    };

    if (!capturedImage) {
      startCamera();
    }

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [capturedImage]);

  // Capture frame from video
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(base64);
    analyzeImageWithAi(base64);
  };

  // Upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setCapturedImage(base64);
        analyzeImageWithAi(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const analyzeImageWithAi = async (base64: string) => {
    try {
      setIsAnalyzing(true);
      setErrorMsg("");
      setOcrResult(null);

      const res = await fetch("/api/ai-grade-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          groupId,
          examRecordId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "تعذر قراءة ورقة الامتحان بالذكاء الاصطناعي");
      }

      const data = json.data;
      setOcrResult({
        detectedStudentName: data.detectedStudentName || "غير محدد",
        matchedStudentId: data.matchedStudentId || null,
        score: data.score !== undefined ? data.score : 0,
        notes: data.notes || "",
      });

      // Pre-select matched student or first match
      if (data.matchedStudentId) {
        setSelectedStudentId(data.matchedStudentId);
        const match = students.find((s) => s.id === data.matchedStudentId);
        setStudentSearchQuery(match?.name || data.detectedStudentName || "");
      } else {
        setSelectedStudentId(students[0]?.id || "");
        setStudentSearchQuery(data.detectedStudentName || students[0]?.name || "");
      }

      setEditableScore(data.score !== undefined ? String(data.score) : "0");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء فحص ورقة الامتحان");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveGrade = async (continueNext = false) => {
    if (!selectedStudentId || editableScore === "") {
      setErrorMsg("يرجى اختيار الطالب وتحديد الدرجة");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg("");

      const res = await fetch("/api/exam-grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveGrade",
          examRecordId,
          studentIdOrCode: selectedStudentId,
          score: Number(editableScore),
          notes: ocrResult?.notes || "رصد تلقائي عبر كاميرا الذكاء الاصطناعي",
          method: "camera_ai",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل حفظ الدرجة");
      }

      setRecordedCount((prev) => prev + 1);
      onGradeRecorded();

      if (continueNext) {
        // Reset for next paper in rapid grading mode
        setCapturedImage(null);
        setOcrResult(null);
        setEditableScore("");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ الدرجة");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setErrorMsg("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-800 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  تصحيح ورصد الدرجات بالذكاء الاصطناعي
                </h3>
                <span className="text-[10px] bg-blue-600/30 text-blue-400 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                  Gemini Vision OCR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {examName} • الدرجة العظمى: <span className="font-mono text-white">{totalScore}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Result Area */}
        <div className="relative aspect-video sm:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
          {!capturedImage ? (
            <>
              {hasCamera ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Full View Area Framing - Corner Accents */}
                  <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 border-t-3 border-r-3 border-blue-500 rounded-tr-xl" />
                      <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-blue-500/30 text-center">
                        <span className="text-[11px] font-bold text-white">
                          المساحة كاملة جاهزة لالتقاط ورقة الامتحان
                        </span>
                      </div>
                      <div className="w-10 h-10 border-t-3 border-l-3 border-blue-500 rounded-tl-xl" />
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="w-10 h-10 border-b-3 border-r-3 border-blue-500 rounded-br-xl" />
                      <span className="text-[10px] text-slate-300 bg-black/50 px-3 py-1 rounded-full">
                        تأكد من وضوح اسم الطالب والدرجة
                      </span>
                      <div className="w-10 h-10 border-b-3 border-l-3 border-blue-500 rounded-bl-xl" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center space-y-3">
                  <Camera className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">
                    الكاميرا غير متاحة
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع صورة الورقة</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
              <img
                src={capturedImage}
                alt="Captured Exam"
                className="w-full h-full object-contain"
              />

              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-white">
                    جاري التعرف على اسم الطالب والدرجة بالذكاء الاصطناعي...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls / OCR Analysis Results */}
        <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!capturedImage ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>رفع صورة من الجهاز</span>
              </button>

              <button
                type="button"
                onClick={handleCapture}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>التقاط وقراءة الدرجة</span>
              </button>
            </div>
          ) : ocrResult ? (
            <div className="space-y-4 animate-in fade-in">
              {/* OCR Detection Box */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                {/* Detected Name & Score Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Editable Student Search & Matching */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>اسم الطالب (المكتشف / تعديل يدوي):</span>
                      </span>
                      {selectedStudentId && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
                          تم الربط بنجاح ✓
                        </span>
                      )}
                    </label>

                    {/* Search / Edit input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => {
                          setStudentSearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                          // Auto match if exact match found
                          const found = students.find(
                            (s) => s.name.trim() === e.target.value.trim()
                          );
                          if (found) setSelectedStudentId(found.id);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="اكتب اسم أو كود الطالب للبحث..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Quick Suggestion Chips from Group */}
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 block mb-1">
                        اقتراحات سريعة قريبة من الاسم:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                        {students
                          .filter((s) => {
                            const query = (studentSearchQuery || ocrResult.detectedStudentName || "").toLowerCase().trim();
                            if (!query) return true;
                            const words = query.split(/\s+/).filter(Boolean);
                            return words.some((w) => s.name.toLowerCase().includes(w)) || s.name.toLowerCase().includes(query) || s.code.includes(query);
                          })
                          .slice(0, 4)
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setStudentSearchQuery(s.name);
                                setIsDropdownOpen(false);
                              }}
                              className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                                selectedStudentId === s.id
                                  ? "bg-blue-600 text-white border-blue-400 shadow-xs"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                              }`}
                            >
                              {s.name} ({s.code})
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Mobile-Friendly Search Dropdown */}
                    {isDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
                        {students
                          .filter(
                            (s) =>
                              s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                              s.code.toLowerCase().includes(studentSearchQuery.toLowerCase())
                          )
                          .map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setStudentSearchQuery(s.name);
                                setIsDropdownOpen(false);
                              }}
                              className={`p-2.5 text-xs flex items-center justify-between cursor-pointer hover:bg-blue-600/20 transition-colors ${
                                selectedStudentId === s.id ? "bg-blue-600/30 text-blue-200" : "text-slate-200"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{s.name}</span>
                                <span className="text-[10px] text-slate-400">
                                  {s.academicYear} {s.groupName ? `• ${s.groupName}` : ""}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                                {s.code}
                              </span>
                            </div>
                          ))}
                        {students.filter(
                          (s) =>
                            s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                            s.code.toLowerCase().includes(studentSearchQuery.toLowerCase())
                        ).length === 0 && (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            لا توجد نتائج مطابقة للطالب
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Editable Degree / Score */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-blue-400" />
                      <span>الدرجة المرصودة (من {totalScore}):</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        max={totalScore}
                        min={0}
                        value={editableScore}
                        onChange={(e) => setEditableScore(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-400 font-mono shrink-0">
                        / {totalScore}
                      </span>
                    </div>

                    {ocrResult.notes && (
                      <p className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        {ocrResult.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة التقاط</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveGrade(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
                    title="حفظ درجة الطالب الحالي وفتح الكاميرا فوراً للورقة التالية"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>حفظ والتقاط التالي</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveGrade(false)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <span>{isSaving ? "جاري الحفظ..." : "تأكيد وحفظ"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
              >
                إلغاء والتقاط مجدداً
              </button>
            </div>
          )}
        </div>

        {/* Footer Session Counter */}
        {recordedCount > 0 && (
          <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 text-[11px] text-emerald-400 flex items-center justify-between">
            <span>تم رصد درجات {recordedCount} طالب في هذه الجلسة بنجاح ✓</span>
            <span className="text-slate-500 font-mono">وضع الرصد السريع نشط</span>
          </div>
        )}
      </div>
    </div>
  );
}
