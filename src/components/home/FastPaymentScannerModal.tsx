"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Volume2,
  VolumeX,
  RefreshCw,
  DollarSign,
  Search,
  Check,
  Calendar,
  Wallet,
} from "lucide-react";
import { Student, Group, FinancialRecord, PaymentStatus } from "@/lib/types/management";

interface FastPaymentScannerModalProps {
  currentMonth: string;
  onClose: () => void;
  onPaymentRecorded: (record: {
    studentName: string;
    studentCode: string;
    groupName: string;
    month: string;
    paidAmount: number;
    status: PaymentStatus;
  }) => void;
}

export default function FastPaymentScannerModal({
  currentMonth,
  onClose,
  onPaymentRecorded,
}: FastPaymentScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const handleCodeLookupRef = useRef<(code: string) => void>(() => { });

  // Loaded student payment info for confirmation
  const [pendingStudent, setPendingStudent] = useState<{
    student: Student;
    group?: Group;
    financial: FinancialRecord;
    month: string;
  } | null>(null);

  const [customAmount, setCustomAmount] = useState<string>("");
  const [isPartialMode, setIsPartialMode] = useState<boolean>(false);

  // Play audio beep
  const playBeep = (freq: number = 880) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {
      // Audio might be blocked by autoplay
    }
  };

  // Start Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("المتصفح لا يدعم الوصول المباشر للكاميرا");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setHasCamera(true);
          startQrLoop();
        }
      } catch (err: any) {
        console.warn("Camera init error:", err);
        setHasCamera(false);
        setCameraError(err.message || "تعذر فتح الكاميرا.");
      }
    };

    startCamera();

    const startQrLoop = () => {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (!BarcodeDetectorClass) return;

      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });

      const checkFrame = async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const codeValue = barcodes[0].rawValue;
              if (codeValue) {
                handleCodeLookupRef.current(codeValue);
              }
            }
          } catch (e) {
            // Ignore frame decode exceptions
          }
        }
        animationFrameId = requestAnimationFrame(checkFrame);
      };

      animationFrameId = requestAnimationFrame(checkFrame);
    };

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedMonth]);

  // Lookup student payment status
  const handleCodeLookup = async (decodedText: string) => {
    if (isProcessing) return;
    setErrorMessage("");
    setSuccessMessage("");

    const token = decodedText.includes("/s/")
      ? decodedText.split("/s/").pop()?.split("?")[0]?.trim() || decodedText.trim()
      : decodedText.trim();

    if (!token) return;

    try {
      setIsProcessing(true);
      const res = await fetch(
        `/api/fast-payment?code=${encodeURIComponent(token)}&month=${encodeURIComponent(selectedMonth)}`
      );
      const data = await res.json();

      if (data.success && data.student) {
        playBeep(650);
        setPendingStudent({
          student: data.student,
          group: data.group,
          financial: data.financial,
          month: data.month,
        });
        setCustomAmount(String(data.financial.paidAmount || ""));
        setIsPartialMode(false);
      } else {
        setErrorMessage(data.error || "لم يتم العثور على طالب بهذا الكود");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء فحص كود الطالب");
    } finally {
      setTimeout(() => setIsProcessing(false), 800);
    }
  };
  handleCodeLookupRef.current = handleCodeLookup;

  // Submit payment
  const handleRecordPayment = async (status: PaymentStatus, amount?: number) => {
    if (!pendingStudent || isProcessing) return;
    setErrorMessage("");

    try {
      setIsProcessing(true);
      const res = await fetch("/api/fast-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: pendingStudent.student.id,
          month: selectedMonth,
          status,
          paidAmount: amount !== undefined ? amount : pendingStudent.student.monthlyFee || 250,
        }),
      });

      const data = await res.json();
      if (data.success && data.financial) {
        playBeep(1046); // High C chime
        setSuccessMessage(
          `تم تسجيل سداد مصروفات (${data.financial.paidAmount} ج.م) للطالب ${pendingStudent.student.name} بنجاح!`
        );

        onPaymentRecorded({
          studentName: pendingStudent.student.name,
          studentCode: pendingStudent.student.code,
          groupName: pendingStudent.group?.name || pendingStudent.student.groupName || "",
          month: selectedMonth,
          paidAmount: data.financial.paidAmount,
          status: data.financial.status,
        });

        // Reset student after 2 seconds or keep for review
        setTimeout(() => {
          setPendingStudent(null);
          setSuccessMessage("");
        }, 2500);
      } else {
        setErrorMessage(data.error || "فشل تسجيل المصروفات");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ في الشبكة");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleCodeLookup(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-800 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                تسجيل المصروفات السريع بالـ QR
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  مالية
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                امسح بطاقة الطالب لتحصيل الاشتراك الشهري بنقرة واحدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Month Selector Bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">شهر التحصيل:</span>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPendingStudent(null);
              }}
              className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
            />
          </div>

          {/* If Pending Student Loaded for Payment confirmation */}
          {pendingStudent ? (
            <div className="p-5 bg-slate-950/90 border border-emerald-500/40 rounded-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300">
                    {pendingStudent.student.code}
                  </span>
                  <h4 className="text-lg font-bold text-white mt-1">
                    {pendingStudent.student.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {pendingStudent.student.academicYear} • {pendingStudent.group?.name || pendingStudent.student.groupName}
                  </p>
                </div>

                <div className="text-left">
                  <span className="text-xs text-slate-400 block">قيمة الاشتراك الشهري</span>
                  <span className="text-xl font-black text-emerald-400">
                    {pendingStudent.student.monthlyFee || 250} ج.م
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  حالة شهر ({selectedMonth}):
                </span>
                {pendingStudent.financial.paidAmount > 0 &&
                  pendingStudent.financial.paidAmount <
                  (pendingStudent.financial.totalAmount || pendingStudent.student.monthlyFee || 250) ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    مدفوع جزئياً ({pendingStudent.financial.paidAmount} من {pendingStudent.student.monthlyFee || 250} ج.م)
                  </span>
                ) : pendingStudent.financial.status === "paid" &&
                  pendingStudent.financial.paidAmount >=
                  (pendingStudent.financial.totalAmount || pendingStudent.student.monthlyFee || 250) ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    مدفوع بالكامل ({pendingStudent.financial.paidAmount} ج.م)
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30">
                    غير مدفوع (مطلوب {pendingStudent.student.monthlyFee || 250} ج.م)
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {!isPartialMode ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() =>
                        handleRecordPayment("paid", pendingStudent.student.monthlyFee || 250)
                      }
                      disabled={isProcessing}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      تسجيل سداد كامل ({pendingStudent.student.monthlyFee || 250} ج.م)
                    </button>

                    <button
                      onClick={() => setIsPartialMode(true)}
                      disabled={isProcessing}
                      className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                    >
                      <Wallet className="w-4 h-4 text-amber-400" />
                      سداد جزئي
                    </button>

                    <button
                      onClick={() => setPendingStudent(null)}
                      className="py-3 px-3 text-slate-400 hover:text-white rounded-xl text-xs transition-colors hover:bg-slate-800 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs text-slate-300 font-semibold block">
                      أدخل المبلغ المسدد (ج.م):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="المبلغ المدفوع"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        onClick={() =>
                          handleRecordPayment("paid", Number(customAmount) || 0)
                        }
                        disabled={!customAmount || isProcessing}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        حفظ السداد
                      </button>
                      <button
                        onClick={() => setIsPartialMode(false)}
                        className="px-3 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        رجوع
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Camera Scanner View Area */
            <div className="relative aspect-video sm:aspect-16/9 bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {hasCamera ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* HUD Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-500/80 rounded-2xl relative shadow-lg">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                      <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse top-1/2 -translate-y-1/2" />
                    </div>

                    <p className="mt-4 text-xs font-medium text-slate-300 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700">
                      وجه الكاميرا نحو بطاقة الطالب للتحقق من المصروفات
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    {cameraError || "الكاميرا غير متوفرة"}
                  </p>
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex items-center justify-center">
                  <div className="bg-slate-900/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 border border-emerald-500/50 shadow-xl">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span className="text-xs font-bold">جاري فحص الحساب...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Notification */}
          {successMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Manual Code Search Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="أدخل كود الطالب يدوياً (مثال: ST-1001) أو امسح بالجهاز..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500 pr-10 font-mono"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
            >
              بحث وتحصيل
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
