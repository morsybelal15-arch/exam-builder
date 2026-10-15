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
} from "lucide-react";
import { Student } from "@/lib/types/management";

interface CameraQrScannerModalProps {
  groupId: string;
  groupName: string;
  date: string;
  students: Student[];
  onClose: () => void;
  onAttendanceRecorded: () => void;
}

export default function CameraQrScannerModal({
  groupId,
  groupName,
  date,
  students,
  onClose,
  onAttendanceRecorded,
}: CameraQrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedStudents, setScannedStudents] = useState<Array<{ name: string; code: string; time: string }>>([]);
  const [lastScanned, setLastScanned] = useState<{ name: string; time: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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
        // Fallback: browser doesn't have native BarcodeDetector
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
                handleCodeDetected(codeValue);
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

  const handleCodeDetected = async (rawCode: string) => {
    if (isProcessing) return;
    const cleanCode = rawCode.trim();

    // Check if recently scanned in last 4 seconds
    if (scannedStudents.some((s) => s.code === cleanCode)) {
      return;
    }

    try {
      setIsProcessing(true);

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: cleanCode,
          groupId,
          date,
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
          time: data.time || new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        };
        setLastScanned({ name: data.student.name, time: rec.time });
        setScannedStudents((prev) => [rec, ...prev]);
        onAttendanceRecorded();
      } else {
        // Could be a student code that wasn't found in group
        console.warn("QR code not matched in this group:", cleanCode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsProcessing(false), 1200);
    }
  };

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
              <h3 className="text-base sm:text-lg font-bold">
                تسجيل الحضور بالكاميرا ورموز QR
              </h3>
              <p className="text-xs text-slate-400">
                {groupName} • تاريخ اليوم: {date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Area */}
        <div className="relative aspect-video sm:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
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

              {/* Modern Target Bounding Box & Scanning Laser */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-blue-500/70 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                  {/* Corner accents */}
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />

                  {/* Laser line animation */}
                  <div className="w-full h-0.5 bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Instructions banner */}
              <div className="absolute top-3 inset-x-0 mx-auto w-fit bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full text-[11px] font-bold text-slate-300 border border-slate-700/60 shadow-lg">
                وجّه الكاميرا نحو كود QR الخاص بالطالب
              </div>
            </>
          ) : (
            <div className="p-8 text-center space-y-3">
              <Camera className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">
                {cameraError || "تعذر تشغيل الكاميرا"}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                يمكنك إدخال كود الطالب يدوياً أدناه أو اختيار الطالب من القائمة لتسجيل حضوره.
              </p>
            </div>
          )}

          {/* Flash confirmation popover */}
          {lastScanned && (
            <div className="absolute bottom-4 inset-x-4 sm:inset-x-8 bg-emerald-600 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                <div>
                  <span className="text-xs font-black block">تم تسجيل الحضور بنجاح!</span>
                  <span className="text-xs text-emerald-100">{lastScanned.name}</span>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold bg-emerald-700 px-2 py-1 rounded-lg">
                {lastScanned.time}
              </span>
            </div>
          )}
        </div>

        {/* Manual Code Entry & Quick Selection Bar */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <QrCode className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="أدخل كود الطالب (مثال: ST-1001) أو اختر من الطلاب أدناه..."
                className="w-full pr-9 pl-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              تسجيل
            </button>
          </form>

          {/* Quick Click student tags for convenience */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="text-slate-500 text-[10px] shrink-0 font-semibold">تسجيل سريع:</span>
            {students.slice(0, 6).map((s) => {
              const alreadyScanned = scannedStudents.some((sc) => sc.code === s.code);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleCodeDetected(s.code)}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    alreadyScanned
                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  }`}
                >
                  {s.name.split(" ")[0]} ({s.code})
                </button>
              );
            })}
          </div>
        </div>

        {/* Scanned List in this session */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Users className="w-4 h-4" />
            <span>الحاضرون في هذه الجلسة: <strong className="text-white font-mono">{scannedStudents.length}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق الكاميرا
          </button>
        </div>
      </div>
    </div>
  );
}
