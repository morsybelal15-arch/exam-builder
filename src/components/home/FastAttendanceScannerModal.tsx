"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Volume2,
  VolumeX,
  RefreshCw,
  Users,
  Search,
  Sparkles,
} from "lucide-react";
import { Group } from "@/lib/types/management";

interface FastAttendanceScannerModalProps {
  groups: Group[];
  todayDate: string;
  onClose: () => void;
  onAttendanceRecorded: (record: {
    studentName: string;
    studentCode: string;
    groupName: string;
    time: string;
  }) => void;
}

export default function FastAttendanceScannerModal({
  groups,
  todayDate,
  onClose,
  onAttendanceRecorded,
}: FastAttendanceScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("auto");
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>("");
  const [scannedList, setScannedList] = useState<
    Array<{ name: string; code: string; groupName: string; time: string }>
  >([]);
  const [lastScanned, setLastScanned] = useState<{
    name: string;
    groupName: string;
    time: string;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const handleCodeDetectedRef = useRef<(code: string) => void>(() => {});

  // Play audio beep using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio might be blocked by autoplay policies
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
        setCameraError(err.message || "تعذر فتح الكاميرا. يرجى التأكد من صلاحيات الكاميرا.");
      }
    };

    startCamera();

    // BarcodeDetector loop if supported
    const startQrLoop = () => {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (!BarcodeDetectorClass) {
        return;
      }

      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });

      const checkFrame = async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const codeValue = barcodes[0].rawValue;
              if (codeValue) {
                handleCodeDetectedRef.current(codeValue);
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
  }, []);

  const handleCodeDetected = async (decodedText: string) => {
    if (isProcessing) return;
    setErrorMessage("");

    const token = decodedText.includes("/s/")
      ? decodedText.split("/s/").pop()?.split("?")[0]?.trim() || decodedText.trim()
      : decodedText.trim();

    if (!token) return;

    // Check if recently scanned in last 5 scans
    if (scannedList.some((s) => s.code === token || s.code === decodedText.trim())) {
      return;
    }

    try {
      setIsProcessing(true);

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: token,
          groupId: selectedGroupId !== "auto" ? selectedGroupId : undefined,
          date: todayDate,
          status: "attended",
          method: "camera_qr",
        }),
      });

      const data = await res.json();
      if (data.success && data.student) {
        playBeep();
        const rec = {
          name: data.student.name,
          code: data.student.code,
          groupName: data.group?.name || data.student.groupName || "مجموعة عامة",
          time:
            data.time ||
            new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        };
        setLastScanned({ name: rec.name, groupName: rec.groupName, time: rec.time });
        setScannedList((prev) => [rec, ...prev]);
        onAttendanceRecorded({
          studentName: rec.name,
          studentCode: rec.code,
          groupName: rec.groupName,
          time: rec.time,
        });
      } else {
        setErrorMessage(data.error || "لم يتم العثور على الطالب أو كود غير صحيح");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء تسجيل الحضور");
    } finally {
      setTimeout(() => setIsProcessing(false), 1200);
    }
  };
  handleCodeDetectedRef.current = handleCodeDetected;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleCodeDetected(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-800 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                تسجيل الحضور السريع بالـ QR
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  فوري
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                امسح بطاقة الطالب 5×5 سم أو أدخل الكود لتسجيل الحضور فوراً
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
          {/* Target Group Selector */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="font-semibold">المجموعة المستهدفة:</span>
            </div>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="auto">⚡ كشف تلقائي للمجموعة (حسب كود الطالب)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.academicYear})
                </option>
              ))}
            </select>
          </div>

          {/* Scanner View Area */}
          <div className="relative aspect-video sm:aspect-16/9 bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {hasCamera ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Scanning Frame / HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-blue-500/80 rounded-2xl relative shadow-lg">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                    {/* Laser Scan line animation */}
                    <div className="absolute left-2 right-2 h-0.5 bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-pulse top-1/2 -translate-y-1/2" />
                  </div>

                  <p className="mt-4 text-xs font-medium text-slate-300 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700">
                    ضع رمز QR داخل الإطار للتسجيل الفوري
                  </p>
                </div>
              </>
            ) : (
              <div className="p-6 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  {cameraError || "الكاميرا غير متوفرة"}
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  يمكنك استخدام قارئ الباركود اليدوي أو إدخال كود الطالب يدوياً أدناه.
                </p>
              </div>
            )}

            {/* Processing state indicator */}
            {isProcessing && (
              <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-xs flex items-center justify-center">
                <div className="bg-slate-900/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 border border-blue-500/50 shadow-xl">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-xs font-bold">جاري تسجيل الحضور...</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Last Scanned Student Banner */}
          {lastScanned && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-700/80 text-emerald-200 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-100">{lastScanned.name}</h4>
                  <p className="text-[11px] text-emerald-300">
                    {lastScanned.groupName} • تم تسجيل الحضور الساعة {lastScanned.time}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/30 text-emerald-200">
                حاضر ✓
              </span>
            </div>
          )}

          {/* Manual Code Entry Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="أدخل كود الطالب يدوياً (مثال: ST-1001) أو امسح بجهاز الباركود..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 pr-10"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
            >
              تسجيل حضور
            </button>
          </form>

          {/* Scanned in this session list */}
          {scannedList.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>تم تسجيلهم في هذه الجلسة ({scannedList.length} طالب):</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {scannedList.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-[10px]">{st.code}</span>
                      <span className="font-semibold text-slate-200">{st.name}</span>
                      <span className="text-slate-400 text-[10px]">({st.groupName})</span>
                    </div>
                    <span className="text-slate-400 text-[11px] font-mono">{st.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
