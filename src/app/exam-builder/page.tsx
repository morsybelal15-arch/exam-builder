"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Upload,
  Bold,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Minus,
  Plus,
  PlusCircle,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  PenTool,
  Loader2,
  CheckCircle2,
  RotateCcw,
  RotateCw,
  GripVertical,
  Type,
  Save,
  X,
  ListChecks,
  Key,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Printer,
  Eye,
  EyeOff,
  Download,
  Highlighter,
  Pen,
  Eraser,
  Move,
  Check,
  FileUp,
  Sliders,
  Layers,
  Sparkles,
  Droplet,
  ImagePlus,
  Search,
  AlertCircle,
  Shuffle,
  BookOpen,
  Clock,
} from "lucide-react";
import GeminiKeyModal from "@/components/GeminiKeyModal";
import ModelGenerationModal from "@/components/ModelGenerationModal";
import {
  ExamModelsData,
  generateExamModels,
  reshuffleExamModels,
  updateQuestionNumberPrefix,
} from "@/lib/multi-model-exam";
import {
  getLocalPcFilesList,
  saveFileToLocalPc,
  getLocalPcFileById,
  getLocalPcFileByName,
} from "@/lib/local-pc-files";

const loadPdfJs = (): Promise<any> => {
  if (typeof window === "undefined") return Promise.reject("SSR");
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      resolve(pdfjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PEN_CURSOR_URL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M19 3a2.121 2.121 0 0 1 3 3L7 21l-4 1 1-4L19 3z' fill='%23ffffff' stroke='%230f172a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M15 7l3 3' stroke='%232563eb' stroke-width='1.8'/%3E%3Cpath d='M3 22l1-4 3 3-4 1z' fill='%232563eb'/%3E%3Ccircle cx='2' cy='22' r='1.2' fill='%23ef4444'/%3E%3C/svg%3E") 2 22, crosshair`;

interface QuestionStyle {
  fontSize: number;
  isBold: boolean;
  textAlign: "right" | "center" | "left";
}

export interface ExamQuestionItem {
  id: string;
  type: "choice" | "trueFalse" | "essay" | "passage";
  text: string;
  options: string[];
  correctOptionIndex?: number;
  points: number;
  isExtractedByOcr?: boolean;
  engineUsed?: "gemini" | "local";
  imageUrl?: string;
  imageWidth?: number; // percentage (25..100)
  imageAlign?: "right" | "center" | "left";
  // Enhanced properties for English & rich multi-subject exams
  optionsLayout?: "grid" | "vertical";
  answerLinesCount?: number;
  passageText?: string;
  passageTitle?: string;
  subType?: "passage" | "translation" | "writing" | "story" | "regular";
}

function sanitizeFormattedText(raw?: string): string {
  if (!raw) return "";
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Restore allowed safe formatting tags with clean standard exam styling:
  s = s.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u class="underline underline-offset-2 decoration-1.5 decoration-slate-900 font-bold">$1</u>');
  s = s.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<strong class="font-bold">$1</strong>');
  s = s.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong class="font-bold">$1</strong>');
  s = s.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<em class="italic">$1</em>');
  // Support markdown **word** or _word_
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
  s = s.replace(/\b_([^_]+)_\b/g, '<u class="underline underline-offset-2 decoration-1.5 decoration-slate-900 font-bold">$1</u>');
  return s;
}
const sanitizePassageHtml = sanitizeFormattedText;

interface PageSlot {
  pageNumber: number;
  questionIndices: number[];
}

export interface FreeCanvasItem {
  id: string;
  url: string;
  pageNumber: number;
  x: number; // in pixels
  y: number; // in pixels
  width: number;
}

export interface DrawStroke {
  id: string;
  pageNumber: number;
  points: { x: number; y: number }[];
  color: string;
  size: number;
  isHighlighter: boolean;
}

export interface UploadedFileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  filepath?: string;
}

interface HistorySnapshot {
  questions: ExamQuestionItem[];
  freeImages: FreeCanvasItem[];
  strokes: DrawStroke[];
  watermarkImage?: string | null;
  archiveExamName?: string;
  paperTitle?: string;
  examCode?: string;
  maxScore?: number;
}

function getSvgPathFromPoints(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// ============================================================================
// Smart Viewer Freeze / Resume Cache (3 Hours TTL)
// Keeps open PDF/Image, rendered pages, active page (e.g. Page 30), zoom, and
// exact scroll position alive when navigating across app sections or previewing
// ============================================================================
const VIEWER_FREEZE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

interface FrozenViewerCache {
  selectedFile: string | null;
  imageSrc: string | null;
  pdfDoc: any | null;
  pdfTotalPages: number;
  pdfCurrentPage: number;
  activePdfCropPage: number;
  pdfPageAspectRatio: number;
  pdfPagesCache: Record<number, string>;
  fileZoom: number;
  scrollTop: number;
  scrollLeft: number;
  updatedAt: number;
}

let frozenViewerCache: FrozenViewerCache | null = null;

function getValidFrozenViewerCache(): FrozenViewerCache | null {
  if (!frozenViewerCache) return null;
  if (Date.now() - frozenViewerCache.updatedAt > VIEWER_FREEZE_TTL_MS) {
    frozenViewerCache = null;
    return null;
  }
  return frozenViewerCache;
}

export default function ExamBuilderPage() {
  const initialFrozen = getValidFrozenViewerCache();

  // Source viewer states (restored instantaneously from freeze cache if valid)
  const [selectedFile, setSelectedFile] = useState<string | null>(() => initialFrozen?.selectedFile ?? null);
  const [imageSrc, setImageSrc] = useState<string | null>(() => initialFrozen?.imageSrc ?? null);
  const [fileZoom, setFileZoom] = useState<number>(() => initialFrozen?.fileZoom ?? 100);
  const fileZoomRef = useRef<number>(initialFrozen?.fileZoom ?? 100);
  useEffect(() => {
    fileZoomRef.current = fileZoom;
  }, [fileZoom]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const freeImageInputRef = useRef<HTMLInputElement>(null);

  // PDF Multi-page viewer & jump states
  const [pdfDoc, setPdfDoc] = useState<any | null>(() => initialFrozen?.pdfDoc ?? null);
  const pdfDocRef = useRef<any | null>(initialFrozen?.pdfDoc ?? null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(() => initialFrozen?.pdfTotalPages ?? 1);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(() => initialFrozen?.pdfCurrentPage ?? 1);
  const pdfCurrentPageRef = useRef<number>(initialFrozen?.pdfCurrentPage ?? 1);
  useEffect(() => {
    pdfCurrentPageRef.current = pdfCurrentPage;
  }, [pdfCurrentPage]);

  // Scroll & freeze restoration refs
  const viewerScrollTopRef = useRef<number>(initialFrozen?.scrollTop ?? 0);
  const viewerScrollLeftRef = useRef<number>(initialFrozen?.scrollLeft ?? 0);
  const isRestoringScrollRef = useRef<boolean>(Boolean(initialFrozen?.selectedFile));

  // Smooth 60fps Lasso drawing & scroll throttle refs
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const lassoRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const rectRafRef = useRef<number | null>(null);

  const [pdfPageInput, setPdfPageInput] = useState<string>(() => String(initialFrozen?.pdfCurrentPage ?? 1));
  const [pdfPagesCache, setPdfPagesCache] = useState<Record<number, string>>(
    () => (initialFrozen?.pdfPagesCache ? { ...initialFrozen.pdfPagesCache } : {})
  );
  const pdfPagesCacheRef = useRef<Record<number, string>>(
    initialFrozen?.pdfPagesCache ? { ...initialFrozen.pdfPagesCache } : {}
  );
  const renderQueueRef = useRef<number[]>([]);
  const isQueueProcessingRef = useRef<boolean>(false);
  const [activePdfCropPage, setActivePdfCropPage] = useState<number>(() => initialFrozen?.activePdfCropPage ?? 1);
  const activePdfCropPageRef = useRef<number>(initialFrozen?.activePdfCropPage ?? 1);
  const [pdfPageAspectRatio, setPdfPageAspectRatio] = useState<number>(() => initialFrozen?.pdfPageAspectRatio ?? 1.414);
  const pdfPageAspectRatioRef = useRef<number>(initialFrozen?.pdfPageAspectRatio ?? 1.414);
  useEffect(() => {
    pdfPageAspectRatioRef.current = pdfPageAspectRatio;
  }, [pdfPageAspectRatio]);

  // High-performance queue worker for PDF pages (scale 1.5 + fast JPEG blob compression)
  const processRenderQueue = useCallback(async () => {
    if (isQueueProcessingRef.current) return;
    isQueueProcessingRef.current = true;

    try {
      while (renderQueueRef.current.length > 0) {
        const pageNum = renderQueueRef.current.shift();
        if (!pageNum) continue;
        if (pdfPagesCacheRef.current[pageNum]) continue;

        const doc = pdfDocRef.current;
        if (!doc) break;

        try {
          const page = await doc.getPage(pageNum);
          // Scale 1.5 gives crisp 150 DPI resolution with ultra-fast rendering & low memory footprint
          const viewport = page.getViewport({ scale: 1.5 });
          if (viewport.width && viewport.height) {
            setPdfPageAspectRatio(viewport.height / viewport.width);
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Asynchronous, off-thread JPEG compression is 10x faster than synchronous toDataURL PNG
          let pageUrl = "";
          if (canvas.toBlob) {
            const blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, "image/jpeg", 0.88);
            });
            if (blob) {
              pageUrl = URL.createObjectURL(blob);
            }
          }
          if (!pageUrl) {
            pageUrl = canvas.toDataURL("image/jpeg", 0.88);
          }

          pdfPagesCacheRef.current[pageNum] = pageUrl;
          setPdfPagesCache((prev) => ({ ...prev, [pageNum]: pageUrl }));
        } catch (err) {
          console.error(`Failed to render PDF page ${pageNum}:`, err);
        }
      }
    } finally {
      isQueueProcessingRef.current = false;
    }
  }, []);

  const queuePdfPage = useCallback((pageNum: number, priority = false) => {
    if (pdfPagesCacheRef.current[pageNum]) return;
    const existingIndex = renderQueueRef.current.indexOf(pageNum);
    if (priority) {
      if (existingIndex > -1) {
        renderQueueRef.current.splice(existingIndex, 1);
      }
      renderQueueRef.current.unshift(pageNum);
    } else {
      if (existingIndex === -1) {
        renderQueueRef.current.push(pageNum);
      }
    }
    processRenderQueue();
  }, [processRenderQueue]);

  const handleJumpToPdfPage = useCallback((pageNum: number) => {
    if (!pdfDoc) return;
    const targetPage = Math.max(1, Math.min(pdfTotalPages, pageNum));
    setPdfCurrentPage(targetPage);
    pdfCurrentPageRef.current = targetPage;
    setPdfPageInput(String(targetPage));
    setActivePdfCropPage(targetPage);
    activePdfCropPageRef.current = targetPage;

    // Prioritize target page immediately
    queuePdfPage(targetPage, true);
    if (targetPage + 1 <= pdfTotalPages) queuePdfPage(targetPage + 1, false);
    if (targetPage - 1 >= 1) queuePdfPage(targetPage - 1, false);

    const pageWidth = (fileZoom / 100) * 620;
    const singleSlotHeight = pageWidth * pdfPageAspectRatio + 24;
    const targetScrollTop = (targetPage - 1) * singleSlotHeight;

    viewerScrollTopRef.current = targetScrollTop;
    if (frozenViewerCache) {
      frozenViewerCache.pdfCurrentPage = targetPage;
      frozenViewerCache.activePdfCropPage = targetPage;
      frozenViewerCache.scrollTop = targetScrollTop;
      frozenViewerCache.updatedAt = Date.now();
    }

    isRestoringScrollRef.current = true;
    if (imageContainerRef.current) {
      imageContainerRef.current.scrollTo({
        top: targetScrollTop,
        behavior: "instant" as ScrollBehavior,
      });
    }
    setTimeout(() => {
      isRestoringScrollRef.current = false;
    }, 250);
  }, [pdfDoc, pdfTotalPages, queuePdfPage, fileZoom, pdfPageAspectRatio]);

  const handleViewerScroll = useCallback(() => {
    if (!imageContainerRef.current || isRestoringScrollRef.current) return;
    if (scrollRafRef.current) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!imageContainerRef.current || isRestoringScrollRef.current) return;
      const scrollTop = imageContainerRef.current.scrollTop;
      const scrollLeft = imageContainerRef.current.scrollLeft;

      viewerScrollTopRef.current = scrollTop;
      viewerScrollLeftRef.current = scrollLeft;
      if (frozenViewerCache) {
        frozenViewerCache.scrollTop = scrollTop;
        frozenViewerCache.scrollLeft = scrollLeft;
        frozenViewerCache.updatedAt = Date.now();
      }

      if (!pdfDoc || pdfTotalPages <= 0) return;

      const pageWidth = (fileZoom / 100) * 620;
      const slotHeight = pageWidth * pdfPageAspectRatio + 24;
      const current = Math.max(
        1,
        Math.min(
          pdfTotalPages,
          Math.floor((scrollTop + slotHeight * 0.35) / slotHeight) + 1
        )
      );

      if (current !== pdfCurrentPageRef.current) {
        pdfCurrentPageRef.current = current;
        setPdfCurrentPage(current);
        setPdfPageInput(String(current));
        if (frozenViewerCache) {
          frozenViewerCache.pdfCurrentPage = current;
          frozenViewerCache.updatedAt = Date.now();
        }

        // Predictive queue adjacent pages
        queuePdfPage(current, true);
        if (current + 1 <= pdfTotalPages) queuePdfPage(current + 1, false);
        if (current + 2 <= pdfTotalPages) queuePdfPage(current + 2, false);
        if (current - 1 >= 1) queuePdfPage(current - 1, false);
      }
    });
  }, [pdfDoc, pdfTotalPages, fileZoom, pdfPageAspectRatio, queuePdfPage]);

  // Top bar archive exam name vs. In-paper exam title (completely independent states, clean empty start)
  const [archiveExamName, setArchiveExamName] = useState<string>("");
  const [paperTitle, setPaperTitle] = useState<string>("");
  const [examCode, setExamCode] = useState<string>("BEEQ");
  const [maxScore, setMaxScore] = useState<number>(20);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState<boolean>(false);
  const [existingDuplicateExam, setExistingDuplicateExam] = useState<any>(null);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [isNewExamConfirmOpen, setIsNewExamConfirmOpen] = useState<boolean>(false);
  const [newExamSaveTitle, setNewExamSaveTitle] = useState<string>("");

  // Watermark State
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.07);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  // Per-Question Image Attachment State
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  const targetQuestionImageIndexRef = useRef<number | null>(null);
  const [hoveredQuestionIndex, setHoveredQuestionIndex] = useState<number | null>(null);
  const hoveredQuestionIndexRef = useRef<number | null>(null);
  useEffect(() => {
    hoveredQuestionIndexRef.current = hoveredQuestionIndex;
  }, [hoveredQuestionIndex]);

  const generateNewExamCode = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setExamCode(code);
    return code;
  }, []);

  // Uploaded files list & dropdown state
  const [uploadedFilesList, setUploadedFilesList] = useState<UploadedFileItem[]>([]);
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState<boolean>(false);
  const [isDragOverViewer, setIsDragOverViewer] = useState<boolean>(false);
  const [dropdownSearch, setDropdownSearch] = useState<string>("");
  const [isAllFilesModalOpen, setIsAllFilesModalOpen] = useState<boolean>(false);
  const [allFilesModalSearch, setAllFilesModalSearch] = useState<string>("");

  // Gemini API Key & Agent States
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [hasServerKey, setHasServerKey] = useState<boolean>(true);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState<boolean>(false);
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  const [refiningTask, setRefiningTask] = useState<string | null>(null);
  const [isBatchRefining, setIsBatchRefining] = useState<boolean>(false);

  // Uploaded File Viewer Tools & Lasso & Pan & Split states
  type ViewerTool = "lasso" | "hand" | "rect";
  const [viewerTool, setViewerTool] = useState<ViewerTool>("lasso");
  const [isSelectionPenActive, setIsSelectionPenActive] = useState<boolean>(true);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingLasso, setIsDrawingLasso] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentCrop, setCurrentCrop] = useState<CropRect | null>(null);
  const [completedCrop, setCompletedCrop] = useState<CropRect | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<number>(0);
  const extractProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [extractionFeedback, setExtractionFeedback] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isDuplicateFileModalOpen, setIsDuplicateFileModalOpen] = useState<boolean>(false);
  const [pendingFileToUpload, setPendingFileToUpload] = useState<File | null>(null);

  // Large File Upload Progress Tracking with Circular Loading & Remaining Time
  interface UploadProgressState {
    isOpen: boolean;
    fileName: string;
    percent: number;
    speedMb: string;
    remainingSec: number;
    loadedMb: string;
    totalMb: string;
    status: "uploading" | "processing" | "success" | "error";
    errorMessage?: string;
  }
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);

  // Passage & Reading Comprehension Workflow (Solution 2 & Unified Solution 1)
  const [isPassageModalOpen, setIsPassageModalOpen] = useState<boolean>(false);
  const [isPassageLassoWaiting, setIsPassageLassoWaiting] = useState<boolean>(false);
  const [manualPassageTitle, setManualPassageTitle] = useState<string>("• Read the following passage, then choose the correct answer:");
  const [manualPassageText, setManualPassageText] = useState<string>("");
  const [passageTargetIndex, setPassageTargetIndex] = useState<number | "new">("new");

  // Resizable Split View between uploaded document and paper canvas
  const [viewerWidthPercent, setViewerWidthPercent] = useState<number>(42);
  const [isResizingPanes, setIsResizingPanes] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Resize Panes mouse / touch effect
  useEffect(() => {
    if (!isResizingPanes) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const viewerPixels = containerRect.right - e.clientX;
      const totalPixels = containerRect.width;
      let newPercent = (viewerPixels / totalPixels) * 100;
      newPercent = Math.max(18, Math.min(75, newPercent));
      setViewerWidthPercent(newPercent);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!splitContainerRef.current || !e.touches[0]) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const viewerPixels = containerRect.right - e.touches[0].clientX;
      const totalPixels = containerRect.width;
      let newPercent = (viewerPixels / totalPixels) * 100;
      newPercent = Math.max(18, Math.min(75, newPercent));
      setViewerWidthPercent(newPercent);
    };

    const handleMouseUp = () => {
      setIsResizingPanes(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isResizingPanes]);

  // Exam Layout, Direction, Language & Choice Format
  const [examDirection, setExamDirection] = useState<"rtl" | "ltr">("rtl");
  const [choiceFormat, setChoiceFormat] = useState<"arabic" | "english_upper" | "english_lower">("arabic");
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // Global Page Font Size (Scales all questions to fit desired questions per A4 sheet)
  const [globalFontSize, setGlobalFontSize] = useState<number>(13);

  // Structured Exam Questions State (starts clean and empty)
  const [examQuestions, setExamQuestions] = useState<ExamQuestionItem[]>([]);

  // Multi-Model Exam State (نماذج أ - ب - ج لمنع الغش)
  const [examModels, setExamModels] = useState<ExamModelsData<ExamQuestionItem> | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);

  // Canva-like Free Floating Images on the A4 Canvas
  const [freeCanvasImages, setFreeCanvasImages] = useState<FreeCanvasItem[]>([]);
  const [activeFreeImageId, setActiveFreeImageId] = useState<string | null>(null);

  // Annotation Drawing Tool (Pens & Highlighters)
  type DrawTool = "pointer" | "pen" | "highlighter" | "eraser";
  const [activeDrawTool, setActiveDrawTool] = useState<DrawTool>("pointer");
  const [activeColor, setActiveColor] = useState<string>("#ef4444"); // default red pen
  const [activeBrushSize, setActiveBrushSize] = useState<number>(3);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawStroke | null>(null);

  // Undo / Redo History Stack (Ctrl+Z / Ctrl+Y)
  const [history, setHistory] = useState<HistorySnapshot[]>([
    {
      questions: [],
      freeImages: [],
      strokes: [],
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Keep references for event handlers to prevent stale closure issues
  const historyRef = useRef<HistorySnapshot[]>(history);
  const historyIndexRef = useRef<number>(historyIndex);
  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  // Focused question index for linking with Formatting Toolbar
  const [focusedQuestionIndex, setFocusedQuestionIndex] = useState<number>(0);

  // Per-question formatting styles map (bold, text-align)
  const [questionStyles, setQuestionStyles] = useState<Record<number, QuestionStyle>>({});

  // Drag-and-Drop Reordering states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Sync open document state continuously into module-level 3-hour freeze cache
  useEffect(() => {
    if (!selectedFile) {
      frozenViewerCache = null;
      return;
    }
    frozenViewerCache = {
      selectedFile,
      imageSrc,
      pdfDoc,
      pdfTotalPages,
      pdfCurrentPage,
      activePdfCropPage,
      pdfPageAspectRatio,
      pdfPagesCache,
      fileZoom,
      scrollTop: viewerScrollTopRef.current,
      scrollLeft: viewerScrollLeftRef.current,
      updatedAt: Date.now(),
    };
  }, [
    selectedFile,
    imageSrc,
    pdfDoc,
    pdfTotalPages,
    pdfCurrentPage,
    activePdfCropPage,
    pdfPageAspectRatio,
    pdfPagesCache,
    fileZoom,
  ]);

  // Restore exact scroll offset & active page on mount (returning from another section) or exiting Preview Mode
  useEffect(() => {
    if (isPreviewMode || !imageSrc || !imageContainerRef.current) return;

    const targetPage = pdfCurrentPageRef.current || 1;
    const pageWidth = (fileZoomRef.current / 100) * 620;
    const singleSlotHeight = pageWidth * pdfPageAspectRatioRef.current + 24;
    const fallbackScrollTop = pdfDoc && targetPage > 1 ? (targetPage - 1) * singleSlotHeight : 0;
    const targetScrollTop =
      viewerScrollTopRef.current > 0 ? viewerScrollTopRef.current : fallbackScrollTop;
    const targetScrollLeft = viewerScrollLeftRef.current || 0;

    if (targetScrollTop <= 0 && targetScrollLeft <= 0 && targetPage <= 1) {
      isRestoringScrollRef.current = false;
      return;
    }

    isRestoringScrollRef.current = true;
    if (pdfDoc && targetPage >= 1) {
      queuePdfPage(targetPage, true);
      if (targetPage + 1 <= pdfTotalPages) queuePdfPage(targetPage + 1, false);
      if (targetPage - 1 >= 1) queuePdfPage(targetPage - 1, false);
    }

    const applyScroll = () => {
      if (!imageContainerRef.current) return;
      imageContainerRef.current.scrollTo({
        top: targetScrollTop,
        left: targetScrollLeft,
        behavior: "instant" as ScrollBehavior,
      });
    };

    applyScroll();
    const rafId = requestAnimationFrame(applyScroll);
    const t1 = setTimeout(applyScroll, 60);
    const t2 = setTimeout(() => {
      applyScroll();
      isRestoringScrollRef.current = false;
    }, 280);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isPreviewMode, Boolean(imageSrc), Boolean(pdfDoc), pdfTotalPages, queuePdfPage]);

  // Continuous Scrolling: Lazy-load visible PDF pages & track current active page on scroll
  useEffect(() => {
    if (!pdfDoc || pdfTotalPages <= 0 || !imageContainerRef.current) return;

    const container = imageContainerRef.current;
    let renderObserver: IntersectionObserver | null = null;
    let activeObserver: IntersectionObserver | null = null;

    const timeoutId = setTimeout(() => {
      const pageWrappers = container.querySelectorAll<HTMLElement>(".pdf-page-wrapper");
      if (pageWrappers.length === 0) return;

      // 1. Observer to queue pages when within 1000px of viewport
      renderObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const p = Number((entry.target as HTMLElement).dataset.pageNumber);
              if (p && !pdfPagesCacheRef.current[p]) {
                queuePdfPage(p, false);
              }
            }
          });
        },
        {
          root: container,
          rootMargin: "1000px 0px 1000px 0px",
          threshold: 0.01,
        }
      );

      // 2. Observer to detect active visible page, sync toolbar, and pre-buffer neighbors
      activeObserver = new IntersectionObserver(
        (entries) => {
          if (isRestoringScrollRef.current) return;
          let maxRatio = 0;
          let visiblePage = 0;
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
              maxRatio = entry.intersectionRatio;
              const p = Number((entry.target as HTMLElement).dataset.pageNumber);
              if (p) visiblePage = p;
            }
          });
          if (visiblePage > 0) {
            pdfCurrentPageRef.current = visiblePage;
            setPdfCurrentPage(visiblePage);
            setPdfPageInput(String(visiblePage));
            if (frozenViewerCache) {
              frozenViewerCache.pdfCurrentPage = visiblePage;
              frozenViewerCache.updatedAt = Date.now();
            }

            // Priority queue current page if not yet cached
            if (!pdfPagesCacheRef.current[visiblePage]) {
              queuePdfPage(visiblePage, true);
            }
            // Predictive buffer: preload next 2 pages and previous page in background
            if (visiblePage + 1 <= pdfTotalPages && !pdfPagesCacheRef.current[visiblePage + 1]) {
              queuePdfPage(visiblePage + 1, false);
            }
            if (visiblePage + 2 <= pdfTotalPages && !pdfPagesCacheRef.current[visiblePage + 2]) {
              queuePdfPage(visiblePage + 2, false);
            }
            if (visiblePage - 1 >= 1 && !pdfPagesCacheRef.current[visiblePage - 1]) {
              queuePdfPage(visiblePage - 1, false);
            }
          }
        },
        {
          root: container,
          threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
        }
      );

      pageWrappers.forEach((el) => {
        renderObserver?.observe(el);
        activeObserver?.observe(el);
      });
    }, 40);

    return () => {
      clearTimeout(timeoutId);
      renderObserver?.disconnect();
      activeObserver?.disconnect();
    };
  }, [pdfDoc, pdfTotalPages, queuePdfPage]);

  // Push new snapshot into history stack for Ctrl+Z
  const pushHistorySnapshot = useCallback(
    (
      newQuestions: ExamQuestionItem[],
      newFreeImages: FreeCanvasItem[] = freeCanvasImages,
      newStrokes: DrawStroke[] = strokes,
      newWatermark: string | null = watermarkImage,
      newArchiveName: string = archiveExamName,
      newPaperTitle: string = paperTitle,
      newCode: string = examCode,
      newScore: number = maxScore
    ) => {
      const currentIdx = historyIndexRef.current;
      const upToCurrent = historyRef.current.slice(0, currentIdx + 1);
      const snapshot: HistorySnapshot = {
        questions: newQuestions,
        freeImages: newFreeImages,
        strokes: newStrokes,
        watermarkImage: newWatermark,
        archiveExamName: newArchiveName,
        paperTitle: newPaperTitle,
        examCode: newCode,
        maxScore: newScore,
      };
      setHistory([...upToCurrent, snapshot]);
      setHistoryIndex(upToCurrent.length);
    },
    [freeCanvasImages, strokes, watermarkImage, archiveExamName, paperTitle, examCode, maxScore]
  );

  const textDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleTextHistorySnapshot = useCallback(
    (newQuestions: ExamQuestionItem[]) => {
      if (textDebounceTimerRef.current) clearTimeout(textDebounceTimerRef.current);
      textDebounceTimerRef.current = setTimeout(() => {
        pushHistorySnapshot(newQuestions);
      }, 600);
    },
    [pushHistorySnapshot]
  );

  const handleUndo = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx > 0) {
      const targetIdx = currentIdx - 1;
      const snapshot = historyRef.current[targetIdx];
      if (snapshot) {
        setHistoryIndex(targetIdx);
        setExamQuestions(snapshot.questions);
        setFreeCanvasImages(snapshot.freeImages);
        setStrokes(snapshot.strokes);
        if (snapshot.watermarkImage !== undefined) setWatermarkImage(snapshot.watermarkImage);
        if (snapshot.archiveExamName !== undefined) setArchiveExamName(snapshot.archiveExamName);
        if (snapshot.paperTitle !== undefined) setPaperTitle(snapshot.paperTitle);
        if (snapshot.examCode !== undefined) setExamCode(snapshot.examCode);
        if (snapshot.maxScore !== undefined) setMaxScore(snapshot.maxScore);
        setSaveStatus("تم التراجع (Ctrl+Z) ↩️");
        setTimeout(() => setSaveStatus(null), 1500);
      }
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx < historyRef.current.length - 1) {
      const targetIdx = currentIdx + 1;
      const snapshot = historyRef.current[targetIdx];
      if (snapshot) {
        setHistoryIndex(targetIdx);
        setExamQuestions(snapshot.questions);
        setFreeCanvasImages(snapshot.freeImages);
        setStrokes(snapshot.strokes);
        if (snapshot.watermarkImage !== undefined) setWatermarkImage(snapshot.watermarkImage);
        if (snapshot.archiveExamName !== undefined) setArchiveExamName(snapshot.archiveExamName);
        if (snapshot.paperTitle !== undefined) setPaperTitle(snapshot.paperTitle);
        if (snapshot.examCode !== undefined) setExamCode(snapshot.examCode);
        if (snapshot.maxScore !== undefined) setMaxScore(snapshot.maxScore);
        setSaveStatus("تمت الإعادة (Ctrl+Y) ↪️");
        setTimeout(() => setSaveStatus(null), 1500);
      }
    }
  }, []);

  // =========================================================================
  // SCREEN STATE PERSISTENCE: Keep working screen preserved across navigation
  // =========================================================================
  const ACTIVE_SCREEN_STORAGE_KEY = "exam_builder_active_screen_v2";
  const isInitialMountDoneRef = useRef<boolean>(false);
  const pendingRestoreViewerRef = useRef<{
    fileName: string;
    page: number;
    scrollTop: number;
    scrollLeft: number;
    zoom: number;
  } | null>(null);

  // Reset to a clean fresh exam
  const handleResetToNewExam = useCallback((showNotice: boolean = true) => {
    setExamQuestions([]);
    setArchiveExamName("");
    setPaperTitle("");
    setSelectedFile(null);
    setImageSrc(null);
    setPdfDoc(null);
    pdfDocRef.current = null;
    setPdfTotalPages(1);
    setPdfCurrentPage(1);
    pdfCurrentPageRef.current = 1;
    setPdfPageInput("1");
    setActivePdfCropPage(1);
    activePdfCropPageRef.current = 1;
    setPdfPagesCache({});
    pdfPagesCacheRef.current = {};
    renderQueueRef.current = [];
    viewerScrollTopRef.current = 0;
    viewerScrollLeftRef.current = 0;
    frozenViewerCache = null;
    setCompletedCrop(null);
    setCurrentCrop(null);
    generateNewExamCode();
    setMaxScore(20);
    setFreeCanvasImages([]);
    setStrokes([]);
    setWatermarkImage(null);
    setEditingExamId(null);
    setQuestionStyles({});
    setExamModels(null);
    setIsModelModalOpen(false);
    setHistory([{ questions: [], freeImages: [], strokes: [] }]);
    setHistoryIndex(0);
    try {
      localStorage.removeItem(ACTIVE_SCREEN_STORAGE_KEY);
    } catch {}
    if (showNotice) {
      setSaveStatus("تم فتح نموذج اختبار جديد فارغ");
      setTimeout(() => setSaveStatus(null), 2500);
    }
  }, [generateNewExamCode]);

  // Initial Mount: Restore last screen state or load specific exam
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const isNew = params.get("new");

    if (id) {
      setEditingExamId(id);
      fetch(`/api/exams?id=${encodeURIComponent(id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.exam) {
            const ex = data.exam;
            if (ex.title) setArchiveExamName(ex.title);
            if (ex.paper_title) {
              setPaperTitle(ex.paper_title);
            } else if (ex.title) {
              setPaperTitle(ex.title);
            }
            if (ex.exam_code) setExamCode(ex.exam_code);
            if (ex.models && ex.models.modelCount > 1) {
              setExamModels(ex.models);
              const activeKey = ex.models.activeModelKey || "A";
              if (activeKey === "B" && ex.models.models?.B?.questions) {
                setExamQuestions(ex.models.models.B.questions);
              } else if (activeKey === "C" && ex.models.models?.C?.questions) {
                setExamQuestions(ex.models.models.C.questions);
              } else if (ex.models.models?.A?.questions) {
                setExamQuestions(ex.models.models.A.questions);
              }
            } else if (Array.isArray(ex.questions)) {
              setExamQuestions(ex.questions);
              setExamModels(null);
            }
            if (ex.total_points) setMaxScore(ex.total_points);
            if (ex.extraData && typeof ex.extraData === "object") {
              const extra = ex.extraData;
              if (extra.questionStyles) setQuestionStyles(extra.questionStyles);
              if (extra.globalFontSize) setGlobalFontSize(extra.globalFontSize);
              if (extra.examDirection) setExamDirection(extra.examDirection);
              if (extra.choiceFormat) setChoiceFormat(extra.choiceFormat);
              if (extra.watermarkImage !== undefined) setWatermarkImage(extra.watermarkImage);
              if (extra.watermarkOpacity !== undefined) setWatermarkOpacity(extra.watermarkOpacity);
              if (Array.isArray(extra.freeCanvasImages)) setFreeCanvasImages(extra.freeCanvasImages);
              if (Array.isArray(extra.strokes)) setStrokes(extra.strokes);
            }
            setSaveStatus(`تم تحميل نموذج الاختبار للتعديل: ${ex.title}`);
            setTimeout(() => setSaveStatus(null), 3500);
          }
          isInitialMountDoneRef.current = true;
        })
        .catch((err) => {
          console.error("Failed to load exam for editing", err);
          isInitialMountDoneRef.current = true;
        });
    } else if (isNew === "true") {
      handleResetToNewExam(false);
      window.history.replaceState({}, "", "/exam-builder");
      isInitialMountDoneRef.current = true;
    } else {
      // Restore last working screen automatically across tab/section navigation
      try {
        const saved = localStorage.getItem(ACTIVE_SCREEN_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.examQuestions)) {
            setExamQuestions(parsed.examQuestions);
          }
          if (parsed.examModels !== undefined) {
            setExamModels(parsed.examModels);
          }
          if (parsed.archiveExamName !== undefined) setArchiveExamName(parsed.archiveExamName);
          if (parsed.paperTitle !== undefined) setPaperTitle(parsed.paperTitle);
          if (parsed.examCode) setExamCode(parsed.examCode);
          if (parsed.maxScore) setMaxScore(parsed.maxScore);
          if (parsed.questionStyles) setQuestionStyles(parsed.questionStyles);
          if (parsed.globalFontSize) setGlobalFontSize(parsed.globalFontSize);
          if (parsed.examDirection) setExamDirection(parsed.examDirection);
          if (parsed.choiceFormat) setChoiceFormat(parsed.choiceFormat);
          if (parsed.watermarkImage !== undefined) setWatermarkImage(parsed.watermarkImage);
          if (parsed.watermarkOpacity !== undefined) setWatermarkOpacity(parsed.watermarkOpacity);
          if (Array.isArray(parsed.freeCanvasImages)) setFreeCanvasImages(parsed.freeCanvasImages);
          if (Array.isArray(parsed.strokes)) setStrokes(parsed.strokes);
          if (parsed.editingExamId !== undefined) setEditingExamId(parsed.editingExamId);

          // Only restore viewer from localStorage if in-memory freeze cache wasn't already active
          // AND the cached viewer timestamp is within the 3-hour TTL window
          const hasInMemoryFreeze = Boolean(getValidFrozenViewerCache()?.selectedFile);
          if (!hasInMemoryFreeze) {
            const viewerCachedAt = Number(parsed.viewerCachedAt) || 0;
            const isViewerCacheFresh =
              viewerCachedAt > 0 && Date.now() - viewerCachedAt <= VIEWER_FREEZE_TTL_MS;

            if (isViewerCacheFresh && parsed.selectedFile) {
              const restoredPage = Math.max(1, Number(parsed.pdfCurrentPage) || 1);
              const restoredZoom = Math.max(50, Math.min(250, Number(parsed.fileZoom) || 100));
              const restoredScrollTop = Math.max(0, Number(parsed.viewerScrollTop) || 0);
              const restoredScrollLeft = Math.max(0, Number(parsed.viewerScrollLeft) || 0);

              setSelectedFile(parsed.selectedFile);
              selectedFileRef.current = parsed.selectedFile;
              setFileZoom(restoredZoom);
              fileZoomRef.current = restoredZoom;
              setPdfCurrentPage(restoredPage);
              pdfCurrentPageRef.current = restoredPage;
              setPdfPageInput(String(restoredPage));
              setActivePdfCropPage(restoredPage);
              activePdfCropPageRef.current = restoredPage;
              viewerScrollTopRef.current = restoredScrollTop;
              viewerScrollLeftRef.current = restoredScrollLeft;

              if (
                parsed.imageSrc &&
                !String(parsed.imageSrc).startsWith("blob:") &&
                !String(parsed.selectedFile).toLowerCase().endsWith(".pdf")
              ) {
                setImageSrc(parsed.imageSrc);
              }

              pendingRestoreViewerRef.current = {
                fileName: parsed.selectedFile,
                page: restoredPage,
                scrollTop: restoredScrollTop,
                scrollLeft: restoredScrollLeft,
                zoom: restoredZoom,
              };
            }
          }

          if (parsed.examQuestions?.length > 0 || parsed.archiveExamName || parsed.paperTitle) {
            setSaveStatus("تمت استعادة جلسة العمل الحالية تلقائياً");
            setTimeout(() => setSaveStatus(null), 2500);
          }
        }
      } catch (e) {
        console.error("Failed to restore working screen", e);
      }
      isInitialMountDoneRef.current = true;
    }
  }, [handleResetToNewExam]);

  // Continuously save working screen to localStorage with QuotaExceeded fallback
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isInitialMountDoneRef.current) return;

    const persistableImageSrc =
      imageSrc && !imageSrc.startsWith("blob:") && imageSrc.length < 1000000 ? imageSrc : null;

    try {
      const screenState = {
        examQuestions,
        examModels,
        archiveExamName,
        paperTitle,
        examCode,
        maxScore,
        questionStyles,
        globalFontSize,
        examDirection,
        choiceFormat,
        watermarkImage: (watermarkImage && watermarkImage.length < 500000) ? watermarkImage : null,
        watermarkOpacity,
        freeCanvasImages: freeCanvasImages.map((img) => ({
          ...img,
          url: img.url.length < 500000 ? img.url : "",
        })),
        strokes,
        selectedFile,
        imageSrc: persistableImageSrc,
        pdfCurrentPage,
        fileZoom,
        viewerScrollTop: viewerScrollTopRef.current,
        viewerScrollLeft: viewerScrollLeftRef.current,
        viewerCachedAt: selectedFile ? Date.now() : 0,
        editingExamId,
      };
      localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, JSON.stringify(screenState));
    } catch (e) {
      // If quota exceeded due to large image, guarantee questions, titles & viewer page are still persisted
      try {
        const compactState = {
          examQuestions,
          examModels,
          archiveExamName,
          paperTitle,
          examCode,
          maxScore,
          questionStyles,
          globalFontSize,
          examDirection,
          choiceFormat,
          selectedFile,
          pdfCurrentPage,
          fileZoom,
          viewerScrollTop: viewerScrollTopRef.current,
          viewerScrollLeft: viewerScrollLeftRef.current,
          viewerCachedAt: selectedFile ? Date.now() : 0,
          editingExamId,
        };
        localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, JSON.stringify(compactState));
      } catch (fallbackErr) {
        console.warn("Auto-save compact screen error:", fallbackErr);
      }
    }
  }, [
    examQuestions,
    examModels,
    archiveExamName,
    paperTitle,
    examCode,
    maxScore,
    questionStyles,
    globalFontSize,
    examDirection,
    choiceFormat,
    watermarkImage,
    watermarkOpacity,
    freeCanvasImages,
    strokes,
    selectedFile,
    imageSrc,
    pdfCurrentPage,
    fileZoom,
    editingExamId,
  ]);

  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  // Load files list directly from the tenant's PC (IndexedDB — zero server upload)
  const loadUploadedFiles = useCallback(async () => {
    try {
      const files = await getLocalPcFilesList();
      setUploadedFilesList(files);
    } catch {
      // Ignore if IndexedDB unavailable
    }
  }, []);

  useEffect(() => {
    loadUploadedFiles();
  }, [loadUploadedFiles]);

  // Insert pasted or uploaded image
  const handleInsertPastedImage = (dataUrl: string) => {
    const updated = [...examQuestions];
    if (focusedQuestionIndex !== null && updated[focusedQuestionIndex]) {
      updated[focusedQuestionIndex] = {
        ...updated[focusedQuestionIndex],
        imageUrl: dataUrl,
        imageWidth: 65,
        imageAlign: "center",
      };
      setExamQuestions(updated);
      pushHistorySnapshot(updated);
      setSaveStatus("تم إدراج الصورة في الفقرة المحددة بنجاح");
    } else {
      const newQuestion: ExamQuestionItem = {
        id: `q-img-${Date.now()}`,
        type: "choice",
        text: `س${updated.length + 1}: من خلال الشكل المقابل، اختر الإجابة الصحيحة:`,
        options: ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
        points: 2,
        imageUrl: dataUrl,
        imageWidth: 70,
        imageAlign: "center",
      };
      const nextList = [...updated, newQuestion];
      setExamQuestions(nextList);
      setFocusedQuestionIndex(updated.length);
      pushHistorySnapshot(nextList);
      setSaveStatus("تم إدراج الصورة كفقرة جديدة");
    }
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // Add Free Draggable Canva Image
  const handleAddFreeCanvasImage = (dataUrl: string) => {
    const newFreeItem: FreeCanvasItem = {
      id: `free-img-${Date.now()}`,
      url: dataUrl,
      pageNumber: 1,
      x: 40,
      y: 120,
      width: 180,
    };
    const nextFree = [...freeCanvasImages, newFreeItem];
    setFreeCanvasImages(nextFree);
    pushHistorySnapshot(examQuestions, nextFree, strokes);
    setSaveStatus("تم إدراج صورة حرة (يمكنك سحبها وتحريكها في أي مكان)");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Dragging & Resizing Free Images on the Canvas (Canva style)
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);

  const handlePointerDownFreeImage = (e: React.PointerEvent, imgId: string, pageNumber: number) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveFreeImageId(imgId);
    setDraggingImageId(imgId);

    const pageEl = document.getElementById(`a4-sheet-${pageNumber}`);
    const pageRect = pageEl ? pageEl.getBoundingClientRect() : { left: 0, top: 0, width: 680, height: 962 };
    const currentImg = freeCanvasImages.find((img) => img.id === imgId);
    if (!currentImg) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialX = currentImg.x;
    const initialY = currentImg.y;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const pageBounds = pageEl ? pageEl.getBoundingClientRect() : pageRect;
      const deltaX = moveEvt.clientX - startClientX;
      const deltaY = moveEvt.clientY - startClientY;
      const newX = Math.max(5, Math.min(pageBounds.width - 50, initialX + deltaX));
      const newY = Math.max(5, Math.min(pageBounds.height - 50, initialY + deltaY));

      setFreeCanvasImages((prev) =>
        prev.map((img) => (img.id === imgId ? { ...img, x: newX, y: newY, pageNumber } : img))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setDraggingImageId(null);
      setFreeCanvasImages((current) => {
        pushHistorySnapshot(examQuestions, current, strokes);
        return current;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleStartResizeFreeImage = (e: React.PointerEvent, imgId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const currentImg = freeCanvasImages.find((img) => img.id === imgId);
    if (!currentImg) return;
    const startX = e.clientX;
    const initialWidth = currentImg.width;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaX = moveEvt.clientX - startX;
      const newWidth = Math.max(40, Math.min(550, initialWidth + deltaX));
      setFreeCanvasImages((prev) =>
        prev.map((img) => (img.id === imgId ? { ...img, width: newWidth } : img))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setFreeCanvasImages((current) => {
        pushHistorySnapshot(examQuestions, current, strokes);
        return current;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleDeleteFreeImage = (id: string) => {
    const nextFree = freeCanvasImages.filter((img) => img.id !== id);
    setFreeCanvasImages(nextFree);
    pushHistorySnapshot(examQuestions, nextFree, strokes);
  };

  // Global dragover & drop prevention to completely prevent browser from navigating/reloading when dropping files
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", handleGlobalDragOver);
    window.addEventListener("drop", handleGlobalDrop);
    return () => {
      window.removeEventListener("dragover", handleGlobalDragOver);
      window.removeEventListener("drop", handleGlobalDrop);
    };
  }, []);

  // Process Document File Selection (100% Local on Tenant's PC — Zero Server Upload)
  const processDocumentFileUpload = async (file: File, isReplace = false) => {
    if (!file) return;

    // Reset crop, lasso, and scroll offsets for the newly opened document
    setCompletedCrop(null);
    setCurrentCrop(null);
    setLassoPoints([]);
    viewerScrollTopRef.current = 0;
    viewerScrollLeftRef.current = 0;

    const isPdf = file.name.toLowerCase().endsWith(".pdf");

    // 1. Instant local display directly from the tenant's PC via streaming Blob URL
    if (isPdf) {
      try {
        setSaveStatus(`جاري فتح مستند PDF من جهازك (${file.name})...`);
        const pdfjs = await loadPdfJs();
        const blobUrl = URL.createObjectURL(file);
        const loadingTask = pdfjs.getDocument({ url: blobUrl });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        pdfDocRef.current = pdf;
        setPdfTotalPages(pdf.numPages);
        setPdfCurrentPage(1);
        pdfCurrentPageRef.current = 1;
        setPdfPageInput("1");
        setActivePdfCropPage(1);
        activePdfCropPageRef.current = 1;
        setPdfPagesCache({});
        pdfPagesCacheRef.current = {};
        renderQueueRef.current = [];
        queuePdfPage(1, true);
        if (pdf.numPages > 1) queuePdfPage(2, false);
        if (pdf.numPages > 2) queuePdfPage(3, false);
        setSelectedFile(file.name);
        setImageSrc((prev) => {
          if (prev && prev.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(prev);
            } catch {}
          }
          return blobUrl;
        });
        if (imageContainerRef.current) {
          imageContainerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        }
      } catch (err) {
        console.warn("Could not render PDF via PDF.js on client:", err);
      }
    } else {
      setPdfDoc(null);
      pdfDocRef.current = null;
      setPdfTotalPages(1);
      setPdfCurrentPage(1);
      pdfCurrentPageRef.current = 1;
      setPdfPageInput("1");
      setPdfPagesCache({});
      pdfPagesCacheRef.current = {};
      // Direct image file
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setImageSrc(dataUrl);
          setSelectedFile(file.name);
          if (imageContainerRef.current) {
            imageContainerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
          }
        }
      };
      reader.readAsDataURL(file);
    }

    // 2. Save in local PC IndexedDB so it appears in "الملفات المرفوعة" without touching the server
    try {
      await saveFileToLocalPc(file);
      await loadUploadedFiles();
      setSaveStatus(
        isReplace
          ? `تم تحديث المستند محلياً على جهازك "${file.name}" بنجاح`
          : `تم فتح وحفظ المستند محلياً على جهازك "${file.name}" بنجاح`
      );
    } catch (err) {
      console.warn("Could not persist file in local IndexedDB:", err);
      setSaveStatus(`تم فتح المستند محلياً "${file.name}"`);
    }
    setTimeout(() => {
      setSaveStatus(null);
    }, 2200);
  };

  // Manual Passage text insertion handler
  const handleApplyManualPassage = () => {
    if (!manualPassageText.trim()) return;

    if (passageTargetIndex !== "new" && typeof passageTargetIndex === "number" && examQuestions[passageTargetIndex]) {
      const updated = [...examQuestions];
      updated[passageTargetIndex].passageText = manualPassageText.trim();
      updated[passageTargetIndex].passageTitle = manualPassageTitle.trim() || undefined;
      updated[passageTargetIndex].subType = "passage";
      setExamQuestions(updated);
      pushHistorySnapshot(updated);
      setSaveStatus(`تم إرفاق القطعة بالسؤال ${passageTargetIndex + 1} بنجاح`);
    } else {
      const newIndex = examQuestions.length;
      const isEnglish = /[a-zA-Z]{3,}/.test(manualPassageText);
      const newPassageItem: ExamQuestionItem = {
        id: `passage-${Date.now()}`,
        type: "passage",
        text: "",
        options: [],
        points: 0,
        passageText: manualPassageText.trim(),
        passageTitle: manualPassageTitle.trim() || (isEnglish ? "• Read the following passage, then answer the questions:" : "• اقرأ القطعة التالية ثم أجب عن الأسئلة:"),
        subType: "passage",
      };
      const updated = [...examQuestions, newPassageItem];
      setExamQuestions(updated);
      pushHistorySnapshot(updated);
      setFocusedQuestionIndex(newIndex);
      setSaveStatus("تم إضافة قطعة الفهم كعنصر مستقل بنجاح");
    }

    setIsPassageModalOpen(false);
    setManualPassageText("");
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // Inspect incoming file for duplicate check before saving locally
  const handleIncomingFile = (file: File) => {
    if (!file) return;

    // Duplicate check by file name
    const exists = uploadedFilesList.some(
      (f) => f.name.trim().toLowerCase() === file.name.trim().toLowerCase()
    );

    if (exists) {
      setPendingFileToUpload(file);
      setIsDuplicateFileModalOpen(true);
    } else {
      processDocumentFileUpload(file, false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleIncomingFile(file);
      e.target.value = "";
    }
  };

  // Selection from Dropdown, Full Modal, or Local PC Store (with optional page & scroll resume)
  const handleSelectUploadedFile = useCallback(
    async (
      f: UploadedFileItem,
      restoreOptions?: {
        initialPage?: number;
        initialScrollTop?: number;
        initialScrollLeft?: number;
        silent?: boolean;
      }
    ) => {
      setSelectedFile(f.name);
      selectedFileRef.current = f.name;
      setCompletedCrop(null);
      setCurrentCrop(null);
      setLassoPoints([]);

      const targetInitialPage = Math.max(1, restoreOptions?.initialPage || 1);
      const targetInitialScrollTop = Math.max(0, restoreOptions?.initialScrollTop || 0);
      const targetInitialScrollLeft = Math.max(0, restoreOptions?.initialScrollLeft || 0);

      viewerScrollTopRef.current = targetInitialScrollTop;
      viewerScrollLeftRef.current = targetInitialScrollLeft;

      try {
        const record =
          (f.id ? await getLocalPcFileById(f.id) : null) ||
          (await getLocalPcFileByName(f.name));

        if (record && record.blob) {
          const blobUrl = URL.createObjectURL(record.blob);
          if (f.name.toLowerCase().endsWith(".pdf")) {
            if (!restoreOptions?.silent) {
              setSaveStatus(`جاري تجهيز مستند PDF من جهازك: ${f.name}...`);
            }
            const pdfjs = await loadPdfJs();
            const arrayBuffer = await record.blob.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const startPage = Math.max(1, Math.min(pdf.numPages, targetInitialPage));

            isRestoringScrollRef.current = true;
            setPdfDoc(pdf);
            pdfDocRef.current = pdf;
            setPdfTotalPages(pdf.numPages);
            setPdfCurrentPage(startPage);
            pdfCurrentPageRef.current = startPage;
            setPdfPageInput(String(startPage));
            setActivePdfCropPage(startPage);
            activePdfCropPageRef.current = startPage;
            setPdfPagesCache({});
            pdfPagesCacheRef.current = {};
            renderQueueRef.current = [];

            // Render resumed target page first (e.g. Page 30), then adjacent pages
            queuePdfPage(startPage, true);
            if (startPage + 1 <= pdf.numPages) queuePdfPage(startPage + 1, false);
            if (startPage - 1 >= 1) queuePdfPage(startPage - 1, false);
            if (startPage + 2 <= pdf.numPages) queuePdfPage(startPage + 2, false);

            setImageSrc((prev) => {
              if (prev && prev.startsWith("blob:")) {
                try {
                  URL.revokeObjectURL(prev);
                } catch {}
              }
              return blobUrl;
            });

            const pageWidth = (fileZoomRef.current / 100) * 620;
            const singleSlotHeight = pageWidth * pdfPageAspectRatioRef.current + 24;
            const computedScrollTop =
              targetInitialScrollTop > 0
                ? targetInitialScrollTop
                : (startPage - 1) * singleSlotHeight;
            viewerScrollTopRef.current = computedScrollTop;

            setTimeout(() => {
              if (imageContainerRef.current) {
                imageContainerRef.current.scrollTo({
                  top: computedScrollTop,
                  left: targetInitialScrollLeft,
                  behavior: "instant" as ScrollBehavior,
                });
              }
            }, 50);
            setTimeout(() => {
              if (imageContainerRef.current) {
                imageContainerRef.current.scrollTo({
                  top: computedScrollTop,
                  left: targetInitialScrollLeft,
                  behavior: "instant" as ScrollBehavior,
                });
              }
              isRestoringScrollRef.current = false;
            }, 280);

            if (!restoreOptions?.silent) {
              setSaveStatus(
                startPage > 1
                  ? `تم استئناف المستند "${f.name}" عند صفحة ${startPage} من ${pdf.numPages}`
                  : `تم فتح المستند من جهازك: ${f.name} (${pdf.numPages} صفحة)`
              );
            }
          } else {
            isRestoringScrollRef.current = true;
            setPdfDoc(null);
            pdfDocRef.current = null;
            setPdfTotalPages(1);
            setPdfCurrentPage(1);
            pdfCurrentPageRef.current = 1;
            setPdfPageInput("1");
            setPdfPagesCache({});
            pdfPagesCacheRef.current = {};
            setImageSrc(blobUrl);

            setTimeout(() => {
              if (imageContainerRef.current) {
                imageContainerRef.current.scrollTo({
                  top: targetInitialScrollTop,
                  left: targetInitialScrollLeft,
                  behavior: "instant" as ScrollBehavior,
                });
              }
              isRestoringScrollRef.current = false;
            }, 150);

            if (!restoreOptions?.silent) {
              setSaveStatus(`تم فتح المستند من جهازك: ${f.name}`);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to open local PC file:", err);
        isRestoringScrollRef.current = false;
      }

      setIsFileDropdownOpen(false);
      setIsAllFilesModalOpen(false);
      if (!restoreOptions?.silent) {
        setTimeout(() => setSaveStatus(null), 2500);
      }
    },
    [queuePdfPage]
  );

  // Auto-open local file when navigating with ?localFile=... or when restoring cached viewer on refresh (within 3h TTL)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const localFileName = params.get("localFile") || params.get("name");

    if (localFileName) {
      // Clean URL query parameter so future route returns don't reset to page 1
      params.delete("localFile");
      params.delete("name");
      const remainingQuery = params.toString();
      window.history.replaceState(
        {},
        "",
        remainingQuery ? `/exam-builder?${remainingQuery}` : "/exam-builder"
      );

      const frozen = getValidFrozenViewerCache();
      if (frozen && frozen.selectedFile === localFileName && (pdfDocRef.current || imageSrc)) {
        return;
      }

      handleSelectUploadedFile({
        id: "",
        name: localFileName,
        type: localFileName.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
        size: "",
        date: "",
      });
      return;
    }

    // If in-memory freeze cache already restored the open document, nothing to reload
    if (getValidFrozenViewerCache()?.selectedFile && (pdfDocRef.current || imageSrc)) {
      pendingRestoreViewerRef.current = null;
      return;
    }

    // Otherwise, if browser was refreshed within the 3-hour TTL window, reopen from IndexedDB at exact page & scroll
    if (pendingRestoreViewerRef.current) {
      const restoreInfo = pendingRestoreViewerRef.current;
      pendingRestoreViewerRef.current = null;
      handleSelectUploadedFile(
        {
          id: "",
          name: restoreInfo.fileName,
          type: restoreInfo.fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
          size: "",
          date: "",
        },
        {
          initialPage: restoreInfo.page,
          initialScrollTop: restoreInfo.scrollTop,
          initialScrollLeft: restoreInfo.scrollLeft,
          silent: true,
        }
      );
    }
  }, [handleSelectUploadedFile, imageSrc]);

  // Drag and Drop files onto Document Viewer without flickering
  const dragCounterRef = useRef<number>(0);

  const handleViewerDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOverViewer(true);
    }
  };

  const handleViewerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOverViewer) {
      setIsDragOverViewer(true);
    }
  };

  const handleViewerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOverViewer(false);
    }
  };

  const handleViewerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOverViewer(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleIncomingFile(e.dataTransfer.files[0]);
    }
  };

  // Pristine Print Handler: Switches to clean preview mode before triggering print
  const handlePrint = useCallback(() => {
    setIsPreviewMode(true);
    setTimeout(() => {
      window.print();
    }, 150);
  }, []);

  // Refs for stable event listeners without re-subscribing on state changes
  const examQuestionsRef = useRef(examQuestions);
  examQuestionsRef.current = examQuestions;

  const focusedQuestionIndexRef = useRef(focusedQuestionIndex);
  focusedQuestionIndexRef.current = focusedQuestionIndex;

  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;

  const handleRedoRef = useRef(handleRedo);
  handleRedoRef.current = handleRedo;

  const handlePrintRef = useRef(handlePrint);
  handlePrintRef.current = handlePrint;

  // Global Keyboard Shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+V / Ctrl+P)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
              const dataUrl = uploadEvent.target?.result as string;
              if (dataUrl) {
                const currentQuestions = examQuestionsRef.current;
                const focusedIdx = focusedQuestionIndexRef.current;
                const hoveredIdx = hoveredQuestionIndexRef.current;

                const targetIdx =
                  focusedIdx !== null && currentQuestions[focusedIdx]
                    ? focusedIdx
                    : hoveredIdx !== null && currentQuestions[hoveredIdx]
                    ? hoveredIdx
                    : null;

                if (targetIdx !== null) {
                  const updated = [...currentQuestions];
                  updated[targetIdx] = {
                    ...updated[targetIdx],
                    imageUrl: dataUrl,
                    imageWidth: 70,
                    imageAlign: "center",
                  };
                  setExamQuestions(updated);
                  pushHistorySnapshot(updated);
                  setSaveStatus(`تم إدراج الصورة في السؤال (${targetIdx + 1}) بنجاح`);
                  setTimeout(() => setSaveStatus(null), 2500);
                } else {
                  handleAddFreeCanvasImage(dataUrl);
                }
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Support physical key code or Arabic / English key
      const isZ = e.code === "KeyZ" || e.key.toLowerCase() === "z" || e.key === "ئ";
      const isY = e.code === "KeyY" || e.key.toLowerCase() === "y" || e.key === "إ" || e.key === "غ";
      const isP = e.code === "KeyP" || e.key.toLowerCase() === "p" || e.key === "ح";

      // Ctrl+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && isZ) {
        if (!e.shiftKey) {
          e.preventDefault();
          handleUndoRef.current();
        } else {
          e.preventDefault();
          handleRedoRef.current();
        }
      }
      // Ctrl+Y (Redo)
      else if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        handleRedoRef.current();
      }
      // Ctrl+P (Print)
      else if ((e.ctrlKey || e.metaKey) && isP) {
        e.preventDefault();
        handlePrintRef.current();
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleAddFreeCanvasImage, pushHistorySnapshot]);

  // Watermark upload & removal handlers
  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (dataUrl) {
          setWatermarkImage(dataUrl);
          pushHistorySnapshot(examQuestions, freeCanvasImages, strokes, dataUrl);
          setSaveStatus("تم رفع وضبط العلامة المائية للورقة");
          setTimeout(() => setSaveStatus(null), 2500);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  const handleRemoveWatermark = () => {
    setWatermarkImage(null);
    pushHistorySnapshot(examQuestions, freeCanvasImages, strokes, null);
    setSaveStatus("تمت إزالة العلامة المائية");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  // Question Image Attachment Handlers
  const handleTriggerQuestionImage = (qIndex: number) => {
    targetQuestionImageIndexRef.current = qIndex;
    questionImageInputRef.current?.click();
  };

  const handleQuestionImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIdx = targetQuestionImageIndexRef.current;
    if (file && targetIdx !== null && examQuestions[targetIdx]) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (dataUrl) {
          const updated = [...examQuestions];
          updated[targetIdx] = {
            ...updated[targetIdx],
            imageUrl: dataUrl,
            imageWidth: 70,
            imageAlign: "center",
          };
          setExamQuestions(updated);
          pushHistorySnapshot(updated);
          setSaveStatus(`تم إدراج الصورة في السؤال (${targetIdx + 1}) بنجاح`);
          setTimeout(() => setSaveStatus(null), 2500);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  const handleQuestionCardDrop = (e: React.DragEvent, qIndex: number) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const dataUrl = uploadEvent.target?.result as string;
          if (dataUrl) {
            const updated = [...examQuestions];
            updated[qIndex] = {
              ...updated[qIndex],
              imageUrl: dataUrl,
              imageWidth: 70,
              imageAlign: "center",
            };
            setExamQuestions(updated);
            pushHistorySnapshot(updated);
            setSaveStatus(`تم إدراج الصورة المسحوبة في السؤال (${qIndex + 1})`);
            setTimeout(() => setSaveStatus(null), 2500);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Check saved Gemini API key on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("gemini_api_key");
      if (savedKey) setGeminiApiKey(savedKey);
    }

    fetch("/api/config/gemini")
      .then((r) => r.json())
      .then((d) => {
        if (d.configured) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveApiKey = (newKey: string) => {
    setGeminiApiKey(newKey);
    if (typeof window !== "undefined") {
      if (newKey) {
        localStorage.setItem("gemini_api_key", newKey);
      } else {
        localStorage.removeItem("gemini_api_key");
      }
    }
    if (newKey) setHasServerKey(true);
  };

  const isGeminiActive = Boolean(geminiApiKey || hasServerKey);

  // Helper to retrieve the style of a specific question (preferring question.id over array index so shuffling/reordering preserves styles)
  const getQuestionStyle = (index: number): QuestionStyle => {
    const qId = examQuestions[index]?.id;
    const byId = qId ? (questionStyles as Record<string, QuestionStyle>)[qId] : undefined;
    return (
      byId ||
      questionStyles[index] || {
        fontSize: globalFontSize,
        isBold: false,
        textAlign: examDirection === "ltr" ? "left" : "right",
      }
    );
  };

  const updateFocusedQuestionStyle = (updater: (prev: QuestionStyle) => QuestionStyle) => {
    const activeIdx = focusedQuestionIndex ?? 0;
    const qId = examQuestions[activeIdx]?.id;
    setQuestionStyles((prev) => {
      const byId = qId ? (prev as Record<string, QuestionStyle>)[qId] : undefined;
      const current =
        byId ||
        prev[activeIdx] || {
          fontSize: globalFontSize,
          isBold: false,
          textAlign: examDirection === "ltr" ? "left" : "right",
        };
      const updatedStyle = updater(current);
      return {
        ...prev,
        [activeIdx]: updatedStyle,
        ...(qId ? { [qId]: updatedStyle } : {}),
      };
    });
  };

  const currentFocusedStyle = getQuestionStyle(focusedQuestionIndex ?? 0);

  // Save exam to local SQLite Database with Duplicate Title Detection & Versioning
  const handleSaveExamToDb = async (overrideTitle?: string, overwriteExistingId?: string) => {
    setSaveStatus("جاري التحقق...");
    const targetTitle = (overrideTitle ?? archiveExamName).trim() || paperTitle.trim() || "ورقة امتحان";
    const activeExamId = overwriteExistingId || editingExamId;

    // If not explicitly overwriting or saving a newly generated version and not already editing, check duplicate
    if (!activeExamId && !overrideTitle) {
      try {
        const checkRes = await fetch("/api/exams");
        const checkData = await checkRes.json();
        if (checkData.success && Array.isArray(checkData.exams)) {
          const match = checkData.exams.find(
            (e: any) => e.title?.trim().toLowerCase() === targetTitle.toLowerCase()
          );
          if (match) {
            setExistingDuplicateExam(match);
            setDuplicateModalOpen(true);
            setSaveStatus(null);
            return;
          }
        }
      } catch (err) {
        console.error("Check duplicate failed", err);
      }
    }

    setSaveStatus("جاري الحفظ...");
    try {
      let modelsToSave = examModels;
      let modelAQuestions = examQuestions;
      if (examModels && examModels.modelCount > 1) {
        const currentKey = examModels.activeModelKey;
        const updatedModels = { ...examModels.models };
        const syncSharedFieldsToModelA = (editedList: ExamQuestionItem[]) => {
          const byId = new Map(editedList.map((q) => [q.id, q]));
          updatedModels.A = {
            ...updatedModels.A,
            questions: updatedModels.A.questions.map((aq) => {
              const edited = byId.get(aq.id);
              if (!edited) return aq;
              return {
                ...aq,
                text: edited.text,
                points: edited.points,
                imageUrl: edited.imageUrl,
                imageWidth: edited.imageWidth,
                imageAlign: edited.imageAlign,
                passageText: edited.passageText,
                passageTitle: edited.passageTitle,
              };
            }),
          };
        };

        if (currentKey === "A") {
          updatedModels.A = { ...updatedModels.A, questions: [...examQuestions] };
          modelAQuestions = examQuestions;
        } else if (currentKey === "B" && updatedModels.B) {
          updatedModels.B = { ...updatedModels.B, questions: [...examQuestions] };
          syncSharedFieldsToModelA(examQuestions);
          modelAQuestions = updatedModels.A.questions;
        } else if (currentKey === "C" && updatedModels.C) {
          updatedModels.C = { ...updatedModels.C, questions: [...examQuestions] };
          syncSharedFieldsToModelA(examQuestions);
          modelAQuestions = updatedModels.A.questions;
        }
        modelsToSave = { ...examModels, models: updatedModels };
        setExamModels(modelsToSave);
      }

      const totalPts = modelAQuestions.reduce((acc, q) => acc + (q.points || 0), 0);
      const examId = activeExamId || `exam-${examCode}-${Date.now()}`;
      const extraDataPayload = {
        questionStyles,
        globalFontSize,
        examDirection,
        choiceFormat,
        watermarkImage: watermarkImage && watermarkImage.length < 500000 ? watermarkImage : null,
        watermarkOpacity,
        freeCanvasImages: freeCanvasImages.map((img) => ({
          ...img,
          url: img.url.length < 500000 ? img.url : "",
        })),
        strokes,
      };
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: examId,
          title: targetTitle,
          paper_title: paperTitle.trim() || targetTitle,
          exam_code: examCode,
          subject: "عام",
          grade: "مستوى عام",
          duration: "ساعتان",
          questions: JSON.stringify(modelAQuestions),
          models: modelsToSave && modelsToSave.modelCount > 1 ? JSON.stringify(modelsToSave) : undefined,
          extraData: extraDataPayload,
          questions_count: modelAQuestions.length,
          total_points: maxScore || totalPts,
          date_created: new Date().toLocaleDateString("ar-EG"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (!editingExamId) {
          setEditingExamId(examId);
          try {
            window.history.replaceState({}, "", `/exam-builder?id=${encodeURIComponent(examId)}`);
          } catch {}
        }
        if (activeExamId) {
          setSaveStatus("تم حفظ تعديلات ورقة الاختبار بنجاح في قاعدة البيانات.");
        } else {
          setSaveStatus("تم حفظ ورقة الاختبار بنجاح في قاعدة البيانات.");
        }
        setTimeout(() => setSaveStatus(null), 3500);
      } else {
        setSaveStatus(data.error || "تعذر الحفظ في قاعدة البيانات.");
        setTimeout(() => setSaveStatus(null), 4000);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveStatus("خطأ في الاتصال بقاعدة البيانات.");
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const handleSaveAsNewVersion = () => {
    const currentTitle = archiveExamName.trim() || paperTitle.trim() || "ورقة امتحان";
    const versionMatch = currentTitle.match(/^(.*?)\s*-\s*(\d+)$/);
    let nextTitle = "";
    if (versionMatch) {
      const baseName = versionMatch[1].trim();
      const currentVer = parseInt(versionMatch[2], 10);
      nextTitle = `${baseName} - ${currentVer + 1}`;
    } else {
      nextTitle = `${currentTitle} - 1`;
    }
    const newId = `exam-${examCode}-${Date.now()}`;
    setArchiveExamName(nextTitle);
    setDuplicateModalOpen(false);
    setExistingDuplicateExam(null);
    setEditingExamId(newId);
    handleSaveExamToDb(nextTitle, newId);
  };

  const handleOverwriteDuplicate = () => {
    if (!existingDuplicateExam) return;
    const existingId = existingDuplicateExam.id;
    setDuplicateModalOpen(false);
    setEditingExamId(existingId);
    handleSaveExamToDb(archiveExamName, existingId);
  };

  // -------------------------------------------------------------
  // MULTI-MODEL GENERATOR HANDLERS (نماذج أ - ب - ج)
  // -------------------------------------------------------------
  const handleGenerateModels = (count: 2 | 3) => {
    if (examQuestions.length === 0) return;
    const baseQuestions =
      examModels && examModels.activeModelKey !== "A"
        ? examModels.models.A.questions
        : examQuestions;

    const generated = generateExamModels(baseQuestions, count);
    setExamModels(generated);
    setExamQuestions(generated.models.A.questions);
    setSaveStatus(
      count === 2
        ? "تم توليد نموذجين (أ - ب) بنجاح مع خلط الأسئلة وتحديث الترقيم"
        : "تم توليد ٣ نماذج (أ - ب - ج) بنجاح مع خلط الأسئلة وتحديث الترقيم"
    );
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleReshuffleExistingModels = () => {
    if (!examModels || examModels.modelCount <= 1) return;
    const baseQuestions =
      examModels.activeModelKey === "A"
        ? examQuestions
        : examModels.models.A.questions;

    const nextModels = reshuffleExamModels({
      ...examModels,
      models: {
        ...examModels.models,
        A: { ...examModels.models.A, questions: baseQuestions },
      },
    });
    setExamModels(nextModels);

    if (nextModels.activeModelKey === "B" && nextModels.models.B) {
      setExamQuestions(nextModels.models.B.questions);
    } else if (nextModels.activeModelKey === "C" && nextModels.models.C) {
      setExamQuestions(nextModels.models.C.questions);
    } else {
      setExamQuestions(nextModels.models.A.questions);
    }

    setSaveStatus("تمت إعادة خلط أسئلة النماذج بنجاح مع تحديث الترقيم");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleResetSingleModel = () => {
    if (examModels && examModels.models.A) {
      setExamQuestions(examModels.models.A.questions);
    }
    setExamModels(null);
    setSaveStatus("تمت العودة إلى نموذج اختبار واحد");
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleSelectModelTab = (targetKey: "A" | "B" | "C" | "ALL") => {
    if (!examModels) return;
    const currentKey = examModels.activeModelKey;
    if (currentKey === targetKey) return;

    // 1. Sync current examQuestions back to the model being navigated away from
    const updatedModels = { ...examModels.models };
    if (currentKey === "A") {
      updatedModels.A = { ...updatedModels.A, questions: [...examQuestions] };
    } else if (currentKey === "B" && updatedModels.B) {
      updatedModels.B = { ...updatedModels.B, questions: [...examQuestions] };
    } else if (currentKey === "C" && updatedModels.C) {
      updatedModels.C = { ...updatedModels.C, questions: [...examQuestions] };
    }

    // 2. Load the target model's questions into examQuestions
    if (targetKey === "A") {
      setExamQuestions(updatedModels.A.questions);
    } else if (targetKey === "B" && updatedModels.B) {
      setExamQuestions(updatedModels.B.questions);
    } else if (targetKey === "C" && updatedModels.C) {
      setExamQuestions(updatedModels.C.questions);
    }

    setExamModels({
      ...examModels,
      activeModelKey: targetKey,
      models: updatedModels,
    });
  };

  const handlePrintAllModels = useCallback(() => {
    if (!examModels || examModels.modelCount <= 1) {
      handlePrint();
      return;
    }
    const currentKey = examModels.activeModelKey;
    const updatedModels = { ...examModels.models };
    if (currentKey === "A") {
      updatedModels.A = { ...updatedModels.A, questions: [...examQuestions] };
    } else if (currentKey === "B" && updatedModels.B) {
      updatedModels.B = { ...updatedModels.B, questions: [...examQuestions] };
    } else if (currentKey === "C" && updatedModels.C) {
      updatedModels.C = { ...updatedModels.C, questions: [...examQuestions] };
    }

    setExamModels({
      ...examModels,
      activeModelKey: "ALL",
      models: updatedModels,
    });
    setIsPreviewMode(true);

    setTimeout(() => {
      window.print();
    }, 250);
  }, [examModels, examQuestions, handlePrint]);

  const getCurrentModelBadge = (): string | null => {
    if (!examModels || examModels.modelCount <= 1) return null;
    if (examModels.activeModelKey === "B") return "نموذج (ب)";
    if (examModels.activeModelKey === "C") return "نموذج (ج)";
    return "نموذج (أ)";
  };

  // Helper to remove any duplicate numbering prefix in question preview
  const cleanStem = (t: string) => {
    if (!t) return "";
    return t.replace(/^(\s*(س\s*\d+|Q\s*\d+|\d+)[\s:.\-\)]+)/i, "").trim();
  };

  // Pointer event handlers for Lasso, Hand Pan, and Rect marquee tool
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isExtracting) return;

    if ((e.target as HTMLElement).closest(".floating-extract-btn")) {
      return;
    }

    const container = imageContainerRef.current;
    if (!container) return;

    // 1. Hand Pan Tool
    if (viewerTool === "hand") {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      });
      return;
    }

    if (!isSelectionPenActive) return;

    // Determine target container: either specific PDF page or imgElementRef
    let targetEl: HTMLElement | null = null;
    let targetPageNum = 1;

    if (pdfDoc && pdfTotalPages > 0) {
      const pageWrapper = (e.target as HTMLElement).closest<HTMLElement>(".pdf-page-wrapper");
      if (pageWrapper) {
        targetEl = pageWrapper;
        targetPageNum = Number(pageWrapper.dataset.pageNumber) || 1;
      }
    } else {
      targetEl = imgElementRef.current;
    }

    if (!targetEl) return;

    setActivePdfCropPage(targetPageNum);
    activePdfCropPageRef.current = targetPageNum;

    const imgRect = targetEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
    const y = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));

    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setExtractionFeedback(null);

    // 2. Lasso Tool (Photoshop-like freehand polygon selection)
    if (viewerTool === "lasso") {
      setIsDrawingLasso(true);
      lassoPointsRef.current = [{ x, y }];
      setLassoPoints([{ x, y }]);
      setCompletedCrop(null);
      setCurrentCrop(null);
      return;
    }

    // 3. Rect Tool
    if (viewerTool === "rect") {
      setIsDraggingCrop(true);
      setStartPos({ x, y });
      setCurrentCrop({ x, y, width: 0, height: 0 });
      setCompletedCrop(null);
      setLassoPoints([]);
      lassoPointsRef.current = [];
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Hand Pan movement
    if (viewerTool === "hand" && isPanning && panStart && imageContainerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      imageContainerRef.current.scrollLeft = panStart.scrollLeft - dx;
      imageContainerRef.current.scrollTop = panStart.scrollTop - dy;
      return;
    }

    // 2. Lasso freehand drawing with smooth 60fps rAF throttle
    if (viewerTool === "lasso" && isDrawingLasso) {
      let targetEl: HTMLElement | null = null;
      if (pdfDoc && pdfTotalPages > 0) {
        targetEl = document.getElementById(`pdf-page-container-${activePdfCropPageRef.current}`);
      } else {
        targetEl = imgElementRef.current;
      }
      if (!targetEl) return;

      const imgRect = targetEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
      const y = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));

      const pts = lassoPointsRef.current;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) >= 3) {
        pts.push({ x, y });
        if (!lassoRafRef.current) {
          lassoRafRef.current = requestAnimationFrame(() => {
            setLassoPoints([...lassoPointsRef.current]);
            lassoRafRef.current = null;
          });
        }
      }
      return;
    }

    // 3. Rect dragging with smooth rAF throttle
    if (viewerTool === "rect" && isDraggingCrop && startPos) {
      let targetEl: HTMLElement | null = null;
      if (pdfDoc && pdfTotalPages > 0) {
        targetEl = document.getElementById(`pdf-page-container-${activePdfCropPageRef.current}`);
      } else {
        targetEl = imgElementRef.current;
      }
      if (!targetEl) return;

      const imgRect = targetEl.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
      const currentY = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));

      const x = Math.min(startPos.x, currentX);
      const y = Math.min(startPos.y, currentY);
      const width = Math.abs(currentX - startPos.x);
      const height = Math.abs(currentY - startPos.y);

      if (!rectRafRef.current) {
        rectRafRef.current = requestAnimationFrame(() => {
          setCurrentCrop({ x, y, width, height });
          rectRafRef.current = null;
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Hand Pan release
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // 2. Lasso release: compute bounding box
    if (isDrawingLasso) {
      setIsDrawingLasso(false);
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (lassoPoints.length >= 3) {
        const xs = lassoPoints.map((p) => p.x);
        const ys = lassoPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;

        if (width > 15 && height > 15) {
          setCompletedCrop({ x: minX, y: minY, width, height });
        } else {
          setLassoPoints([]);
          setCompletedCrop(null);
        }
      } else {
        setLassoPoints([]);
        setCompletedCrop(null);
      }
      return;
    }

    // 3. Rect release
    if (isDraggingCrop) {
      setIsDraggingCrop(false);
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (currentCrop && currentCrop.width > 20 && currentCrop.height > 20) {
        setCompletedCrop(currentCrop);
      } else {
        setCurrentCrop(null);
        setCompletedCrop(null);
      }
    }
  };

  // Helper to crop base64 image from selected region (Polygon Lasso clipping or Rect)
  const getCroppedImageBase64 = (crop: CropRect): Promise<string> => {
    return new Promise((resolve) => {
      let img: HTMLImageElement | null = null;
      if (pdfDoc && pdfTotalPages > 0) {
        const pageContainer = document.getElementById(`pdf-page-container-${activePdfCropPageRef.current}`);
        img = pageContainer ? pageContainer.querySelector("img") : null;
      }
      if (!img) {
        img = imgElementRef.current;
      }
      if (!img) {
        resolve("");
        return;
      }

      const canvas = document.createElement("canvas");
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      // When Lasso points exist, apply polygon clipping path
      if (lassoPoints.length >= 3) {
        const xs = lassoPoints.map((p) => p.x);
        const ys = lassoPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;

        canvas.width = Math.max(1, width * scaleX);
        canvas.height = Math.max(1, height * scaleY);
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.imageSmoothingQuality = "high";
          // Crisp white background for optimal OCR extraction
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Clip strictly to the lasso polygon boundary
          ctx.beginPath();
          lassoPoints.forEach((pt, i) => {
            const px = (pt.x - minX) * scaleX;
            const py = (pt.y - minY) * scaleY;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.clip();

          // Draw the image within the lasso bounds
          ctx.drawImage(
            img,
            minX * scaleX,
            minY * scaleY,
            width * scaleX,
            height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
          );
        }
      } else {
        // Standard rectangle crop
        canvas.width = Math.max(1, crop.width * scaleX);
        canvas.height = Math.max(1, crop.height * scaleY);
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            img,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
          );
        }
      }

      // JPEG (on a white background) is ~5-10x smaller than PNG for large passage
      // regions, which makes upload + Gemini processing much faster.
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    });
  };

  // Extract questions from selected region (Gemini Vision OCR + Structuring)
  const handleExtractAndDrag = async () => {
    if (!completedCrop || isExtracting) return;

    setIsExtracting(true);
    setExtractProgress(12);
    setExtractionFeedback(null);

    if (extractProgressIntervalRef.current) {
      clearInterval(extractProgressIntervalRef.current);
    }
    extractProgressIntervalRef.current = setInterval(() => {
      setExtractProgress((prev) => {
        if (prev < 42) return prev + Math.floor(Math.random() * 8) + 6;
        if (prev < 78) return prev + Math.floor(Math.random() * 5) + 3;
        if (prev < 94) return prev + Math.floor(Math.random() * 2) + 1;
        return prev;
      });
    }, 150);

    try {
      let croppedBase64 = await getCroppedImageBase64(completedCrop);
      if (!croppedBase64) {
        if (extractProgressIntervalRef.current) clearInterval(extractProgressIntervalRef.current);
        setExtractionFeedback("تعذر قص الصورة المحددة.");
        setIsExtracting(false);
        return;
      }

      const res = await fetch("/api/ocr-extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(geminiApiKey ? { "x-gemini-key": geminiApiKey } : {}),
        },
        body: JSON.stringify({
          imageBase64: croppedBase64,
          apiKey: geminiApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (extractProgressIntervalRef.current) clearInterval(extractProgressIntervalRef.current);
      setExtractProgress(100);

      if (data.needsApiKey) {
        setIsGeminiModalOpen(true);
        setExtractionFeedback("يرجى إدخال مفتاح الـ API لتفعيل الاستخراج.");
        setIsExtracting(false);
        return;
      }

      if (!data.success) {
        setExtractionFeedback(data.error || "تعذر استخراج النص من الصورة.");
        setIsExtracting(false);
        return;
      }

      const extractedList: any[] =
        Array.isArray(data.questions) && data.questions.length > 0
          ? data.questions
          : data.parsedQuestion
          ? [data.parsedQuestion]
          : [];

      const returnedPassage = String(data.passageText || data.rawText || "").trim();
      // A passage-only selection legitimately returns zero questions — keep it as a passage.
      const treatAsPassage = isPassageLassoWaiting || (extractedList.length === 0 && returnedPassage.length > 30);

      if (extractedList.length === 0 && !treatAsPassage) {
        setExtractionFeedback("لم يتم العثور على أي سؤال واضح في المنطقة المحددة.");
        setIsExtracting(false);
        return;
      }

      const startIndex = examQuestions.length;
      const newItems: ExamQuestionItem[] = extractedList.map((pQ, i) => ({
        id: `q-extracted-${Date.now()}-${i}`,
        type: (pQ.type as any) || (Array.isArray(pQ.options) && pQ.options.length > 0 ? "choice" : "essay"),
        text: pQ.text || "",
        options: Array.isArray(pQ.options) ? pQ.options : [],
        correctOptionIndex: typeof pQ.correctOptionIndex === "number" ? pQ.correctOptionIndex : undefined,
        points: pQ.points || (pQ.type === "choice" ? 2 : pQ.type === "trueFalse" ? 1 : 5),
        isExtractedByOcr: true,
        engineUsed: data.engine || "gemini",
        optionsLayout: pQ.optionsLayout,
        answerLinesCount: pQ.answerLinesCount,
        passageText: pQ.passageText,
        passageTitle: pQ.passageTitle,
        subType: pQ.subType,
      }));

      const isEnglishExam =
        newItems.some((item) => /[a-zA-Z]{3,}/.test(item.text) || (item.options && item.options.some(o => /[a-zA-Z]{3,}/.test(o)))) ||
        (newItems.length === 0 && /[a-zA-Z]{3,}/.test(returnedPassage));
      if (examQuestions.length === 0 && isEnglishExam) {
        setExamDirection("ltr");
        setChoiceFormat("english_lower");
      }

      if (treatAsPassage) {
        setIsPassageLassoWaiting(false);
        const extractedPassage = (data.passageText || extractedList.find((q) => q.passageText)?.passageText || data.rawText || "").trim();
        const extractedTitle = (data.passageTitle || extractedList.find((q) => q.passageTitle)?.passageTitle || "").trim();

        if (extractedPassage) {
          const isEnglish = /[a-zA-Z]{3,}/.test(extractedPassage);
          const standalonePassageItem: ExamQuestionItem = {
            id: `passage-${Date.now()}`,
            type: "passage",
            text: "",
            options: [],
            points: 0,
            passageText: extractedPassage,
            passageTitle: extractedTitle || (isEnglish ? "• Read the following passage, then answer the questions:" : "• اقرأ القطعة التالية ثم أجب عن الأسئلة:"),
            subType: "passage",
          };

          // In passage mode, strictly extract the passage itself without adding any automated dummy question
          const updatedWithPassage = [...examQuestions, standalonePassageItem];
          setExamQuestions(updatedWithPassage);
          pushHistorySnapshot(updatedWithPassage);
          setExtractionFeedback("تم استخراج قطعة الفهم كعنصر مستقل بنجاح!");
          setFocusedQuestionIndex(startIndex);
        } else {
          const updated = [...examQuestions, ...newItems];
          setExamQuestions(updated);
          pushHistorySnapshot(updated);
          setExtractionFeedback("تم استخراج المحتوى بنجاح");
        }
      } else {
        // Filter out dummy passage instructions that are not real questions
        const filteredNewItems = newItems.filter((item) => {
          if (item.options && item.options.length > 0) return true;
          const lower = item.text.toLowerCase().trim();
          if (/^•?\s*read the (?:following )?passage/i.test(lower) || /^•?\s*اقرأ القطعة/i.test(lower)) {
            return false;
          }
          return true;
        });
        const updated = [...examQuestions, ...(filteredNewItems.length > 0 ? filteredNewItems : newItems)];
        setExamQuestions(updated);
        pushHistorySnapshot(updated);

        setQuestionStyles((prev) => {
          const next = { ...prev };
          newItems.forEach((_, idx) => {
            next[startIndex + idx] = {
              fontSize: globalFontSize,
              isBold: false,
              textAlign: (isEnglishExam || examDirection === "ltr") ? "left" : "right",
            };
          });
          return next;
        });

        setFocusedQuestionIndex(startIndex);
        setExtractionFeedback(
          data.engine === "gemini" ? `تم استخراج ${newItems.length} سؤال بنجاح` : "تم استخراج السؤال"
        );
      }

      setTimeout(() => {
        setCompletedCrop(null);
        setCurrentCrop(null);
        setLassoPoints([]);
        setExtractionFeedback(null);
        setExtractProgress(0);
      }, 1600);
    } catch (err) {
      console.error(err);
      if (extractProgressIntervalRef.current) clearInterval(extractProgressIntervalRef.current);
      setExtractionFeedback("حدث خطأ أثناء استخراج النص.");
    } finally {
      if (extractProgressIntervalRef.current) clearInterval(extractProgressIntervalRef.current);
      setIsExtracting(false);
    }
  };

  // AI Action on a single question
  const handleRefineQuestion = async (
    index: number,
    task: "organize" | "fix_typos" | "solve" | "generate_distractors"
  ) => {
    const targetQ = examQuestions[index];
    if (!targetQ || refiningIndex !== null) return;

    if (!isGeminiActive) {
      setIsGeminiModalOpen(true);
      return;
    }

    setRefiningIndex(index);
    setRefiningTask(task);

    try {
      const res = await fetch("/api/refine-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(geminiApiKey ? { "x-gemini-key": geminiApiKey } : {}),
        },
        body: JSON.stringify({
          question: targetQ,
          task,
          apiKey: geminiApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (data.needsApiKey) {
        setIsGeminiModalOpen(true);
        return;
      }

      if (data.success && data.question) {
        const refined = data.question;
        const updated = [...examQuestions];
        updated[index] = {
          ...updated[index],
          text: refined.text || updated[index].text,
          options:
            Array.isArray(refined.options) && refined.options.length > 0 ? refined.options : updated[index].options,
          correctOptionIndex:
            typeof refined.correctOptionIndex === "number"
              ? refined.correctOptionIndex
              : updated[index].correctOptionIndex,
          type: refined.type || updated[index].type,
          points: refined.points || updated[index].points,
        };
        setExamQuestions(updated);
        pushHistorySnapshot(updated);

        setSaveStatus(
          task === "solve"
            ? "تم تحديد الإجابة النموذجية"
            : task === "organize"
            ? "تم فصل الاختيارات"
            : task === "fix_typos"
            ? "تم تنسيق المعادلات"
            : "تم إضافة خيارات"
        );
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        alert(data.error || "تعذرت معالجة السؤال.");
      }
    } catch {
      alert("خطأ في الاتصال بالخدمة.");
    } finally {
      setRefiningIndex(null);
      setRefiningTask(null);
    }
  };

  // AI Exam Polish (Batch organize on all questions)
  const handleBatchPolishExam = async () => {
    if (examQuestions.length === 0 || isBatchRefining) return;
    if (!isGeminiActive) {
      setIsGeminiModalOpen(true);
      return;
    }

    setIsBatchRefining(true);
    setSaveStatus("جاري تنظيم وتنسيق جميع أسئلة الامتحان...");

    try {
      const updated = [...examQuestions];
      for (let i = 0; i < updated.length; i++) {
        const res = await fetch("/api/refine-question", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(geminiApiKey ? { "x-gemini-key": geminiApiKey } : {}),
          },
          body: JSON.stringify({
            question: updated[i],
            task: "organize",
            apiKey: geminiApiKey || undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.question) {
          updated[i] = {
            ...updated[i],
            text: data.question.text || updated[i].text,
            options:
              Array.isArray(data.question.options) && data.question.options.length > 0
                ? data.question.options
                : updated[i].options,
            correctOptionIndex:
              typeof data.question.correctOptionIndex === "number"
                ? data.question.correctOptionIndex
                : updated[i].correctOptionIndex,
          };
        }
      }
      setExamQuestions(updated);
      pushHistorySnapshot(updated);
      setSaveStatus("تم تنظيم وتنسيق كافة الأسئلة بنجاح!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus("حدث خطأ أثناء التنسيق الشامل.");
    } finally {
      setIsBatchRefining(false);
    }
  };

  // Add Question Manually
  const handleAddQuestionManually = () => {
    const newQuestion: ExamQuestionItem = {
      id: `q-manual-${Date.now()}`,
      type: "choice",
      text: examDirection === "ltr" ? "New Question: Choose the correct option:" : "سؤال جديد: اختر الإجابة الصحيحة:",
      options:
        examDirection === "ltr"
          ? ["Option A", "Option B", "Option C", "Option D"]
          : ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
      correctOptionIndex: 0,
      points: 2,
    };
    const updated = [...examQuestions, newQuestion];
    setExamQuestions(updated);
    pushHistorySnapshot(updated);
    setFocusedQuestionIndex(updated.length - 1);
  };

  // Remove Question
  const handleRemoveQuestion = (index: number) => {
    const updated = examQuestions.filter((_, i) => i !== index);
    setExamQuestions(updated);
    pushHistorySnapshot(updated);
    if (focusedQuestionIndex >= updated.length) {
      setFocusedQuestionIndex(Math.max(0, updated.length - 1));
    }
  };

  // Update Question Text
  const handleUpdateQuestionText = (index: number, newText: string) => {
    const updated = [...examQuestions];
    updated[index].text = newText;
    setExamQuestions(updated);
    scheduleTextHistorySnapshot(updated);
  };

  // Update Question Option Text
  const handleUpdateOptionText = (qIndex: number, optIndex: number, newText: string) => {
    const updated = [...examQuestions];
    const newOptions = [...updated[qIndex].options];
    newOptions[optIndex] = newText;
    updated[qIndex].options = newOptions;
    setExamQuestions(updated);
    scheduleTextHistorySnapshot(updated);
  };

  // Add Option to Question
  const handleAddOption = (qIndex: number) => {
    const updated = [...examQuestions];
    const labelNum = updated[qIndex].options.length + 1;
    updated[qIndex].options.push(examDirection === "ltr" ? `Option ${labelNum}` : `خيار جديد (${labelNum})`);
    setExamQuestions(updated);
    pushHistorySnapshot(updated);
  };

  // Remove Option from Question
  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...examQuestions];
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== optIndex);
    setExamQuestions(updated);
    pushHistorySnapshot(updated);
  };

  // Toggle Correct Option
  const handleToggleCorrectOption = (qIndex: number, optIndex: number) => {
    const updated = [...examQuestions];
    updated[qIndex].correctOptionIndex =
      updated[qIndex].correctOptionIndex === optIndex ? undefined : optIndex;
    setExamQuestions(updated);
    pushHistorySnapshot(updated);
  };

  // Change Question Type
  const handleChangeQuestionType = (index: number, newType: "choice" | "trueFalse" | "essay") => {
    const updated = [...examQuestions];
    updated[index].type = newType;
    if (newType === "trueFalse") {
      updated[index].options = examDirection === "ltr" ? ["True", "False"] : ["صح", "خطأ"];
      updated[index].correctOptionIndex = 0;
    } else if (newType === "choice" && updated[index].options.length === 0) {
      updated[index].options =
        examDirection === "ltr"
          ? ["Option A", "Option B", "Option C", "Option D"]
          : ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"];
    }
    setExamQuestions(updated);
    pushHistorySnapshot(updated);
  };

  // Change Points
  const handleChangePoints = (index: number, newPoints: number) => {
    const updated = [...examQuestions];
    updated[index].points = Math.max(1, newPoints);
    setExamQuestions(updated);
  };

  // Drag and Drop Question Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...examQuestions];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, draggedItem);

    const reorderedStyles: Record<number, QuestionStyle> = {};
    updated.forEach((_, newIdx) => {
      reorderedStyles[newIdx] = getQuestionStyle(newIdx);
    });

    setExamQuestions(updated);
    pushHistorySnapshot(updated);
    setQuestionStyles(reorderedStyles);
    setFocusedQuestionIndex(dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Global listener to ensure pale/faded draggedIndex is NEVER stuck if drag aborts
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedIndex(null);
      setDragOverIndex(null);
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("mouseup", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("mouseup", handleGlobalDragEnd);
    };
  }, []);

  // Helper to get 1-based sequential display number for questions (excluding standalone passages)
  const getQuestionDisplayNumber = useCallback(
    (targetIndex: number, list: ExamQuestionItem[]) => {
      let count = 0;
      for (let i = 0; i <= targetIndex; i++) {
        if (list[i] && list[i].type !== "passage") {
          count++;
        }
      }
      return count;
    },
    []
  );

  // -------------------------------------------------------------
  // DYNAMIC A4 MULTI-PAGE PAGINATION ALGORITHM (حل جذري للمسافة الذكية واستغلال مساحة الصفحة)
  // "ممنوع تقسيم سوال علي صفحتين" - Each question stays intact!
  // Prevents questions overflowing page boundaries while eliminating blank voids at bottom
  // -------------------------------------------------------------
  const computePageSlots = useCallback(
    (questionsList: ExamQuestionItem[]): PageSlot[] => {
      if (!questionsList || questionsList.length === 0) {
        return [{ pageNumber: 1, questionIndices: [] }];
      }

      // Safe unified A4 printable capacity:
      // Page 1 has exam-header-box (~95px) + paddings -> cleanly holds 7 questions without any cut-off
      // Subsequent pages have no header -> cleanly holds 8 questions without any cut-off
      const PAGE_1_CAPACITY = 800;
      const PAGE_N_CAPACITY = 900;

      const slots: PageSlot[] = [{ pageNumber: 1, questionIndices: [] }];
      let currentPageIdx = 0;
      let currentHeight = 0;

      questionsList.forEach((q, idx) => {
        let totalQuestionHeight = 0;

        if (q.type === "passage") {
          // Dedicated passage block
          const pChars = (q.passageText || "").length;
          const pLines = Math.max(1, Math.ceil(pChars / 95));
          const pLineHeight = globalFontSize * 1.35;
          totalQuestionHeight = 26 + pLines * pLineHeight + 20;
        } else {
          // Line count calculation
          const isArabic = /[\u0600-\u06FF]/.test(q.text || "");
          const charLimit = isArabic ? 75 : 90;
          const lines = Math.max(1, Math.ceil((q.text || "").length / charLimit));
          const textHeight = 8 + lines * (globalFontSize * 1.35);

          const isVertical =
            q.optionsLayout === "vertical" ||
            (q.optionsLayout !== "grid" && (
              q.subType === "translation" ||
              (q.options && q.options.some((opt) => opt.length > 38)) ||
              (q.options && q.options.length > 0 && q.options.reduce((sum, o) => sum + o.length, 0) / q.options.length > 28)
            ));

          let optionsHeight = 0;
          if (q.type === "choice") {
            const rows = isVertical ? q.options.length : Math.ceil(Math.max(1, (q.options || []).length) / 2);
            optionsHeight = rows * 26 + 4;
          } else if (q.type === "trueFalse") {
            optionsHeight = 26;
          } else if (q.type === "essay") {
            const linesCount = Math.max(1, q.answerLinesCount || 2);
            optionsHeight = linesCount * 18 + 6;
          }

          const passageHeight = q.passageText
            ? 24 + Math.ceil(q.passageText.length / 95) * (globalFontSize * 1.35)
            : 0;

          const imageHeight = q.imageUrl ? 110 : 0;
          const cardExtra = 14;
          totalQuestionHeight = textHeight + optionsHeight + passageHeight + imageHeight + cardExtra;
        }

        const capacity = currentPageIdx === 0 ? PAGE_1_CAPACITY : PAGE_N_CAPACITY;

        // 15px cushion ensures full page utilization without overflowing into footer
        const SOFT_CUSHION = 15;
        if (currentHeight + totalQuestionHeight > capacity + SOFT_CUSHION && slots[currentPageIdx].questionIndices.length > 0) {
          currentPageIdx++;
          slots.push({ pageNumber: currentPageIdx + 1, questionIndices: [idx] });
          currentHeight = totalQuestionHeight;
        } else {
          slots[currentPageIdx].questionIndices.push(idx);
          currentHeight += totalQuestionHeight;
        }
      });

      return slots;
    },
    [globalFontSize]
  );

  const pages: PageSlot[] = useMemo(() => {
    return computePageSlots(examQuestions);
  }, [computePageSlots, examQuestions]);

  // Dynamic sheets calculation for single model or sequential ALL models view
  const sheetsToRender = useMemo(() => {
    if (examModels && examModels.modelCount > 1 && examModels.activeModelKey === "ALL") {
      const list: {
        modelKey: "A" | "B" | "C";
        modelBadge: string;
        questions: ExamQuestionItem[];
        page: PageSlot;
        totalPages: number;
      }[] = [];

      const modelsList: Array<{ key: "A" | "B" | "C"; name: string; q: ExamQuestionItem[] }> = [
        { key: "A", name: "نموذج (أ)", q: examModels.models.A.questions },
        { key: "B", name: "نموذج (ب)", q: examModels.models.B?.questions || [] },
      ];
      if (examModels.modelCount === 3 && examModels.models.C) {
        modelsList.push({ key: "C", name: "نموذج (ج)", q: examModels.models.C.questions });
      }

      modelsList.forEach((m) => {
        const slots = computePageSlots(m.q);
        slots.forEach((s) => {
          list.push({
            modelKey: m.key,
            modelBadge: m.name,
            questions: m.q,
            page: s,
            totalPages: slots.length,
          });
        });
      });

      return list;
    }

    const badge = getCurrentModelBadge();
    return pages.map((p) => ({
      modelKey: (examModels?.activeModelKey as "A" | "B" | "C") || "A",
      modelBadge: badge || "",
      questions: examQuestions,
      page: p,
      totalPages: pages.length,
    }));
  }, [examModels, examQuestions, pages, computePageSlots]);

  // Option Label Helper (Arabic: أ ب ج د / English: A B C D)
  const getOptionLabel = (idx: number) => {
    if (choiceFormat === "english_upper") {
      return ["A", "B", "C", "D", "E", "F"][idx] || String(idx + 1);
    }
    if (choiceFormat === "english_lower") {
      return ["a", "b", "c", "d", "e", "f"][idx] || String(idx + 1);
    }
    return ["أ", "ب", "ج", "د", "هـ", "و"][idx] || String(idx + 1);
  };

  // Annotation Drawing Event Handlers
  const handleStartDrawing = (e: React.PointerEvent, pageNumber: number) => {
    if (activeDrawTool === "pointer") return;

    const svgEl = e.currentTarget as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeDrawTool === "eraser") {
      // Delete strokes near pointer
      const updated = strokes.filter((s) => {
        if (s.pageNumber !== pageNumber) return true;
        return !s.points.some((p) => Math.hypot(p.x - x, p.y - y) < 18);
      });
      setStrokes(updated);
      pushHistorySnapshot(examQuestions, freeCanvasImages, updated);
      return;
    }

    svgEl.setPointerCapture(e.pointerId);
    const newStroke: DrawStroke = {
      id: `stroke-${Date.now()}`,
      pageNumber,
      points: [{ x, y }],
      color: activeDrawTool === "highlighter" ? activeColor : activeColor,
      size: activeBrushSize,
      isHighlighter: activeDrawTool === "highlighter",
    };
    setCurrentStroke(newStroke);
  };

  const handleDrawingMove = (e: React.PointerEvent, pageNumber: number) => {
    if (!currentStroke || currentStroke.pageNumber !== pageNumber) {
      if (activeDrawTool === "eraser" && e.buttons === 1) {
        const svgEl = e.currentTarget as SVGSVGElement;
        const rect = svgEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const updated = strokes.filter((s) => {
          if (s.pageNumber !== pageNumber) return true;
          return !s.points.some((p) => Math.hypot(p.x - x, p.y - y) < 20);
        });
        setStrokes(updated);
      }
      return;
    }

    const svgEl = e.currentTarget as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, { x, y }] } : null));
  };

  const handleDrawingEnd = (e: React.PointerEvent) => {
    if (currentStroke) {
      try {
        (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      } catch {}
      const updatedStrokes = [...strokes, currentStroke];
      setStrokes(updatedStrokes);
      setCurrentStroke(null);
      pushHistorySnapshot(examQuestions, freeCanvasImages, updatedStrokes);
    }
  };

  const handleClearPageStrokes = (pageNumber: number) => {
    const updated = strokes.filter((s) => s.pageNumber !== pageNumber);
    setStrokes(updated);
    pushHistorySnapshot(examQuestions, freeCanvasImages, updated);
    setSaveStatus("تم مسح الرسومات والتحديدات لهذه الصفحة");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const activeCrop = isDraggingCrop ? currentCrop : completedCrop;

  return (
    <div className="h-full flex flex-col p-3 sm:p-5 overflow-hidden relative select-none print:p-0 print:m-0 print:overflow-visible print:block print:h-auto">
      {/* Hidden file input for document viewer */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,application/pdf"
      />

      {/* Hidden image input for question image attachment */}
      <input
        type="file"
        ref={imageUploadInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
              const dataUrl = uploadEvent.target?.result as string;
              if (dataUrl) handleInsertPastedImage(dataUrl);
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }
        }}
        className="hidden"
        accept="image/*"
      />

      {/* Hidden input for watermark image */}
      <input
        type="file"
        ref={watermarkInputRef}
        onChange={handleWatermarkUpload}
        className="hidden"
        accept="image/*"
      />

      {/* Hidden input for per-question image attachment */}
      <input
        type="file"
        ref={questionImageInputRef}
        onChange={handleQuestionImageSelected}
        className="hidden"
        accept="image/*"
      />

      {/* Hidden image input for Canva-style Free Canvas Image */}
      <input
        type="file"
        ref={freeImageInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
              const dataUrl = uploadEvent.target?.result as string;
              if (dataUrl) handleAddFreeCanvasImage(dataUrl);
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }
        }}
        className="hidden"
        accept="image/*"
      />

      {/* Gemini Settings Modal */}
      <GeminiKeyModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        apiKey={geminiApiKey}
        onSaveKey={handleSaveApiKey}
        hasServerKey={hasServerKey}
      />

      {/* 70% Full Screen Modal: View All Uploaded Files */}
      {isAllFilesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsAllFilesModalOpen(false)}
        >
          <div
            className="w-[70vw] h-[70vh] max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">
                      جميع المستندات والملفات المرفوعة
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                      {uploadedFilesList.length} ملف
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر أي مستند لتحميله مباشرة في قارئ الملفات واستخراج الأسئلة منه
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>رفع مستند جديد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAllFilesModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-white shrink-0">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                <input
                  type="text"
                  value={allFilesModalSearch}
                  onChange={(e) => setAllFilesModalSearch(e.target.value)}
                  placeholder="ابحث بالاسم عن أي كتاب، مذكرة أو مستند..."
                  className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white text-slate-800 transition-colors"
                />
                {allFilesModalSearch && (
                  <button
                    type="button"
                    onClick={() => setAllFilesModalSearch("")}
                    className="absolute left-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal File List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
              {/* Default Sample Textbook */}
              {("كتاب_العلوم_النموذجي.svg".includes(allFilesModalSearch.toLowerCase()) || allFilesModalSearch === "") && (
                <div
                  onClick={() => {
                    setSelectedFile("sample-textbook.svg");
                    setImageSrc("/sample-textbook.svg");
                    setIsAllFilesModalOpen(false);
                    setSaveStatus("تم تحميل المستند: كتاب_العلوم_النموذجي.svg");
                    setTimeout(() => setSaveStatus(null), 2500);
                  }}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    selectedFile === "sample-textbook.svg"
                      ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                      : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">كتاب_العلوم_النموذجي.svg</p>
                      <p className="text-xs text-slate-400 mt-0.5">مستند افتراضي نموذجي للتدريب والتجربة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedFile === "sample-textbook.svg" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                        <span>الملف المعروض حالياً</span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        اختيار وعرض
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Uploaded Files */}
              {uploadedFilesList
                .filter((f) => f.name.toLowerCase().includes(allFilesModalSearch.toLowerCase()))
                .map((f) => {
                  const isCurrent = selectedFile === f.name;
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        handleSelectUploadedFile(f);
                        setIsAllFilesModalOpen(false);
                      }}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">{f.name}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            <span>الحجم: {f.size}</span>
                            {f.date && <span>• تاريخ الرفع: {f.date}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                            <span>الملف المعروض حالياً</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                            اختيار وعرض
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {uploadedFilesList.filter((f) => f.name.toLowerCase().includes(allFilesModalSearch.toLowerCase())).length === 0 && (
                <div className="py-16 text-center text-slate-400 text-sm">
                  لا توجد ملفات تطابق كلمة البحث &quot;{allFilesModalSearch}&quot;
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <span className="font-medium">إجمالي المستندات المحفوظة: {uploadedFilesList.length} مستند</span>
              <button
                type="button"
                onClick={() => setIsAllFilesModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg cursor-pointer transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate File Detection & Replacement Modal */}
      {isDuplicateFileModalOpen && pendingFileToUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => {
            setIsDuplicateFileModalOpen(false);
            setPendingFileToUpload(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-amber-100 flex items-center gap-3.5 bg-amber-50/70 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">الملف موجود بالفعل</h3>
                <p className="text-xs text-slate-500 mt-0.5">تنبيه تكرار اسم المستند المرفوع</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDuplicateFileModalOpen(false);
                  setPendingFileToUpload(null);
                }}
                className="mr-auto p-1.5 text-slate-400 hover:text-slate-700 hover:bg-amber-100/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                الملف باسم <span className="font-bold text-slate-800 dir-ltr inline-block">&quot;{pendingFileToUpload.name}&quot;</span> تم رفعه وموجود مسبقاً في قائمة ملفاتك.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-medium truncate max-w-[200px]">{pendingFileToUpload.name}</span>
                </div>
                <span className="text-slate-400">
                  {pendingFileToUpload.size ? `${(pendingFileToUpload.size / (1024 * 1024)).toFixed(2)} MB` : ""}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                هل ترغب في استبدال الملف الحالي بالملف الجديد، أم التراجع وعدم الرفع؟
              </p>
            </div>

            {/* Modal Footer / Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsDuplicateFileModalOpen(false);
                  setPendingFileToUpload(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                عدم الرفع (إلغاء)
              </button>
              <button
                type="button"
                onClick={() => {
                  const fileToUpload = pendingFileToUpload;
                  setIsDuplicateFileModalOpen(false);
                  setPendingFileToUpload(null);
                  if (fileToUpload) {
                    processDocumentFileUpload(fileToUpload, true);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                استبدال الملف الحالي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Circular Upload Progress Modal for Heavy 200MB+ Files */}
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
                تم رفع وحفظ المستند بنجاح في قاعدة البيانات المحلية!
              </p>
            )}

            {uploadProgress.status === "error" && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-600">
                  {uploadProgress.errorMessage || "فشل رفع الملف."}
                </p>
                <button
                  type="button"
                  onClick={() => setUploadProgress(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reading Comprehension Passage Modal */}
      {isPassageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsPassageModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-rose-100 flex items-center justify-between bg-gradient-to-r from-rose-50 to-pink-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">إضافة قطعة فهم وقراءة (Passage)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">اختر طريقة إضافة نص القطعة لورقة الامتحان</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPassageModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-rose-100/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Option 1: Lasso / Document Selection */}
              <div className="p-4 rounded-xl border-2 border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 transition-all">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <h4 className="font-bold text-sm text-slate-800">تحديد القطعة بالقلم الحر (Lasso) من المستند</h4>
                  </div>
                  <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">استخراج تلقائي</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  حدد القطعة مباشرة من كتابك أو مستندك المعروض. سيتعرف النظام عليها تلقائياً، وسيتجاوز فواصل الصفحات وهوامش الأوراق، ويستخرج الكلمات التي تحتها خط ويربطها بالأسئلة.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsPassageModalOpen(false);
                    setIsPassageLassoWaiting(true);
                    setViewerTool("lasso");
                    setIsSelectionPenActive(true);
                    setSaveStatus("تم تفعيل وضع تحديد القطعة! حدد حول القطعة الآن في المستند.");
                    setTimeout(() => setSaveStatus(null), 3000);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>تفعيل وضع التحديد الحر الآن</span>
                </button>
              </div>

              {/* Option 2: Direct Paste / Manual Typing */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-slate-800">نسخ ولصق أو كتابة نص القطعة مباشرة</h4>
                </div>

                {/* Passage Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    عنوان أو توجيه القطعة (Instructions):
                  </label>
                  <input
                    type="text"
                    value={manualPassageTitle}
                    onChange={(e) => setManualPassageTitle(e.target.value)}
                    placeholder="• Read the following passage, then answer the questions:"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-rose-500 font-medium text-slate-800"
                  />
                </div>

                {/* Passage Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      نص القطعة الكامل:
                    </label>
                    <span className="text-[10px] text-slate-400">
                      يمكنك استخدام &lt;u&gt;الكلمة&lt;/u&gt; لتسطير أي كلمة مهمة
                    </span>
                  </div>
                  <textarea
                    value={manualPassageText}
                    onChange={(e) => setManualPassageText(e.target.value)}
                    rows={6}
                    placeholder="الصق نص القطعة هنا..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-rose-500 leading-relaxed text-slate-800 font-normal resize-y"
                  />
                </div>

                {/* Helper buttons & Target Question */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">إدراج في:</span>
                    <select
                      value={passageTargetIndex}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPassageTargetIndex(val === "new" ? "new" : parseInt(val, 10));
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none"
                    >
                      <option value="new">سؤال جديد مستقل</option>
                      {examQuestions.map((q, idx) => (
                        <option key={q.id || idx} value={idx}>
                          السؤال رقم {idx + 1} ({q.text?.slice(0, 25)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyManualPassage}
                    disabled={!manualPassageText.trim()}
                    className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>إدراج في الامتحان</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm New Exam & Save Modal */}
      {isNewExamConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsNewExamConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-amber-100 flex items-center gap-3.5 bg-amber-50/70 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-800">بدء نموذج اختبار جديد</h3>
                <p className="text-xs text-slate-500 mt-0.5">تأكيد حفظ أو مسح النموذج الحالي</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewExamConfirmOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-amber-100/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                متأكد ده هيمسح النموذج الحالي؟ هل ترغب في حفظه أولاً في الاختبارات المنشأة أم بدء نموذج جديد؟
              </p>

              {/* Title input field for saving */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  تسمية الاختبار (للحفظ في الاختبارات المنشأة):
                </label>
                <input
                  type="text"
                  value={newExamSaveTitle}
                  onChange={(e) => setNewExamSaveTitle(e.target.value)}
                  placeholder="اكتب اسم الاختبار هنا (مثال: اختبار العلوم - النهائي)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-xs font-bold text-slate-800 outline-none transition-all"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400">
                  عند الضغط على &quot;حفظ وبدء جديد&quot;، سيتم تخزين ورقة الاختبار في الاختبارات المنشأة ثم فتح نموذج فارغ.
                </p>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsNewExamConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewExamConfirmOpen(false);
                    handleResetToNewExam(true);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  بدء نموذج جديد
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const finalTitle = newExamSaveTitle.trim() || archiveExamName.trim() || paperTitle.trim() || "ورقة اختبار";
                    setArchiveExamName(finalTitle);
                    await handleSaveExamToDb(finalTitle);
                    setIsNewExamConfirmOpen(false);
                    handleResetToNewExam(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ وبدء جديد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TOP HEADER: Preview Mode Switch, API Key, Title */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0 no-print">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-xl">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight shrink-0">منشئ الاختبارات</h1>
          <div className="relative flex-1">
            <input
              type="text"
              value={archiveExamName}
              onChange={(e) => setArchiveExamName(e.target.value)}
              placeholder="اسم الاختبار للأرشيف (مثال: اختبار العلوم - النهائي)..."
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 transition-all shadow-xs outline-none"
              title="اسم الاختبار للأرشيف - سيتم حفظ ورقة الاختبار بهذا الاسم في أرشيف النماذج"
            />
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* New Clean Exam Button */}
          <button
            onClick={() => {
              if (examQuestions.length > 0 || archiveExamName.trim() || paperTitle.trim()) {
                setNewExamSaveTitle(archiveExamName.trim() || paperTitle.trim() || "ورقة اختبار");
                setIsNewExamConfirmOpen(true);
              } else {
                handleResetToNewExam(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer shadow-xs"
            title="بدء نموذج اختبار جديد وفارغ"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>نموذج جديد</span>
          </button>

          {/* Preview Mode Button */}
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              isPreviewMode
                ? "bg-amber-500 text-white shadow-amber-500/20"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
            title="معاينة شكل ورقة الاختبار الحقيقية للطباعة"
          >
            {isPreviewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
            <span>{isPreviewMode ? "إنهاء المعاينة" : "معاينة الطباعة"}</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
            title="طباعة ورقة الاختبار (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>طباعة</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-sm shadow-blue-500/20"
            title="تحميل أو حفظ الامتحان بصيغة PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل PDF</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Side-by-Side Split Layout (Viewer & Paper) */}
      {/* ======================================================== */}
      <div
        ref={splitContainerRef}
        className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden print:p-0 print:m-0 print:gap-0 print:overflow-visible print:block print:h-auto select-none"
      >
        {/* ======================================================== */}
        {/* 1. RIGHT PANE: Source File Viewer (Draggable width) */}
        {/* Kept mounted during Preview Mode so PDF & scroll stay frozen */}
        {/* ======================================================== */}
        <section
          style={isPreviewMode ? undefined : { width: `${viewerWidthPercent}%` }}
          className={`${
            isPreviewMode ? "hidden" : "w-full h-full flex flex-col"
          } bg-white rounded-2xl shadow-xs overflow-hidden border transition-all no-print shrink-0 ${
            isDragOverViewer ? "border-2 border-dashed border-blue-500 bg-blue-50/20" : "border-slate-200/80"
          }`}
        >
          {/* Top Header of Document Viewer: Real File Dropdown + Upload */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
            {/* Interactive Real File Selector Dropdown */}
            <div className="relative flex-1 max-w-[280px] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsFileDropdownOpen(!isFileDropdownOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-right"
              >
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate flex-1">{selectedFile || "اختر مستنداً أو ارفع ملفاً..."}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setImageSrc(null);
                    setPdfDoc(null);
                    pdfDocRef.current = null;
                    setPdfTotalPages(1);
                    setPdfCurrentPage(1);
                    pdfCurrentPageRef.current = 1;
                    setPdfPageInput("1");
                    setActivePdfCropPage(1);
                    activePdfCropPageRef.current = 1;
                    setPdfPagesCache({});
                    pdfPagesCacheRef.current = {};
                    renderQueueRef.current = [];
                    viewerScrollTopRef.current = 0;
                    viewerScrollLeftRef.current = 0;
                    frozenViewerCache = null;
                    setCompletedCrop(null);
                    setCurrentCrop(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="إغلاق المستند الحالي"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

                {/* Dropdown Menu: Search bar + Latest 4 files + View All Modal trigger */}
                {isFileDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-40 animate-in fade-in">
                    {/* 1. Search Bar */}
                    <div className="px-3 pb-2 border-b border-slate-100">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={dropdownSearch}
                          onChange={(e) => setDropdownSearch(e.target.value)}
                          placeholder="ابحث في الملفات..."
                          className="w-full pl-7 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 focus:bg-white text-slate-700 transition-colors"
                        />
                        {dropdownSearch && (
                          <button
                            type="button"
                            onClick={() => setDropdownSearch("")}
                            className="absolute left-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Section Label: أحدث الملفات */}
                    <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>أحدث 4 ملفات مرفوعة</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({Math.min(4, uploadedFilesList.filter((f) => f.name.toLowerCase().includes(dropdownSearch.toLowerCase())).length)} من {uploadedFilesList.length})
                      </span>
                    </div>

                    {/* Sample Textbook (if matching) */}
                    {("كتاب_العلوم_النموذجي.svg".includes(dropdownSearch.toLowerCase()) || dropdownSearch === "") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile("sample-textbook.svg");
                          setImageSrc("/sample-textbook.svg");
                          setIsFileDropdownOpen(false);
                          setSaveStatus("تم تحديد: كتاب_العلوم_النموذجي.svg");
                          setTimeout(() => setSaveStatus(null), 2000);
                        }}
                        className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          selectedFile === "sample-textbook.svg" ? "bg-blue-50/70 text-blue-700 font-bold" : "text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">كتاب_العلوم_النموذجي.svg</span>
                        </div>
                        {selectedFile === "sample-textbook.svg" && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mr-1" />}
                      </button>
                    )}

                    {/* 2. Latest 4 Uploaded Files */}
                    {uploadedFilesList
                      .filter((f) => f.name.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .slice(0, 4)
                      .map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            handleSelectUploadedFile(f);
                            setIsFileDropdownOpen(false);
                          }}
                          className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                            selectedFile === f.name ? "bg-blue-50/70 text-blue-700 font-bold" : "text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="truncate flex-1">
                              <p className="truncate font-semibold">{f.name}</p>
                              <span className="text-[10px] text-slate-400">{f.size}</span>
                            </div>
                          </div>
                          {selectedFile === f.name && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mr-1" />}
                        </button>
                      ))}

                    {/* Empty Search Fallback */}
                    {uploadedFilesList.filter((f) => f.name.toLowerCase().includes(dropdownSearch.toLowerCase())).length === 0 &&
                      !("كتاب_العلوم_النموذجي.svg".includes(dropdownSearch.toLowerCase())) && (
                        <div className="py-4 text-center text-xs text-slate-400">
                          لا توجد ملفات مطابقة للبحث
                        </div>
                      )}

                    {/* 3. Action Buttons: عرض الكل (70% full screen modal) + رفع جديد */}
                    <div className="border-t border-slate-100 mt-1.5 pt-1.5 px-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileDropdownOpen(false);
                          setIsAllFilesModalOpen(true);
                        }}
                        className="w-full text-right px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>عرض الكل ({uploadedFilesList.length} ملف)</span>
                        </span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-normal">
                          نافذة مخصصة
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileDropdownOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full text-right px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                        <span>رفع مستند جديد من الجهاز...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>رفع ملف</span>
              </button>
            </div>

            {/* Viewer Toolbar: Lasso Tool + Rect Tool + Hand Pan + Zoom Controls */}
            <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between text-xs shrink-0 select-none gap-2 flex-wrap">
              {/* Tool Mode Selectors */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                {/* 1. Lasso Tool (Photoshop-like freehand selection - Default Main Tool) */}
                <button
                  type="button"
                  onClick={() => {
                    setViewerTool("lasso");
                    setIsSelectionPenActive(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewerTool === "lasso" && isSelectionPenActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  title="أداة التحديد الحر (تحديد سؤال) - حدد حول أي سؤال أو رسم بياني بحرية تامة"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>تحديد سؤال</span>
                </button>

                {/* 1.5 Passage Lasso Mode Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPassageLassoWaiting(!isPassageLassoWaiting);
                    setViewerTool("lasso");
                    setIsSelectionPenActive(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isPassageLassoWaiting
                      ? "bg-rose-600 text-white shadow-xs animate-pulse"
                      : "text-rose-700 hover:bg-rose-50"
                  }`}
                  title="تحديد قطعة فهم وقراءة من المستند"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{isPassageLassoWaiting ? "جاري التحديد..." : "تحديد قطعة"}</span>
                </button>

                {/* 2. Rectangle Crop Tool */}
                <button
                  type="button"
                  onClick={() => {
                    setViewerTool("rect");
                    setIsSelectionPenActive(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewerTool === "rect" && isSelectionPenActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  title="تحديد مستطيل تقليدي"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
                  </svg>
                  <span>مستطيل</span>
                </button>

                {/* 3. Hand Drag / Pan Tool */}
                <button
                  type="button"
                  onClick={() => {
                    setViewerTool("hand");
                    setIsSelectionPenActive(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewerTool === "hand"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  title="أداة اليد والتحريك - اسحب للتنقل بحرية وسلاسة داخل الصفحة"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                  </svg>
                  <span>أداة اليد</span>
                </button>
              </div>

              {/* PDF Multi-Page Navigator & Direct Page Jump */}
              {pdfTotalPages > 1 && (
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-bold text-slate-700">
                  {/* Jump to first page */}
                  <button
                    type="button"
                    onClick={() => handleJumpToPdfPage(1)}
                    disabled={pdfCurrentPage <= 1}
                    className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-600 transition-colors cursor-pointer"
                    title="الانتقال إلى أول صفحة (صفحة 1)"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Previous page */}
                  <button
                    type="button"
                    onClick={() => handleJumpToPdfPage(pdfCurrentPage - 1)}
                    disabled={pdfCurrentPage <= 1}
                    className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-600 transition-colors cursor-pointer"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1 font-semibold text-slate-600">
                    <span className="text-[11px]">صفحة</span>
                    <input
                      type="number"
                      min={1}
                      max={pdfTotalPages}
                      value={pdfPageInput}
                      onChange={(e) => setPdfPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const p = parseInt(pdfPageInput, 10);
                          if (!isNaN(p)) handleJumpToPdfPage(p);
                        }
                      }}
                      onBlur={() => {
                        const p = parseInt(pdfPageInput, 10);
                        if (!isNaN(p)) handleJumpToPdfPage(p);
                        else setPdfPageInput(String(pdfCurrentPage));
                      }}
                      className="w-11 text-center font-bold text-xs py-0.5 bg-slate-50 border border-slate-300 rounded-md focus:border-blue-500 focus:bg-white outline-none"
                    />
                    <span className="text-[11px] text-slate-500">من {pdfTotalPages}</span>
                  </div>

                  {/* Next page */}
                  <button
                    type="button"
                    onClick={() => handleJumpToPdfPage(pdfCurrentPage + 1)}
                    disabled={pdfCurrentPage >= pdfTotalPages}
                    className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-600 transition-colors cursor-pointer"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Jump to last page */}
                  <button
                    type="button"
                    onClick={() => handleJumpToPdfPage(pdfTotalPages)}
                    disabled={pdfCurrentPage >= pdfTotalPages}
                    className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-600 transition-colors cursor-pointer"
                    title={`الانتقال إلى آخر صفحة (صفحة ${pdfTotalPages})`}
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Quick Scrubber Slider */}
                  <div className="hidden sm:flex items-center gap-1 px-1">
                    <input
                      type="range"
                      min={1}
                      max={pdfTotalPages}
                      value={pdfCurrentPage}
                      onChange={(e) => handleJumpToPdfPage(Number(e.target.value))}
                      className="w-20 md:w-28 h-1.5 accent-blue-600 bg-slate-200 rounded-lg cursor-pointer"
                      title={`انتقال فوري وسريع (الصفحة الحالية: ${pdfCurrentPage} من ${pdfTotalPages})`}
                    />
                  </div>

                  <div className="h-4 w-px bg-slate-200 mx-0.5" />

                  <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-medium">
                    تمرير متصل
                  </span>
                </div>
              )}

              {/* Zoom & Reset Controls */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                {(completedCrop || lassoPoints.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedCrop(null);
                      setCurrentCrop(null);
                      setLassoPoints([]);
                    }}
                    className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="إلغاء التحديد الحالي (إلغاء القص)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Zoom Out Button */}
                <button
                  type="button"
                  onClick={() => setFileZoom((prev) => Math.max(prev - 15, 50))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer flex items-center gap-1 font-bold"
                  title="تصغير المستند (Zoom Out)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                {/* Zoom Percentage / Reset to 100% */}
                <button
                  type="button"
                  onClick={() => setFileZoom(100)}
                  className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  title="إعادة ضبط التكبير إلى 100%"
                >
                  {fileZoom}%
                </button>

                {/* Zoom In Button */}
                <button
                  type="button"
                  onClick={() => setFileZoom((prev) => Math.min(prev + 15, 250))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer flex items-center gap-1 font-bold"
                  title="تكبير المستند (Zoom In)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Active Passage Selection Banner */}
            {isPassageLassoWaiting && (
              <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-between shadow-xs shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 animate-bounce shrink-0" />
                  <span>🎯 وضع تحديد قطعة الفهم نشط: ارسم بالقلم الحر حول القطعة (حتى لو شملت فواصل أو أسئلة) وسيتم استخراجها وتنسيقها فوراً!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPassageLassoWaiting(false)}
                  className="bg-white/20 hover:bg-white/30 text-white text-[11px] px-2.5 py-0.5 rounded-lg cursor-pointer transition-colors shrink-0"
                >
                  إلغاء الوضع
                </button>
              </div>
            )}

            {/* Large Placeholder Box (Image Viewer with Drag & Drop & Crop) */}
            <div
              onDragEnter={handleViewerDragEnter}
              onDragOver={handleViewerDragOver}
              onDragLeave={handleViewerDragLeave}
              onDrop={handleViewerDrop}
              className="flex-1 m-3 rounded-xl bg-slate-100/70 border border-slate-200 overflow-hidden relative flex flex-col"
            >
              {isDragOverViewer && (
                <div className="pointer-events-none absolute inset-0 z-30 bg-blue-600/90 text-white flex flex-col items-center justify-center gap-2 backdrop-blur-xs">
                  <FileUp className="w-10 h-10 animate-bounce" />
                  <p className="font-bold text-sm">أفلت المستند هنا للرفع والاستعراض الفوري</p>
                </div>
              )}

              {!imageSrc ? (
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-white/60 m-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-all select-none">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-xs border border-blue-100">
                    <FileUp className="w-7 h-7" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base mb-1">
                    منطقة استعراض المستند والقص
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                    لا يوجد ملف مفتوح حالياً. يمكنك رفع ملف PDF أو صورة من جهازك، أو الاختيار من الملفات المرفوعة لبدء قص وتحديد الأسئلة.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع ملف من جهازك</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAllFilesModalOpen(true)}
                      className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span>اختيار من الملفات المرفوعة ({uploadedFilesList.length})</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 mt-4">
                    يدعم ملفات PDF وصور الكتب والامتحانات (PNG, JPG, SVG)
                  </span>
                </div>
              ) : (
                <div
                  ref={imageContainerRef}
                  onScroll={handleViewerScroll}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={
                    viewerTool === "lasso"
                      ? { cursor: PEN_CURSOR_URL }
                      : undefined
                  }
                  className={`flex-1 overflow-auto p-4 flex flex-col items-center relative select-none scroll-smooth ${
                    viewerTool === "hand"
                      ? isPanning
                        ? "cursor-grabbing"
                        : "cursor-grab"
                      : viewerTool === "rect"
                      ? "cursor-crosshair"
                      : ""
                  }`}
                >
                  {pdfDoc && pdfTotalPages > 0 ? (() => {
                    const pageWidth = (fileZoom / 100) * 620;
                    const pageMinHeight = pageWidth * pdfPageAspectRatio;
                    const slotHeight = pageMinHeight + 24; // Page height + 24px (gap-6)
                    const buffer = 3;
                    let virtualStart = Math.max(1, pdfCurrentPage - buffer);
                    let virtualEnd = Math.min(pdfTotalPages, pdfCurrentPage + buffer);

                    // Keep the page currently being cropped or selected active in the DOM
                    if (activePdfCropPage >= 1 && activePdfCropPage <= pdfTotalPages) {
                      virtualStart = Math.min(virtualStart, activePdfCropPage);
                      virtualEnd = Math.max(virtualEnd, activePdfCropPage);
                    }

                    const topSpacerHeight = Math.max(0, (virtualStart - 1) * slotHeight);
                    const bottomSpacerHeight = Math.max(0, (pdfTotalPages - virtualEnd) * slotHeight);

                    const pagesToRender: number[] = [];
                    for (let p = virtualStart; p <= virtualEnd; p++) {
                      pagesToRender.push(p);
                    }

                    return (
                      <div className="flex flex-col items-center gap-6 w-full py-2">
                        {topSpacerHeight > 0 && (
                          <div style={{ height: `${topSpacerHeight}px`, width: "100%", flexShrink: 0 }} aria-hidden="true" />
                        )}

                        {pagesToRender.map((pageNum) => {
                          const pageImg = pdfPagesCache[pageNum];
                          const isActiveCropPage = activePdfCropPage === pageNum;

                          return (
                            <div
                              key={pageNum}
                              id={`pdf-page-container-${pageNum}`}
                              data-page-number={pageNum}
                              className={`pdf-page-wrapper relative shadow-md bg-white rounded-lg overflow-visible shrink-0 transition-shadow ${
                                pdfCurrentPage === pageNum ? "ring-2 ring-blue-500/50 shadow-lg" : ""
                              }`}
                              style={{
                                width: `${pageWidth}px`,
                                minHeight: `${pageMinHeight}px`,
                                cursor: viewerTool === "lasso" ? PEN_CURSOR_URL : undefined,
                              }}
                            >
                              {/* Inner clipped page content to maintain rounded corners while allowing overlays to overflow */}
                              <div className="w-full h-full rounded-lg overflow-hidden relative">
                                {/* Top Page Header Badge */}
                                <div className="absolute top-2 right-2 z-15 bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md pointer-events-none select-none flex items-center gap-1 shadow-sm">
                                  <span>صفحة {pageNum}</span>
                                  <span className="text-slate-400">/ {pdfTotalPages}</span>
                                </div>

                                {/* Document Image or Loading Skeleton */}
                                {pageImg ? (
                                  <img
                                    src={pageImg}
                                    alt={`صفحة ${pageNum}`}
                                    draggable={false}
                                    crossOrigin="anonymous"
                                    style={{ cursor: viewerTool === "lasso" ? PEN_CURSOR_URL : undefined }}
                                    className="w-full h-auto object-contain block pointer-events-none select-none transition-opacity duration-200"
                                  />
                                ) : (
                                  <div
                                    className="w-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-3 select-none relative overflow-hidden transition-all duration-200"
                                    style={{ height: `${pageMinHeight}px` }}
                                  >
                                    <span className="text-5xl font-black text-slate-200/80 select-none">
                                      {pageNum}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3.5 py-1.5 rounded-full shadow-2xs border border-slate-200">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                      <span>جاري تجهيز صفحة {pageNum}...</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Overlays for active crop page */}
                              {isActiveCropPage && (
                                <>
                                  {/* While actively drawing: 100% freehand open polyline (NO auto-close, NO fill) */}
                                  {isDrawingLasso && lassoPoints.length > 1 && (
                                    <svg
                                      className="absolute inset-0 w-full h-full pointer-events-none z-20"
                                      style={{ width: "100%", height: "100%", overflow: "visible" }}
                                    >
                                      <polyline
                                        points={lassoPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                                        fill="none"
                                        stroke="#2563eb"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray="4 4"
                                      />
                                      <circle cx={lassoPoints[0].x} cy={lassoPoints[0].y} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                                    </svg>
                                  )}

                                  {/* After releasing mouse: completed closed polygon with selection highlight */}
                                  {!isDrawingLasso && lassoPoints.length >= 3 && completedCrop && (
                                    <svg
                                      className="absolute inset-0 w-full h-full pointer-events-none z-20"
                                      style={{ width: "100%", height: "100%", overflow: "visible" }}
                                    >
                                      <polygon
                                        points={lassoPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                                        fill={
                                          extractionFeedback
                                            ? "rgba(16, 185, 129, 0.22)"
                                            : "rgba(37, 99, 235, 0.18)"
                                        }
                                        stroke={extractionFeedback ? "#10b981" : "#2563eb"}
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray="5 5"
                                      />
                                    </svg>
                                  )}

                                  {/* Rectangle Marquee Selection Overlay */}
                                  {viewerTool === "rect" && activeCrop && activeCrop.width > 0 && activeCrop.height > 0 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: `${activeCrop.x}px`,
                                        top: `${activeCrop.y}px`,
                                        width: `${activeCrop.width}px`,
                                        height: `${activeCrop.height}px`,
                                      }}
                                      className={`border-2 border-dashed border-blue-600 bg-blue-500/15 pointer-events-none z-20 transition-colors ${
                                        extractionFeedback ? "border-emerald-600 bg-emerald-500/20" : ""
                                      }`}
                                    >
                                      <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                                      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                                      <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                                      <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                                    </div>
                                  )}

                                  {/* Floating Extract Action & Loading Percentage Indicator directly adjacent to selection */}
                                  {completedCrop && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: `${Math.max(8, Math.min(completedCrop.x + (completedCrop.width - 150) / 2, pageWidth - 165))}px`,
                                        top: `${
                                          completedCrop.y + completedCrop.height + 46 > pageMinHeight
                                            ? Math.max(8, completedCrop.y - 40)
                                            : completedCrop.y + completedCrop.height + 8
                                        }px`,
                                      }}
                                      className="floating-extract-btn z-40 pointer-events-auto"
                                    >
                                      {isExtracting ? (
                                        <div className="inline-flex flex-col gap-1 bg-white/95 backdrop-blur-xs text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl shadow-lg animate-in fade-in zoom-in-95">
                                          <div className="flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                                            <span>{isPassageLassoWaiting ? "جاري استخراج القطعة..." : "جاري استخراج السؤال..."}</span>
                                            <span className="font-mono text-blue-600 font-extrabold mr-1">{extractProgress}%</span>
                                          </div>
                                          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                              className="bg-blue-600 h-full rounded-full transition-all duration-150 ease-out"
                                              style={{ width: `${Math.min(100, Math.max(8, extractProgress))}%` }}
                                            />
                                          </div>
                                        </div>
                                      ) : extractionFeedback ? (
                                        <div className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-xs text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl shadow-lg text-xs font-bold animate-in fade-in zoom-in-95 whitespace-nowrap">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>{extractionFeedback}</span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={handleExtractAndDrag}
                                          className={`inline-flex items-center gap-1.5 ${
                                            isPassageLassoWaiting
                                              ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                                              : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                                          } active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer whitespace-nowrap`}
                                        >
                                          {isPassageLassoWaiting ? (
                                            <BookOpen className="w-3.5 h-3.5 text-pink-200" />
                                          ) : (
                                            <FileText className="w-3.5 h-3.5 text-blue-200" />
                                          )}
                                          <span>{isPassageLassoWaiting ? "استخراج القطعة" : "استخراج السؤال"}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}

                        {bottomSpacerHeight > 0 && (
                          <div style={{ height: `${bottomSpacerHeight}px`, width: "100%", flexShrink: 0 }} aria-hidden="true" />
                        )}
                      </div>
                    );
                  })() : (
                    /* Scalable Single Image Container for PNG/JPG */
                    <div
                      style={{
                        width: `${(fileZoom / 100) * 620}px`,
                        minHeight: `${(fileZoom / 100) * 876}px`,
                        cursor: viewerTool === "lasso" ? PEN_CURSOR_URL : undefined,
                      }}
                      className="relative transition-transform duration-150 origin-top shadow-md bg-white rounded-lg overflow-hidden shrink-0"
                    >
                      {/* Document Image */}
                      <img
                        ref={imgElementRef}
                        src={imageSrc || ""}
                        alt="صفحة المستند المصدري"
                        draggable={false}
                        crossOrigin="anonymous"
                        style={{ cursor: viewerTool === "lasso" ? PEN_CURSOR_URL : undefined }}
                        className="w-full h-auto object-contain block pointer-events-none select-none"
                      />

                      {/* While actively drawing: 100% freehand open polyline (NO auto-close, NO fill) */}
                      {isDrawingLasso && lassoPoints.length > 1 && (
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none z-20"
                          style={{ width: "100%", height: "100%", overflow: "visible" }}
                        >
                          <polyline
                            points={lassoPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="4 4"
                          />
                          <circle cx={lassoPoints[0].x} cy={lassoPoints[0].y} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                        </svg>
                      )}

                      {/* After releasing mouse: completed closed polygon with selection highlight */}
                      {!isDrawingLasso && lassoPoints.length >= 3 && completedCrop && (
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none z-20"
                          style={{ width: "100%", height: "100%", overflow: "visible" }}
                        >
                          <polygon
                            points={lassoPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                            fill={
                              extractionFeedback
                                ? "rgba(16, 185, 129, 0.22)"
                                : "rgba(37, 99, 235, 0.18)"
                            }
                            stroke={extractionFeedback ? "#10b981" : "#2563eb"}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="5 5"
                          />
                        </svg>
                      )}

                      {/* Rectangle Marquee Selection Overlay */}
                      {viewerTool === "rect" && activeCrop && activeCrop.width > 0 && activeCrop.height > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            left: `${activeCrop.x}px`,
                            top: `${activeCrop.y}px`,
                            width: `${activeCrop.width}px`,
                            height: `${activeCrop.height}px`,
                          }}
                          className={`border-2 border-dashed border-blue-600 bg-blue-500/15 pointer-events-none z-20 transition-colors ${
                            extractionFeedback ? "border-emerald-600 bg-emerald-500/20" : ""
                          }`}
                        >
                          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                          <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                          <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                        </div>
                      )}

                      {/* Floating Extract Action & Loading Percentage Indicator directly adjacent to selection */}
                      {completedCrop && (
                        <div
                          style={{
                            position: "absolute",
                            left: `${Math.max(8, Math.min(completedCrop.x + (completedCrop.width - 150) / 2, (fileZoom / 100) * 620 - 165))}px`,
                            top: `${
                              completedCrop.y + completedCrop.height + 46 > (fileZoom / 100) * 876
                                ? Math.max(8, completedCrop.y - 40)
                                : completedCrop.y + completedCrop.height + 8
                            }px`,
                          }}
                          className="floating-extract-btn z-40 pointer-events-auto"
                        >
                          {isExtracting ? (
                            <div className="inline-flex flex-col gap-1 bg-white/95 backdrop-blur-xs text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl shadow-lg animate-in fade-in zoom-in-95">
                              <div className="flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                                <span>{isPassageLassoWaiting ? "جاري استخراج القطعة..." : "جاري استخراج السؤال..."}</span>
                                <span className="font-mono text-blue-600 font-extrabold mr-1">{extractProgress}%</span>
                              </div>
                              <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full transition-all duration-150 ease-out"
                                  style={{ width: `${Math.min(100, Math.max(8, extractProgress))}%` }}
                                />
                              </div>
                            </div>
                          ) : extractionFeedback ? (
                            <div className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-xs text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl shadow-lg text-xs font-bold animate-in fade-in zoom-in-95 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{extractionFeedback}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleExtractAndDrag}
                              className={`inline-flex items-center gap-1.5 ${
                                isPassageLassoWaiting
                                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                              } active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer whitespace-nowrap`}
                            >
                              {isPassageLassoWaiting ? (
                                <BookOpen className="w-3.5 h-3.5 text-pink-200" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-blue-200" />
                              )}
                              <span>{isPassageLassoWaiting ? "استخراج القطعة" : "استخراج السؤال"}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stats banner */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between shrink-0">
                <span className="font-medium text-slate-600">
                  {selectedFile ? `المستند: ${selectedFile}` : "لا يوجد مستند مفتوح حالياً"}
                </span>
                {pdfTotalPages > 1 && (
                  <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-[11px]">
                    صفحة {pdfCurrentPage} من {pdfTotalPages}
                  </span>
                )}
              </div>
            </div>
        </section>

        {/* ======================================================== */}
        {/* Draggable Vertical Splitter / Extend Side View Handle */}
        {/* ======================================================== */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingPanes(true);
          }}
          onTouchStart={() => setIsResizingPanes(true)}
          className={`${
            isPreviewMode ? "hidden" : "hidden lg:flex"
          } flex-col items-center justify-center relative z-20 w-4 -mx-1 hover:w-5 transition-all cursor-col-resize group select-none shrink-0 ${
            isResizingPanes ? "w-5" : ""
          }`}
          title="اسحب لتوسيع أو تضييق حجم المعاينة الجانبية للمستند"
        >
          {/* Dividing vertical guide line */}
          <div
            className={`w-1 h-full rounded-full transition-colors ${
              isResizingPanes ? "bg-blue-600 ring-4 ring-blue-500/20" : "bg-slate-300 group-hover:bg-blue-500"
            }`}
          />

          {/* Floating Handle Pill with Red/Blue Double Arrows matching user screenshot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5 px-1 py-3 rounded-full bg-white border shadow-md transition-transform ${
              isResizingPanes
                ? "border-blue-600 text-blue-600 scale-110 shadow-lg ring-2 ring-blue-400"
                : "border-slate-300 text-slate-600 group-hover:border-blue-500 group-hover:text-blue-600"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
              <polyline points="9 18 3 12 9 6" />
            </svg>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
              <polyline points="15 18 21 12 15 6" />
            </svg>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. LEFT PANE: Physical A4 Exam Canvas */}
        {/* ======================================================== */}
        <section
          style={!isPreviewMode ? { width: `${100 - viewerWidthPercent}%` } : undefined}
          className={`h-full flex flex-col bg-slate-200/60 rounded-2xl shadow-xs overflow-hidden border-none print:p-0 print:m-0 print:w-full print:bg-transparent print:overflow-visible print:block print:h-auto flex-1 min-w-0 ${
            isPreviewMode ? "w-full" : ""
          }`}
        >
          {/* ====================================================== */}
          {/* TOOLBAR: Density, Direction, Languages, Pens & Formatting */}
          {/* ====================================================== */}
          {!isPreviewMode && (
            <div className="bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2 border-b border-slate-200 shadow-xs flex flex-col gap-2 shrink-0 select-none no-print">
              {/* Row 1: Document Settings, Direction, Density & Choices Format */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Undo / Redo */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded transition-colors cursor-pointer"
                      title="تراجع (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded transition-colors cursor-pointer"
                      title="إعادة (Ctrl+Y)"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Direction Switcher: Arabic (RTL) vs English (LTR) */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 text-xs">
                    <button
                      onClick={() => setExamDirection("rtl")}
                      className={`px-2 py-1 rounded font-bold transition-colors ${
                        examDirection === "rtl" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="امتحان باللغة العربية (من اليمين لليسار)"
                    >
                      عربي (يمين)
                    </button>
                    <button
                      onClick={() => setExamDirection("ltr")}
                      className={`px-2 py-1 rounded font-bold transition-colors ${
                        examDirection === "ltr" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="English Exam (Left to Right)"
                    >
                      English (Left)
                    </button>
                  </div>

                  {/* Choice Numbering Format: أ ب ج د vs A B C D */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 text-xs">
                    <button
                      onClick={() => setChoiceFormat("arabic")}
                      className={`px-2 py-1 rounded font-bold transition-colors ${
                        choiceFormat === "arabic" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="ترقيم الخيارات: أ - ب - ج - د"
                    >
                      أ ب ج د
                    </button>
                    <button
                      onClick={() => setChoiceFormat("english_upper")}
                      className={`px-2 py-1 rounded font-bold transition-colors ${
                        choiceFormat === "english_upper"
                          ? "bg-white text-blue-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Choice labels: A - B - C - D"
                    >
                      A B C D
                    </button>
                  </div>

                  {/* Multi-Model Generator Button (أ - ب - ج) */}
                  <button
                    type="button"
                    onClick={() => setIsModelModalOpen(true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 ${
                      examModels && examModels.modelCount > 1
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-200"
                        : "bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200/80"
                    }`}
                    title="توليد نماذج متعددة للاختبار لمنع الغش (أ - ب - ج)"
                  >
                    <Shuffle
                      className={`w-3.5 h-3.5 ${
                        examModels && examModels.modelCount > 1 ? "text-white" : "text-indigo-600"
                      }`}
                    />
                    <span>توليد نماذج (أ - ب - ج)</span>
                    {examModels && examModels.modelCount > 1 && (
                      <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black mr-0.5">
                        {examModels.modelCount === 2 ? "أ - ب" : "أ - ب - ج"}
                      </span>
                    )}
                  </button>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleAddQuestionManually}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>إضافة سؤال</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPassageModalOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 text-rose-700 border border-rose-200/80 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                    title="إضافة قطعة قراءة (Passage) سواء بالتحديد أو بالنسخ"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-rose-600" />
                    <span>إضافة قطعة</span>
                  </button>

                  <button
                    onClick={handleBatchPolishExam}
                    disabled={isBatchRefining || examQuestions.length === 0}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isBatchRefining ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    ) : (
                      <ListChecks className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span>تنسيق الأسئلة</span>
                  </button>

                  <button
                    onClick={() => handleSaveExamToDb()}
                    className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Font Size, Alignment, Pens & Highlighters Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Global Font Size Controller */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80">
                    <span className="px-1.5 text-[11px] font-bold text-slate-500 select-none">الخط:</span>
                    <button
                      onClick={() => setGlobalFontSize((prev) => Math.max(prev - 1, 9))}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors cursor-pointer"
                      title="تصغير خط الورقة"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-1.5 text-xs font-bold text-slate-800 select-none min-w-[28px] text-center">
                      {globalFontSize}px
                    </span>
                    <button
                      onClick={() => setGlobalFontSize((prev) => Math.min(prev + 1, 22))}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors cursor-pointer"
                      title="تكبير خط الورقة"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Bold */}
                  <button
                    onClick={() => updateFocusedQuestionStyle((prev) => ({ ...prev, isBold: !prev.isBold }))}
                    className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      currentFocusedStyle.isBold
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                    title="تغميق الخط (عريض)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>

                  {/* Divider */}
                  <div className="w-px h-5 bg-slate-200 mx-1" />

                  {/* =================================================== */}
                  {/* PEN & HIGHLIGHTER ANNOTATION TOOLS */}
                  {/* =================================================== */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 text-xs">
                    {/* Pointer / Edit Mode */}
                    <button
                      type="button"
                      onClick={() => setActiveDrawTool("pointer")}
                      className={`px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors ${
                        activeDrawTool === "pointer"
                          ? "bg-white text-blue-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="وضع التحرير العادي للأسئلة والنصوص"
                    >
                      <span>مؤشر</span>
                    </button>

                    {/* Pen Tool */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrawTool("pen");
                        if (activeColor === "#facc15") setActiveColor("#ef4444");
                        setActiveBrushSize(3);
                      }}
                      className={`px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors ${
                        activeDrawTool === "pen" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="أداة القلم للكتابة والتصحيح والدوائر"
                    >
                      <Pen className="w-3.5 h-3.5 text-red-500" />
                      <span>قلم</span>
                    </button>

                    {/* Highlighter Tool */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrawTool("highlighter");
                        setActiveColor("#facc15");
                        setActiveBrushSize(14);
                      }}
                      className={`px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors ${
                        activeDrawTool === "highlighter"
                          ? "bg-white text-amber-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="هايلايتر شفاف لتمييز وتظليل الكلمات والمعادلات"
                    >
                      <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                      <span>تظليل</span>
                    </button>

                    {/* Eraser Tool */}
                    <button
                      type="button"
                      onClick={() => setActiveDrawTool("eraser")}
                      className={`p-1.5 rounded transition-colors ${
                        activeDrawTool === "eraser"
                          ? "bg-white text-rose-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="ممحاة لحذف خطوط الرسم والتظليل"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Color Palette (When Pen or Highlighter is active) */}
                  {activeDrawTool !== "pointer" && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 animate-in fade-in">
                      {["#facc15", "#22c55e", "#ec4899", "#06b6d4", "#ef4444", "#2563eb", "#1e293b", "#ffffff"].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setActiveColor(col)}
                          style={{ backgroundColor: col }}
                          className={`w-4 h-4 rounded-full border transition-transform ${
                            col === "#ffffff" ? "border-slate-300 shadow-2xs" : "border-black/10"
                          } ${
                            activeColor === col ? "scale-125 ring-2 ring-blue-500" : "hover:scale-110"
                          }`}
                          title={col === "#ffffff" ? "قلم أبيض للتصحيح والمسح" : undefined}
                        />
                      ))}

                      {/* Brush Size Selector */}
                      <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1 mr-1">
                        {[
                          { label: "1x", size: activeDrawTool === "highlighter" ? 10 : 2 },
                          { label: "2x", size: activeDrawTool === "highlighter" ? 16 : 4 },
                          { label: "3x", size: activeDrawTool === "highlighter" ? 24 : 8 },
                        ].map((b) => (
                          <button
                            key={b.label}
                            type="button"
                            onClick={() => setActiveBrushSize(b.size)}
                            className={`px-1 text-[10px] font-bold rounded ${
                              activeBrushSize === b.size ? "bg-slate-200 text-slate-900" : "text-slate-500"
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Watermark Upload & Management Button */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => watermarkInputRef.current?.click()}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                      watermarkImage
                        ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    title="رفع صورة علامة مائية لخلفية كل صفحات الامتحان"
                  >
                    <Droplet className="w-3.5 h-3.5 text-blue-600" />
                    <span>{watermarkImage ? "تغيير العلامة المائية" : "رفع علامة مائية"}</span>
                  </button>
                  {watermarkImage && (
                    <button
                      type="button"
                      onClick={handleRemoveWatermark}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف العلامة المائية"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Notification Banner */}
          {saveStatus && (
            <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-4 py-1.5 text-xs font-semibold flex items-center justify-between animate-in fade-in no-print">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveStatus}</span>
              </span>
              <button onClick={() => setSaveStatus(null)} className="text-emerald-600 hover:text-emerald-800">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* Scrollable Canvas Viewport Rendering PHYSICAL A4 SHEETS */}
          {/* ======================================================== */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex flex-col items-center-safe gap-8 a4-print-container print:p-0 print:m-0 print:gap-0 print:overflow-visible print:block print:w-full [scrollbar-width:thin] print:[scrollbar-width:none] print:[&::-webkit-scrollbar]:hidden">
            {/* Sleek Tab Switcher right above the A4 paper: [ نموذج (أ) | نموذج (ب) | نموذج (ج) | عرض الكل للطباعة ] */}
            {examModels && examModels.modelCount > 1 && (
              <div className="w-full max-w-[680px] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm p-2 flex flex-wrap items-center justify-between gap-2 shrink-0 no-print transition-all">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectModelTab("A")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      examModels.activeModelKey === "A"
                        ? "bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>نموذج (أ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectModelTab("B")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      examModels.activeModelKey === "B"
                        ? "bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-500/20"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <span>نموذج (ب)</span>
                  </button>

                  {examModels.modelCount === 3 && (
                    <button
                      type="button"
                      onClick={() => handleSelectModelTab("C")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        examModels.activeModelKey === "C"
                          ? "bg-white text-purple-700 shadow-xs ring-1 ring-purple-500/20"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      <span>نموذج (ج)</span>
                    </button>
                  )}

                  <div className="h-4 w-px bg-slate-300 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => handleSelectModelTab("ALL")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      examModels.activeModelKey === "ALL"
                        ? "bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-500/20"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                    title="عرض جميع النماذج متتالية وتجهيزها للطباعة المجمعة"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>عرض الكل للطباعة</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReshuffleExistingModels}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="إعادة خلط وترتيب أسئلة النماذج العشوائية"
                  >
                    <RotateCw className="w-3 h-3 text-slate-500" />
                    <span>إعادة خلط الأسئلة</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintAllModels}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
                    title="طباعة جميع النماذج معاً في أمر طباعة واحد"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-200" />
                    <span>طباعة جميع النماذج معاً</span>
                  </button>
                </div>
              </div>
            )}

            {examModels && examModels.modelCount > 1 && examModels.activeModelKey === "ALL" && (
              <div className="w-full max-w-[680px] bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between no-print shadow-2xs">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>معاينة طباعة النماذج المجمعة: يُطبع كل نموذج على ورقة مستقلة تلقائياً.</span>
                </span>
                <button
                  type="button"
                  onClick={handlePrintAllModels}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-extrabold shadow-2xs cursor-pointer"
                >
                  طباعة الكل الآن
                </button>
              </div>
            )}

            {sheetsToRender.map((sheet, sheetIdx) => {
              const page = sheet.page;
              const currentModelBadge = sheet.modelBadge;
              const currentSheetQuestions = sheet.questions;
              const isAllSequentialView = examModels?.activeModelKey === "ALL";

              return (
              <div
                key={`page-${sheet.modelKey}-${page.pageNumber}-${sheetIdx}`}
                id={`a4-sheet-${sheet.modelKey}-${page.pageNumber}`}
                dir={examDirection}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("Files")) {
                    e.preventDefault();
                  }
                }}
                onDrop={(e) => {
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (file.type.startsWith("image/")) {
                      e.preventDefault();
                      e.stopPropagation();
                      const pageEl = document.getElementById(`a4-sheet-${page.pageNumber}`);
                      const rect = pageEl ? pageEl.getBoundingClientRect() : { left: 0, top: 0 };
                      const dropX = Math.max(10, Math.min(500, e.clientX - rect.left));
                      const dropY = Math.max(10, Math.min(800, e.clientY - rect.top));
                      const reader = new FileReader();
                      reader.onload = (uploadEvent) => {
                        const dataUrl = uploadEvent.target?.result as string;
                        if (dataUrl) {
                          const newFreeItem: FreeCanvasItem = {
                            id: `free-img-${Date.now()}`,
                            url: dataUrl,
                            pageNumber: page.pageNumber,
                            x: dropX,
                            y: dropY,
                            width: 180,
                          };
                          const nextFree = [...freeCanvasImages, newFreeItem];
                          setFreeCanvasImages(nextFree);
                          pushHistorySnapshot(examQuestions, nextFree, strokes);
                          setSaveStatus("تم إفلات وإدراج الصورة الحرة في هذا الموضع بنجاح");
                          setTimeout(() => setSaveStatus(null), 2500);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                }}
                className="a4-page-sheet shrink-0 w-[794px] max-w-none min-h-[1123px] bg-white rounded-sm shadow-xl p-[8mm_12mm_10mm_12mm] relative flex flex-col justify-between transition-all border border-slate-200 select-text print:p-[8mm_12mm_10mm_12mm] print:m-0 print:border-none print:shadow-none print:w-[210mm] print:max-w-[210mm] print:h-[297mm] print:max-h-[297mm] print:overflow-hidden print:break-after-page print:[break-after:page] print:[page-break-after:always]"
                style={{
                  minHeight: "1123px",
                  breakAfter: "page",
                  pageBreakAfter: "always",
                }}
              >
                {/* SVG Annotation / Drawing Layer over this A4 Page */}
                <svg
                  className={`absolute inset-0 w-full h-full z-20 ${
                    activeDrawTool === "pointer" ? "pointer-events-none" : "pointer-events-auto"
                  }`}
                  style={{
                    cursor:
                      activeDrawTool === "pen"
                        ? "crosshair"
                        : activeDrawTool === "highlighter"
                        ? "crosshair"
                        : activeDrawTool === "eraser"
                        ? "cell"
                        : "default",
                  }}
                  onPointerDown={(e) => handleStartDrawing(e, page.pageNumber)}
                  onPointerMove={(e) => handleDrawingMove(e, page.pageNumber)}
                  onPointerUp={handleDrawingEnd}
                >
                  {/* Completed strokes */}
                  {strokes
                    .filter((s) => s.pageNumber === page.pageNumber)
                    .map((s) => (
                      <path
                        key={s.id}
                        d={getSvgPathFromPoints(s.points)}
                        stroke={s.color}
                        strokeWidth={s.size}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity={s.isHighlighter ? 0.38 : 1}
                        style={{ mixBlendMode: s.isHighlighter ? "multiply" : "normal" }}
                      />
                    ))}

                  {/* Active drawing stroke */}
                  {currentStroke && currentStroke.pageNumber === page.pageNumber && (
                    <path
                      d={getSvgPathFromPoints(currentStroke.points)}
                      stroke={currentStroke.color}
                      strokeWidth={currentStroke.size}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={currentStroke.isHighlighter ? 0.38 : 1}
                      style={{ mixBlendMode: currentStroke.isHighlighter ? "multiply" : "normal" }}
                    />
                  )}
                </svg>

                {/* Free Canvas Images on this A4 Page */}
                {freeCanvasImages
                  .filter((img) => img.pageNumber === page.pageNumber)
                  .map((img) => (
                    <div
                      key={img.id}
                      style={{
                        position: "absolute",
                        left: `${img.x}px`,
                        top: `${img.y}px`,
                        width: `${img.width}px`,
                        zIndex: 25,
                      }}
                      className="group select-none cursor-move no-print-handle"
                      onPointerDown={(e) => handlePointerDownFreeImage(e, img.id, page.pageNumber)}
                    >
                      <img
                        src={img.url}
                        alt="صورة حرة"
                        className="w-full h-auto object-contain pointer-events-none rounded shadow-xs border border-transparent group-hover:border-blue-500"
                        draggable={false}
                      />
                      {!isPreviewMode && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFreeImage(img.id);
                            }}
                            className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer z-30"
                            title="حذف الصورة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div
                            onPointerDown={(e) => handleStartResizeFreeImage(e, img.id)}
                            className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-30"
                            title="اسحب لتغيير الحجم"
                          />
                        </>
                      )}
                    </div>
                  ))}

                {/* Background Watermark Image */}
                {watermarkImage && (
                  <div
                    className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden z-0"
                    aria-hidden="true"
                  >
                    <img
                      src={watermarkImage}
                      alt="علامة مائية"
                      style={{ opacity: watermarkOpacity }}
                      className="max-w-[70%] max-h-[70%] object-contain select-none"
                      draggable={false}
                    />
                  </div>
                )}

                {/* Main Paper Content Container */}
                <div className="flex-1 flex flex-col relative z-10 min-w-0 main-paper-content">
                  {/* Page 1 Exam Header Box */}
                  {page.pageNumber === 1 ? (
                    <div
                      className="border-2 border-slate-800 rounded-xl p-2.5 sm:p-3 mb-2 relative z-10 bg-white/95 select-none exam-header-box shadow-xs"
                      dir={examDirection}
                    >
                      <div className="flex items-stretch justify-between gap-3 sm:gap-4">
                        {/* Right Column: Exam Title & Student Name */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5 py-0.5">
                          {/* Row 1: Exam Title */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 shrink-0 whitespace-nowrap">
                              {examDirection === "ltr" ? "Exam Title:" : "عنوان الامتحان :"}
                            </span>
                            {!isPreviewMode ? (
                              <input
                                type="text"
                                value={paperTitle}
                                onChange={(e) => setPaperTitle(e.target.value)}
                                onBlur={() => pushHistorySnapshot(examQuestions)}
                                placeholder="اكتب عنوان الامتحان المطبوع على الورقة..."
                                className="flex-1 min-w-0 font-bold text-xs sm:text-sm text-slate-800 bg-transparent border-b border-dashed border-slate-400 focus:border-blue-600 outline-none px-1 py-0.5"
                              />
                            ) : (
                              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">{paperTitle}</span>
                            )}
                          </div>

                          {/* Row 2: Student Name with clean non-overflowing dotted line */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 shrink-0 whitespace-nowrap">
                              {examDirection === "ltr" ? "Student Name:" : "اسم الطالب :"}
                            </span>
                            <div className="flex-1 min-w-0 border-b-2 border-dotted border-slate-400 h-3.5 mr-1 ml-1" />
                          </div>
                        </div>

                        {/* Left Column: Model Badge (Top-Left) & Exam Grade */}
                        <div className="shrink-0 flex flex-col justify-between items-end gap-1.5 min-w-[120px] sm:min-w-[140px]">
                          {/* Top-Left Model Name Badge */}
                          {currentModelBadge && (
                            <div className="w-full flex items-center justify-center bg-slate-900 text-white rounded-lg py-1 px-2.5 shadow-2xs border-2 border-slate-900 print:bg-white print:text-black print:border-2 print:border-black">
                              <span className="font-black text-xs sm:text-sm tracking-wide">
                                {currentModelBadge}
                              </span>
                            </div>
                          )}

                          {/* Bottom: Exam Grade (Bigger & positioned directly underneath Exam Code) */}
                          <div className="w-full flex items-center justify-between gap-1.5 bg-white border-2 border-slate-800 rounded-lg px-2 py-0.5 shadow-2xs">
                            <span className="text-xs font-extrabold text-slate-900 whitespace-nowrap">
                              {examDirection === "ltr" ? "Grade:" : "الدرجة :"}
                            </span>
                            <div className="flex items-center gap-1 font-bold text-xs sm:text-sm">
                              <span className="text-slate-400 font-bold">..... /</span>
                              {!isPreviewMode ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={maxScore}
                                  onChange={(e) => setMaxScore(parseInt(e.target.value, 10) || 20)}
                                  onBlur={() => pushHistorySnapshot(examQuestions)}
                                  className="w-10 text-center font-extrabold text-xs sm:text-sm text-blue-700 bg-slate-50 border border-slate-300 rounded px-0.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                                  title="الدرجة النهائية للامتحان"
                                />
                              ) : (
                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 min-w-[18px] text-center">
                                  {maxScore}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* List of intact questions allocated to this A4 page */}
                  <div className="questions-container w-full max-w-full flex flex-col justify-start gap-[3mm]">
                    {examQuestions.length === 0 && !isPreviewMode && (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/60 my-6 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mb-3" />
                        <h3 className="font-bold text-slate-700 text-sm sm:text-base mb-1">ورقة الاختبار فارغة</h3>
                        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
                          ابدأ بإضافة سؤال جديد يدويًا أو استخدم أداة التحديد وقص الأسئلة من الكتاب/الملف في الجانب المقابل.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddQuestionManually}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          إضافة أول سؤال
                        </button>
                      </div>
                    )}

                    {page.questionIndices.map((index) => {
                      const q = isAllSequentialView
                        ? (currentSheetQuestions[index] || examQuestions[index])
                        : (examQuestions[index] || currentSheetQuestions[index]);
                      if (!q) return null;

                      const style = getQuestionStyle(index);
                      const isFocused = focusedQuestionIndex === index;
                      const isBeingDragged = draggedIndex === index;
                      const isDragTarget = dragOverIndex === index;
                      const isItemRefining = refiningIndex === index;
                      const qNum = getQuestionDisplayNumber(index, isAllSequentialView ? currentSheetQuestions : examQuestions);

                      // Dedicated Standalone Passage Card
                      if (q.type === "passage") {
                        return (
                          <div
                            key={q.id || index}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => {
                              handleDrop(e, index);
                              handleDragEnd();
                            }}
                            onMouseEnter={() => setHoveredQuestionIndex(index)}
                            onMouseLeave={() => setHoveredQuestionIndex(null)}
                            onClick={() => setFocusedQuestionIndex(index)}
                            className={`passage-card group relative shrink-0 transition-all rounded-xl border w-full max-w-full min-w-0 overflow-hidden ${
                              isPreviewMode
                                ? "border-transparent bg-transparent py-1 px-0 shadow-none"
                                : isFocused
                                ? "bg-rose-50/20 border-rose-400 shadow-xs ring-1 ring-rose-400/20 p-2 sm:p-2.5"
                                : "border-slate-200/80 hover:border-slate-300 p-2 bg-slate-50/30"
                            } ${isBeingDragged ? "opacity-30 border-dashed border-rose-600" : ""} ${
                              isDragTarget ? "border-t-2 border-t-rose-600 bg-rose-50/40" : ""
                            }`}
                          >
                            <div className="w-full bg-slate-50/70 border border-slate-200/90 rounded-lg p-2.5 print:bg-transparent print:border-slate-400/80">
                              {/* Passage Header Row with Reorder Grip & Delete Trash */}
                              <div className="flex items-center justify-between mb-1.5 border-b border-slate-200/80 pb-1.5" dir={examDirection}>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 flex-1 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shrink-0" />
                                  {isPreviewMode ? (
                                    <span className="text-slate-900 font-bold text-xs sm:text-sm">
                                      {q.passageTitle || (examDirection === "ltr" ? "• Read the following passage, then choose the correct answer from a, b, c or d:" : "• اقرأ القطعة التالية ثم أجب عن الأسئلة:")}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={q.passageTitle || ""}
                                      onChange={(e) => {
                                        const updated = [...examQuestions];
                                        updated[index].passageTitle = e.target.value;
                                        setExamQuestions(updated);
                                      }}
                                      onBlur={() => pushHistorySnapshot(examQuestions)}
                                      className="w-full bg-transparent font-bold text-xs text-slate-800 border-none outline-none focus:ring-0 p-0"
                                      placeholder="عنوان أو توجيه القطعة (مثلاً: • Read the following passage...)"
                                    />
                                  )}
                                </div>

                                {!isPreviewMode && (
                                  <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity no-print">
                                    <div
                                      draggable={!isPreviewMode}
                                      onDragStart={(e) => handleDragStart(e, index)}
                                      onDragEnd={handleDragEnd}
                                      className="p-1 text-slate-400 hover:text-blue-600 cursor-grab active:cursor-grabbing rounded"
                                      title="اسحب لتغيير موضع وترتيب القطعة"
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveQuestion(index);
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer z-30 pointer-events-auto"
                                      title="حذف هذه القطعة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Passage Text Body */}
                              {isPreviewMode ? (
                                <div
                                  className="text-slate-800 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line text-justify"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizePassageHtml(q.passageText),
                                  }}
                                />
                              ) : (
                                <div className="space-y-1">
                                  <textarea
                                    value={q.passageText || ""}
                                    onChange={(e) => {
                                      const updated = [...examQuestions];
                                      updated[index].passageText = e.target.value;
                                      setExamQuestions(updated);
                                    }}
                                    onBlur={() => pushHistorySnapshot(examQuestions)}
                                    rows={5}
                                    placeholder="نص القطعة القرائية... يمكنك كتابة <u>الكلمة</u> لتسطير أي كلمة مهمة أو **كلمة** للخط العريض."
                                    className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded p-2 focus:border-rose-400 focus:outline-none leading-relaxed resize-y font-normal"
                                  />
                                  <div className="text-[10px] text-slate-400 flex items-center justify-between no-print select-none">
                                    <span>ملاحظة: الكلمات داخل &lt;u&gt;كلمة&lt;/u&gt; ستظهر تحتها خط واضح كما في ورقة الامتحان الأصلية.</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={q.id || index}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              handleQuestionCardDrop(e, index);
                            } else {
                              handleDrop(e, index);
                            }
                            handleDragEnd();
                          }}
                          onMouseEnter={() => setHoveredQuestionIndex(index)}
                          onMouseLeave={() => setHoveredQuestionIndex(null)}
                          onFocusCapture={() => setHoveredQuestionIndex(index)}
                          onClick={() => setFocusedQuestionIndex(index)}
                          className={`question-card group relative shrink-0 transition-all rounded-lg border w-full max-w-full min-w-0 overflow-hidden ${
                            isPreviewMode
                              ? "border-transparent bg-transparent py-[1.5mm] px-0 shadow-none"
                              : isFocused
                              ? "bg-blue-50/20 border-blue-400 shadow-xs ring-1 ring-blue-400/20 p-2 sm:p-2.5"
                              : "border-slate-200/60 hover:border-slate-300 p-2"
                          } ${isBeingDragged ? "opacity-30 border-dashed border-blue-600" : ""} ${
                            isDragTarget ? "border-t-2 border-t-blue-600 bg-blue-50/40" : ""
                          }`}
                        >
                          {/* Reading Comprehension Passage Section (for backwards-compatibility if attached to question) */}
                          {q.passageText && (
                            <div className="mb-3 w-full bg-slate-50/70 border border-slate-200/90 rounded-lg p-2.5 print:bg-transparent print:border-slate-400/80">
                              <div className="flex items-center justify-between mb-1.5 border-b border-slate-200/80 pb-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 flex-1 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                                  {isPreviewMode ? (
                                    <span className="text-slate-900 font-bold">
                                      {q.passageTitle || (examDirection === "ltr" ? "• Read the following passage, then choose the correct answer:" : "• اقرأ القطعة التالية ثم أجب عن الأسئلة:")}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={q.passageTitle || (examDirection === "ltr" ? "• Read the following passage, then choose the correct answer:" : "• اقرأ القطعة التالية ثم أجب عن الأسئلة:")}
                                      onChange={(e) => {
                                        const updated = [...examQuestions];
                                        updated[index].passageTitle = e.target.value;
                                        setExamQuestions(updated);
                                      }}
                                      onBlur={() => pushHistorySnapshot(examQuestions)}
                                      className="w-full bg-transparent font-bold text-xs text-slate-800 border-none outline-none focus:ring-0 p-0"
                                      placeholder="عنوان أو توجيه القطعة..."
                                    />
                                  )}
                                </div>

                                {!isPreviewMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...examQuestions];
                                      delete updated[index].passageText;
                                      delete updated[index].passageTitle;
                                      setExamQuestions(updated);
                                      pushHistorySnapshot(updated);
                                    }}
                                    className="text-slate-400 hover:text-red-500 text-[10px] flex items-center gap-0.5 no-print shrink-0 cursor-pointer"
                                    title="حذف القطعة"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span>حذف القطعة</span>
                                  </button>
                                )}
                              </div>

                              {/* Passage Text Body with Underlined Words */}
                              {isPreviewMode ? (
                                <div
                                  className="text-slate-800 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line text-justify"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizePassageHtml(q.passageText),
                                  }}
                                />
                              ) : (
                                <div className="space-y-1">
                                  <textarea
                                    value={q.passageText}
                                    onChange={(e) => {
                                      const updated = [...examQuestions];
                                      updated[index].passageText = e.target.value;
                                      setExamQuestions(updated);
                                    }}
                                    onBlur={() => pushHistorySnapshot(examQuestions)}
                                    rows={5}
                                    placeholder="نص القطعة القرائية... يمكنك كتابة <u>الكلمة</u> لتسطير أي كلمة مهمة أو **كلمة** للخط العريض."
                                    className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded p-1.5 focus:border-blue-400 focus:outline-none leading-relaxed resize-y font-normal"
                                  />
                                  <div className="text-[10px] text-slate-400 flex items-center justify-between no-print select-none">
                                    <span>ملاحظة: الكلمات داخل &lt;u&gt;كلمة&lt;/u&gt; ستظهر تحتها خط واضح كما في ورقة الامتحان الأصلية.</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Question Top Row: Label + Stem + Sleek Controls */}
                          <div className="flex items-start justify-between gap-2 w-full max-w-full min-w-0 overflow-hidden" dir={examDirection}>
                            <div className="flex items-start gap-1.5 flex-1 min-w-0 max-w-full overflow-hidden">
                              <span className="font-extrabold text-blue-950 text-xs sm:text-sm select-none shrink-0 pt-0.5">
                                {examDirection === "ltr" ? `Q${qNum}:` : `س${qNum}:`}
                              </span>
                              {isPreviewMode ? (
                                <p
                                  className="text-slate-900 leading-snug font-bold flex-1 min-w-0 max-w-full break-words [overflow-wrap:anywhere]"
                                  style={{
                                    fontSize: `${globalFontSize}px`,
                                    textAlign: style.textAlign,
                                    fontWeight: style.isBold ? 700 : 600,
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeFormattedText(cleanStem(q.text)),
                                  }}
                                />
                              ) : (
                                <div className="flex-1 min-w-0 max-w-full">
                                  {focusedQuestionIndex !== index && /<\/?u>/i.test(q.text) ? (
                                    <p
                                      onClick={() => setFocusedQuestionIndex(index)}
                                      className="w-full text-slate-800 leading-snug font-bold break-words [overflow-wrap:anywhere] cursor-text"
                                      style={{
                                        fontSize: `${globalFontSize}px`,
                                        fontWeight: style.isBold ? 700 : 600,
                                        textAlign: style.textAlign,
                                        wordBreak: "break-word",
                                        overflowWrap: "anywhere",
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeFormattedText(cleanStem(q.text)),
                                      }}
                                    />
                                  ) : (
                                    <textarea
                                      value={q.text}
                                      onChange={(e) => {
                                        handleUpdateQuestionText(index, e.target.value);
                                        e.target.style.height = "auto";
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                      }}
                                      onInput={(e) => {
                                        const target = e.currentTarget;
                                        target.style.height = "auto";
                                        target.style.height = `${target.scrollHeight}px`;
                                      }}
                                      ref={(el) => {
                                        if (el) {
                                          el.style.height = "auto";
                                          el.style.height = `${el.scrollHeight}px`;
                                        }
                                      }}
                                      onBlur={() => pushHistorySnapshot(examQuestions)}
                                      onFocus={() => setFocusedQuestionIndex(index)}
                                      rows={1}
                                      placeholder="اكتب أو عدل نص السؤال هنا..."
                                      className="w-full min-w-0 max-w-full resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-slate-800 leading-snug cursor-text font-bold break-words [overflow-wrap:anywhere]"
                                      style={{
                                        fontSize: `${globalFontSize}px`,
                                        fontWeight: style.isBold ? 700 : 600,
                                        textAlign: style.textAlign,
                                        wordBreak: "break-word",
                                        overflowWrap: "anywhere",
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Controls in Builder Mode: Compact & Elegant */}
                            {!isPreviewMode && (
                              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity no-print">
                                <select
                                  value={q.type}
                                  onChange={(e) =>
                                    handleChangeQuestionType(
                                      index,
                                      e.target.value as "choice" | "trueFalse" | "essay"
                                    )
                                  }
                                  className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 outline-none cursor-pointer"
                                >
                                  <option value="choice">اختيار من متعدد</option>
                                  <option value="trueFalse">صح وخطأ</option>
                                  <option value="essay">سؤال مقالي</option>
                                </select>

                                {/* Multiple Choice: Toggle Vertical / Grid Layout */}
                                {q.type === "choice" && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updated = [...examQuestions];
                                      const isCurrentlyVertical =
                                        updated[index].optionsLayout === "vertical" ||
                                        (updated[index].optionsLayout !== "grid" && (
                                          updated[index].subType === "translation" ||
                                          updated[index].options.some((opt) => opt.length > 38)
                                        ));
                                      updated[index].optionsLayout = isCurrentlyVertical ? "grid" : "vertical";
                                      setExamQuestions(updated);
                                      pushHistorySnapshot(updated);
                                    }}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                                    title="تبديل محاذاة الخيارات (عمودي / شبكي)"
                                  >
                                    <span>
                                      {(q.optionsLayout === "vertical" ||
                                        (q.optionsLayout !== "grid" && (
                                          q.subType === "translation" ||
                                          q.options.some((opt) => opt.length > 38)
                                        )))
                                        ? "☰ عمودي"
                                        : "☷ شبكي"}
                                    </span>
                                  </button>
                                )}

                                {/* Essay: Answer Dotted Lines Count (+ / -) */}
                                {q.type === "essay" && (
                                  <div className="inline-flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-semibold text-slate-700">
                                    <button
                                      type="button"
                                      disabled={(q.answerLinesCount || 2) <= 1}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = [...examQuestions];
                                        const current = updated[index].answerLinesCount || 2;
                                        updated[index].answerLinesCount = Math.max(1, current - 1);
                                        setExamQuestions(updated);
                                        pushHistorySnapshot(updated);
                                      }}
                                      className="p-0.5 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                                      title="تقليل أسطر الإجابة"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="px-1 text-[10px]">{q.answerLinesCount || 2} سطر</span>
                                    <button
                                      type="button"
                                      disabled={(q.answerLinesCount || 2) >= 20}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = [...examQuestions];
                                        const current = updated[index].answerLinesCount || 2;
                                        updated[index].answerLinesCount = Math.min(20, current + 1);
                                        setExamQuestions(updated);
                                        pushHistorySnapshot(updated);
                                      }}
                                      className="p-0.5 hover:text-blue-600 cursor-pointer"
                                      title="زيادة أسطر الإجابة"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )}

                                {/* Passage Section Toggle Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = [...examQuestions];
                                    if (updated[index].passageText !== undefined) {
                                      delete updated[index].passageText;
                                      delete updated[index].passageTitle;
                                    } else {
                                      updated[index].passageTitle =
                                        examDirection === "ltr"
                                          ? "• Read the following passage, then choose the correct answer from a, b, c or d:"
                                          : "• اقرأ القطعة التالية ثم أجب عن الأسئلة:";
                                      updated[index].passageText =
                                        "The internet has become an important part of our daily lives. It allows people to connect, learn, and explore new ideas...";
                                    }
                                    setExamQuestions(updated);
                                    pushHistorySnapshot(updated);
                                  }}
                                  className={`inline-flex items-center gap-0.5 text-[10px] font-semibold border px-1.5 py-0.5 rounded cursor-pointer ${
                                    q.passageText !== undefined
                                      ? "bg-amber-100 text-amber-900 border-amber-300"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200"
                                  }`}
                                  title="إضافة أو إزالة قطعة قراءة (Passage)"
                                >
                                  <FileText className="w-2.5 h-2.5 text-amber-600" />
                                  <span>{q.passageText !== undefined ? "القطعة ✓" : "+ قطعة"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTriggerQuestionImage(index);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                                  title="إدراج صورة لهذا السؤال"
                                >
                                  <ImagePlus className="w-3 h-3 text-blue-600" />
                                  <span>+ صورة</span>
                                </button>

                                <div
                                  draggable={!isPreviewMode}
                                  onDragStart={(e) => handleDragStart(e, index)}
                                  onDragEnd={handleDragEnd}
                                  className="p-1 text-slate-400 hover:text-blue-600 cursor-grab active:cursor-grabbing rounded"
                                  title="اسحب لتغيير ترتيب السؤال"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveQuestion(index);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer z-30 pointer-events-auto"
                                  title="حذف هذا السؤال"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Loading Overlay when refining this question */}
                          {isItemRefining && (
                            <div className="my-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                              <span>جاري المعالجة...</span>
                            </div>
                          )}

                          {/* Attached Diagram / Image */}
                          {q.imageUrl && (
                            <div className="my-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5">
                              {!isPreviewMode && (
                                <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-200 pb-1 select-none no-print">
                                  <span className="font-semibold flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3 text-blue-600" />
                                    <span>رسم توضيحي</span>
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {[35, 50, 70, 100].map((pct) => (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => {
                                          const updated = [...examQuestions];
                                          updated[index].imageWidth = pct;
                                          setExamQuestions(updated);
                                          pushHistorySnapshot(updated);
                                        }}
                                        className={`px-1 rounded text-[9px] font-bold ${
                                          (q.imageWidth || 70) === pct
                                            ? "bg-blue-600 text-white"
                                            : "text-slate-600 hover:bg-slate-100"
                                        }`}
                                      >
                                        {pct}%
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...examQuestions];
                                        delete updated[index].imageUrl;
                                        setExamQuestions(updated);
                                        pushHistorySnapshot(updated);
                                      }}
                                      className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                      title="حذف الصورة"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div
                                className={`w-full flex ${
                                  q.imageAlign === "right"
                                    ? "justify-start"
                                    : q.imageAlign === "left"
                                    ? "justify-end"
                                    : "justify-center"
                                }`}
                              >
                                <img
                                  src={q.imageUrl}
                                  alt="رسم توضيحي للسؤال"
                                  className="rounded object-contain max-h-[220px] border border-slate-200 shadow-xs"
                                  style={{ width: `${q.imageWidth || 70}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Divided Answers Section according to Type */}

                          {/* Type 1: Multiple Choice Options */}
                          {q.type === "choice" && (() => {
                            const isVertical =
                              q.optionsLayout === "vertical" ||
                              (q.optionsLayout !== "grid" && (
                                q.subType === "translation" ||
                                q.options.some((opt) => opt.length > 38) ||
                                (q.options.length > 0 && q.options.reduce((sum, o) => sum + o.length, 0) / q.options.length > 28)
                              ));

                            return (
                              <div className="mt-2 space-y-1 w-full max-w-full min-w-0">
                                <div
                                  className={`w-full max-w-full min-w-0 ${
                                    isVertical
                                      ? "grid grid-cols-1 gap-y-2"
                                      : "grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-2"
                                  }`}
                                >
                                  {q.options.map((opt, optIdx) => {
                                    const isCorrect = q.correctOptionIndex === optIdx;
                                    const label = getOptionLabel(optIdx);

                                    return (
                                      <div
                                        key={optIdx}
                                        className={`flex items-start gap-2 rounded px-2 py-1 min-w-0 max-w-full transition-colors ${
                                          isPreviewMode
                                            ? "bg-transparent border-none p-0"
                                            : isCorrect
                                            ? "bg-blue-50/70 border border-blue-300 ring-1 ring-blue-400"
                                            : "bg-slate-50/60 hover:bg-slate-100/70 border border-slate-200/80"
                                        }`}
                                      >
                                        {/* Correct Answer Indicator / Option Bubble */}
                                        {isPreviewMode ? (
                                          <span className="w-5 h-5 rounded-full border border-slate-700 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                            {label}
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleCorrectOption(index, optIdx)}
                                            className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 transition-all cursor-pointer mt-0.5 ${
                                              isCorrect
                                                ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300"
                                                : "border-slate-300 text-slate-600 hover:border-blue-500 hover:text-blue-600 bg-white hover:bg-blue-50/50"
                                            }`}
                                            title="انقر لتحديد هذه الإجابة كإجابة صحيحة"
                                          >
                                            {label}
                                          </button>
                                        )}

                                        {/* Option Text */}
                                        {isPreviewMode ? (
                                          <span
                                            className="flex-1 text-slate-900 font-semibold text-xs sm:text-sm min-w-0 break-words [overflow-wrap:anywhere] leading-snug"
                                            dangerouslySetInnerHTML={{
                                              __html: sanitizeFormattedText(opt),
                                            }}
                                          />
                                        ) : (
                                          <textarea
                                            value={opt}
                                            rows={isVertical && opt.length > 55 ? 2 : 1}
                                            onChange={(e) => handleUpdateOptionText(index, optIdx, e.target.value)}
                                            onBlur={() => pushHistorySnapshot(examQuestions)}
                                            className="flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 p-0 text-slate-800 font-medium text-xs sm:text-sm break-words [overflow-wrap:anywhere] resize-none leading-snug"
                                          />
                                        )}

                                        {!isPreviewMode && isFocused && q.options.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveOption(index, optIdx)}
                                            className="text-slate-300 hover:text-red-500 p-0.5 rounded no-print cursor-pointer shrink-0 mt-0.5"
                                            title="حذف هذا الخيار"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Add Option Button (only shown on focused card and if < 4 options) */}
                                {!isPreviewMode && isFocused && q.options.length < 4 && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddOption(index)}
                                    className="text-[10px] text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5 mt-0.5 no-print cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>إضافة خيار</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* Type 2: True / False */}
                          {q.type === "trueFalse" && (
                            <div className="mt-2 flex items-center gap-6">
                              {isPreviewMode ? (
                                <>
                                  <div className="flex items-center gap-1.5 select-none">
                                    <span className="w-4 h-4 rounded-full border border-slate-600 inline-block shrink-0" />
                                    <span className="text-xs font-semibold text-slate-900">
                                      {examDirection === "ltr" ? "True" : "صح"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 select-none">
                                    <span className="w-4 h-4 rounded-full border border-slate-600 inline-block shrink-0" />
                                    <span className="text-xs font-semibold text-slate-900">
                                      {examDirection === "ltr" ? "False" : "خطأ"}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="radio"
                                      name={`tf-${q.id}`}
                                      checked={q.correctOptionIndex === 0}
                                      onChange={() => handleToggleCorrectOption(index, 0)}
                                      className="w-3.5 h-3.5 text-blue-600 accent-blue-600"
                                    />
                                    <span className="text-xs font-semibold text-slate-700">
                                      {examDirection === "ltr" ? "( ✓ ) True" : "( ✓ ) صح"}
                                    </span>
                                  </label>

                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="radio"
                                      name={`tf-${q.id}`}
                                      checked={q.correctOptionIndex === 1}
                                      onChange={() => handleToggleCorrectOption(index, 1)}
                                      className="w-3.5 h-3.5 text-blue-600 accent-blue-600"
                                    />
                                    <span className="text-xs font-semibold text-slate-700">
                                      {examDirection === "ltr" ? "( ✗ ) False" : "( ✗ ) خطأ"}
                                    </span>
                                  </label>
                                </>
                              )}
                            </div>
                          )}

                          {/* Type 3: Essay & Writing Dotted Answer Lines */}
                          {q.type === "essay" && (() => {
                            const linesCount = Math.max(1, q.answerLinesCount || 2);
                            return (
                              <div className="mt-2.5 w-full select-none">
                                {/* Visual authentic dotted lines for student answers */}
                                <div className="space-y-3 w-full">
                                  {Array.from({ length: linesCount }).map((_, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className="w-full border-b-2 border-dotted border-slate-400/90 print:border-slate-600 h-3.5"
                                    />
                                  ))}
                                </div>

                                {/* Editor Line-Count Controls */}
                                {!isPreviewMode && isFocused && (
                                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 border border-slate-200/80 rounded px-2 py-1 no-print">
                                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      <span>أسطر الإجابة المنقطة:</span>
                                      <span className="text-blue-600 font-bold">{linesCount}</span>
                                    </span>

                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1 py-0.5">
                                      <button
                                        type="button"
                                        disabled={linesCount <= 1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = [...examQuestions];
                                          updated[index].answerLinesCount = Math.max(1, linesCount - 1);
                                          setExamQuestions(updated);
                                          pushHistorySnapshot(updated);
                                        }}
                                        className="p-1 hover:bg-slate-100 hover:text-red-600 disabled:opacity-25 rounded text-slate-700 cursor-pointer"
                                        title="تقليل سطر إجابة"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>

                                      <span className="text-xs font-bold text-slate-800 px-1.5">{linesCount}</span>

                                      <button
                                        type="button"
                                        disabled={linesCount >= 20}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = [...examQuestions];
                                          updated[index].answerLinesCount = Math.min(20, linesCount + 1);
                                          setExamQuestions(updated);
                                          pushHistorySnapshot(updated);
                                        }}
                                        className="p-1 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-25 rounded text-slate-700 cursor-pointer"
                                        title="زيادة سطر إجابة"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Page Number: absolute top-left corner (takes no vertical space) */}
                <div
                  className="absolute top-[2.5mm] left-[4mm] z-30 text-[10px] font-bold text-slate-500 select-none page-number-corner"
                  dir="ltr"
                >
                  {page.pageNumber}
                </div>
                {!isPreviewMode && strokes.some((s) => s.pageNumber === page.pageNumber) && (
                  <button
                    type="button"
                    onClick={() => handleClearPageStrokes(page.pageNumber)}
                    className="absolute bottom-2 left-4 z-30 text-[10px] text-rose-600 hover:underline no-print"
                  >
                    مسح رسومات الصفحة
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </section>
      </div>

      {/* Duplicate Title Detection & Versioning Modal */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in no-print">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-4 text-right" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">تكرار اسم الاختبار</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يوجد اختبار محفوظ مسبقاً بنفس الاسم في أرشيف النماذج:
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <p className="text-xs font-bold text-slate-800 truncate">«{archiveExamName}»</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ما هو الإجراء الذي تفضل اتخاذه لحفظ هذا الاختبار؟
            </p>

            <div className="flex flex-col gap-2.5 mt-1">
              <button
                type="button"
                onClick={handleOverwriteDuplicate}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>تحديث النموذج الحالي (استبدال / Oversave)</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAsNewVersion}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300/80 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>حفظ كنسخة جديدة (-1)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setExistingDuplicateExam(null);
                }}
                className="w-full py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Model Generator Modal (أ - ب - ج) */}
      <ModelGenerationModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        currentModelCount={examModels?.modelCount || 1}
        questionsCount={examQuestions.length}
        onGenerate={handleGenerateModels}
        onReshuffle={handleReshuffleExistingModels}
        onResetSingleModel={handleResetSingleModel}
      />
    </div>
  );
}
