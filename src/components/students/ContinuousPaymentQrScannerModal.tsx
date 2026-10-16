"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  User,
  Calendar,
  RefreshCw,
  Search,
  Sparkles,
  Banknote,
} from "lucide-react";
import { Student } from "@/lib/types/management";

interface ContinuousPaymentQrScannerModalProps {
  groupId: string;
  month: string;
  students: Student[];
  onClose: () => void;
  onPaymentRecorded: () => void;
}

export default function ContinuousPaymentQrScannerModal({
  groupId,
  month,
  students,
  onClose,
  onPaymentRecorded,
}: ContinuousPaymentQrScannerModalProps) {
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedHistory, setScannedHistory] = useState<
    {
      studentId: string;
      name: string;
      academicYear: string;
      paidAmount: number;
      isFull: boolean;
      time: string;
    }[]
  >([]);
  const [lastScannedStudent, setLastScannedStudent] = useState<{
    id: string;
    name: string;
    academicYear: string;
    groupName?: string;
    monthlyFee: number;
    isFull: boolean;
    paidAmount: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isCooldownRef = useRef(false);

  // Initialize Camera Stream & Barcode Detection
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
          startScannerLoop();
        }
      } catch (err: any) {
        console.warn("QR Payment Camera Init Error:", err);
        setHasCamera(false);
        setCameraError("تعذر تشغيل الكاميرا، يمكنك استخدام الإدخال اليدوي أو قارئ الباركود أدناه");
      }
    };

    startCamera();

    const startScannerLoop = () => {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (!BarcodeDetectorClass) return;

      const detector = new BarcodeDetectorClass({
        formats: ["qr_code", "code_128", "code_39", "ean_13"],
      });

      const checkFrame = async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const codeValue = barcodes[0].rawValue;
              if (codeValue && !isCooldownRef.current) {
                handleScannedCode(codeValue);
              }
            }
          } catch (e) {
            // Frame detection error, ignore
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
  }, []);

  const handleScannedCode = async (decodedText: string, customAmount?: number, isPartial = false) => {
    if (isCooldownRef.current && customAmount === undefined) return;
    isCooldownRef.current = true;
    setIsProcessing(true);

    try {
      // Parse QR code (supports raw token or full url https://.../s/TOKEN)
      let clean = decodedText.trim();
      if (clean.includes("/s/")) {
        clean = clean.split("/s/").pop()?.split("?")[0]?.trim() || clean;
      }

      // Look up student
      const student = students.find(
        (s) =>
          s.id === clean ||
          s.code === clean ||
          (s as any).qrCodeToken === clean ||
          s.id.toLowerCase() === clean.toLowerCase() ||
          s.code.toLowerCase() === clean.toLowerCase()
      );

      if (!student) {
        setCameraError(`رمز غير مسجل في هذه المجموعة (${clean})`);
        setTimeout(() => {
          setCameraError("");
          isCooldownRef.current = false;
        }, 1800);
        return;
      }

      const totalFee = student.monthlyFee || 250;
      const amountToPay = customAmount !== undefined ? customAmount : totalFee;
      const isFullPayment = !isPartial && amountToPay >= totalFee;

      // Submit payment automatically to backend
      const res = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          groupId,
          month,
          status: "paid",
          paidAmount: amountToPay,
          totalAmount: totalFee,
          notes: isFullPayment ? "سداد آلي كامل عبر ماسح الباركود" : "سداد جزئي عبر ماسح الباركود",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل تسجيل الدفع");
      }

      const timeStr = new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setLastScannedStudent({
        id: student.id,
        name: student.name,
        academicYear: student.academicYear,
        groupName: student.groupName,
        monthlyFee: totalFee,
        isFull: isFullPayment,
        paidAmount: amountToPay,
      });

      setScannedHistory((prev) => [
        {
          studentId: student.id,
          name: student.name,
          academicYear: student.academicYear,
          paidAmount: amountToPay,
          isFull: isFullPayment,
          time: timeStr,
        },
        ...prev.slice(0, 15),
      ]);

      setCameraError("");
      onPaymentRecorded();
    } catch (err: any) {
      setCameraError(err.message || "حدث خطأ أثناء تسجيل الدفع");
    } finally {
      setIsProcessing(false);
      // Wait 1.5 seconds then re-enable continuous scanning for next card
      setTimeout(() => {
        isCooldownRef.current = false;
      }, 1500);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedCode(manualCode);
    setManualCode("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>مسح الباركود والسداد التلقائي المستمر</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </h3>
              <p className="text-xs text-slate-400">
                شهر: <strong className="text-emerald-400">{month}</strong> • يستمر المسح تلقائياً حتى الخروج
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Scanner Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video sm:aspect-4/3 flex items-center justify-center border border-slate-800">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {!hasCamera && (
              <div className="p-6 text-center space-y-2">
                <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  {cameraError || "الكاميرا غير متاحة، يمكنك استخدام الإدخال السريع بالباركود أدناه"}
                </p>
              </div>
            )}

            {/* Continuous Scanner Overlay Guide */}
            {hasCamera && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
                <div className="bg-emerald-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                  ⚡ المسح مستمر - وجّه كارت الطالب للكاميرا
                </div>
                <div className="w-48 h-48 border-2 border-dashed border-emerald-400/80 rounded-2xl flex items-center justify-center bg-emerald-500/5">
                  <span className="text-[10px] text-emerald-200 font-bold bg-black/60 px-2 py-1 rounded-full">
                    مربع مسح QR / Barcode
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 bg-black/60 px-3 py-0.5 rounded-full">
                  الافتراضي: تسجيل سداد كامل تلقائياً فور المسح
                </div>
              </div>
            )}
          </div>

          {/* Active / Last Scanned Student Card */}
          {lastScannedStudent && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-600/40 space-y-2 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black text-white">
                      {lastScannedStudent.name}
                    </h4>
                    <p className="text-[11px] text-emerald-300/80">
                      السنة الدراسية: {lastScannedStudent.academicYear}
                    </p>
                  </div>
                </div>

                <div className="text-left font-mono">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 inline-block shadow-sm">
                    تم السداد: {lastScannedStudent.paidAmount} ج.م ✓
                  </span>
                  <span className="block text-[10px] text-emerald-400 mt-0.5">
                    {lastScannedStudent.isFull ? "(سداد كامل - الافتراضي)" : "(سداد جزئي)"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message if any */}
          {cameraError && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Manual Input Barcode Gun / Search */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="أو اكتب/امسح كود الطالب هنا يدويًا ثم اضغط Enter..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              تسجيل
            </button>
          </form>

          {/* Scan Session History List */}
          {scannedHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block">
                الطلاب المسجل سدادهم في هذه الجلسة ({scannedHistory.length}):
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto divide-y divide-slate-800/60">
                {scannedHistory.map((item, idx) => (
                  <div
                    key={`${item.studentId}-${idx}`}
                    className="pt-1.5 pb-1 flex items-center justify-between text-xs text-slate-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold font-mono">
                        {scannedHistory.length - idx}
                      </span>
                      <span className="font-bold text-white">{item.name}</span>
                      <span className="text-[10px] text-slate-500">({item.academicYear})</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-emerald-400 font-bold">{item.paidAmount} ج.م</span>
                      <span className="text-[10px] text-slate-500">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            تم تسجيل: <strong className="text-emerald-400">{scannedHistory.length}</strong> طالب
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق وخروج
          </button>
        </div>
      </div>
    </div>
  );
}
