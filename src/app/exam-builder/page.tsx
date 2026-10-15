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
} from "lucide-react";
import GeminiKeyModal from "@/components/GeminiKeyModal";
import ModelGenerationModal from "@/components/ModelGenerationModal";
import {
  ExamModelsData,
  generateExamModels,
  reshuffleExamModels,
  updateQuestionNumberPrefix,
} from "@/lib/multi-model-exam";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuestionStyle {
  fontSize: number;
  isBold: boolean;
  textAlign: "right" | "center" | "left";
}

export interface ExamQuestionItem {
  id: string;
  type: "choice" | "trueFalse" | "essay";
  text: string;
  options: string[];
  correctOptionIndex?: number;
  points: number;
  isExtractedByOcr?: boolean;
  engineUsed?: "gemini" | "local";
  imageUrl?: string;
  imageWidth?: number; // percentage (25..100)
  imageAlign?: "right" | "center" | "left";
}

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

export default function ExamBuilderPage() {
  // Source viewer states (defaults to null for a clean empty dropzone area)
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileZoom, setFileZoom] = useState<number>(100);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const freeImageInputRef = useRef<HTMLInputElement>(null);

  // Top bar archive exam name vs. In-paper exam title (completely independent states, clean empty start)
  const [archiveExamName, setArchiveExamName] = useState<string>("");
  const [paperTitle, setPaperTitle] = useState<string>("");
  const [examCode, setExamCode] = useState<string>("BEEQ");
  const [maxScore, setMaxScore] = useState<number>(20);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState<boolean>(false);
  const [existingDuplicateExam, setExistingDuplicateExam] = useState<any>(null);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

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

  // Selection Pen (Crop Marquee) states
  const [isSelectionPenActive, setIsSelectionPenActive] = useState<boolean>(true);
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentCrop, setCurrentCrop] = useState<CropRect | null>(null);
  const [completedCrop, setCompletedCrop] = useState<CropRect | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionFeedback, setExtractionFeedback] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

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

  // Reset to a clean fresh exam
  const handleResetToNewExam = useCallback((showNotice: boolean = true) => {
    setExamQuestions([]);
    setArchiveExamName("");
    setPaperTitle("");
    setSelectedFile(null);
    setImageSrc(null);
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
          if (parsed.selectedFile !== undefined) setSelectedFile(parsed.selectedFile);
          if (parsed.imageSrc !== undefined) setImageSrc(parsed.imageSrc);
          if (parsed.editingExamId !== undefined) setEditingExamId(parsed.editingExamId);

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
        imageSrc: (imageSrc && imageSrc.length < 1000000) ? imageSrc : null,
        editingExamId,
      };
      localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, JSON.stringify(screenState));
    } catch (e) {
      // If quota exceeded due to large image, guarantee questions & titles are still persisted
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
    editingExamId,
  ]);

  // Fetch real uploaded files list from backend
  const loadUploadedFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setUploadedFilesList(data.files);
        // If user has a selectedFile but imageSrc was omitted from localStorage due to quota, restore it from backend
        setImageSrc((curr) => {
          if (!curr && selectedFile) {
            const match = data.files.find((f: any) => f.name === selectedFile);
            if (match && match.filepath) return match.filepath;
          }
          return curr;
        });
      }
    } catch {
      // Ignore if offline
    }
  }, [selectedFile]);

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

  // Process Document File Upload (File Input or Drag & Drop)
  const processDocumentFileUpload = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setImageSrc(dataUrl);
        setSelectedFile(file.name);

        // Save to backend database so it becomes available in "الملفات المرفوعة"
        try {
          const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + " ميجابايت";
          await fetch("/api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              type: file.name.endsWith(".pdf") ? "pdf" : "image",
              size: sizeMb,
              date: "الآن",
              filepath: dataUrl,
            }),
          });
          loadUploadedFiles();
          setSaveStatus(`تم رفع وحفظ ملف "${file.name}" بنجاح`);
          setTimeout(() => setSaveStatus(null), 3000);
        } catch {
          // Local fallback
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processDocumentFileUpload(file);
      e.target.value = "";
    }
  };

  // Drag and Drop files onto Document Viewer
  const handleViewerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverViewer(true);
  };

  const handleViewerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverViewer(false);
  };

  const handleViewerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverViewer(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processDocumentFileUpload(e.dataTransfer.files[0]);
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

  // Helper to retrieve the style of a specific question index
  const getQuestionStyle = (index: number): QuestionStyle => {
    return (
      questionStyles[index] || {
        fontSize: globalFontSize,
        isBold: false,
        textAlign: examDirection === "ltr" ? "left" : "right",
      }
    );
  };

  const updateFocusedQuestionStyle = (updater: (prev: QuestionStyle) => QuestionStyle) => {
    const activeIdx = focusedQuestionIndex ?? 0;
    setQuestionStyles((prev) => {
      const current = prev[activeIdx] || {
        fontSize: globalFontSize,
        isBold: false,
        textAlign: examDirection === "ltr" ? "left" : "right",
      };
      return {
        ...prev,
        [activeIdx]: updater(current),
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
        if (currentKey === "A") {
          updatedModels.A = { ...updatedModels.A, questions: [...examQuestions] };
          modelAQuestions = examQuestions;
        } else if (currentKey === "B" && updatedModels.B) {
          updatedModels.B = { ...updatedModels.B, questions: [...examQuestions] };
          modelAQuestions = updatedModels.A.questions;
        } else if (currentKey === "C" && updatedModels.C) {
          updatedModels.C = { ...updatedModels.C, questions: [...examQuestions] };
          modelAQuestions = updatedModels.A.questions;
        }
        modelsToSave = { ...examModels, models: updatedModels };
        setExamModels(modelsToSave);
      }

      const totalPts = modelAQuestions.reduce((acc, q) => acc + (q.points || 0), 0);
      const examId = activeExamId || `exam-${examCode}-${Date.now()}`;
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

  // Pointer event handlers for Selection Pen marquee tool
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelectionPenActive || isExtracting) return;

    if ((e.target as HTMLElement).closest(".floating-extract-btn")) {
      return;
    }

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setIsDraggingCrop(true);
    setStartPos({ x, y });
    setCurrentCrop({ x, y, width: 0, height: 0 });
    setCompletedCrop(null);
    setExtractionFeedback(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !startPos || !imageContainerRef.current) return;

    const container = imageContainerRef.current;
    const currentX = e.clientX - container.getBoundingClientRect().left + container.scrollLeft;
    const currentY = e.clientY - container.getBoundingClientRect().top + container.scrollTop;

    const x = Math.max(0, Math.min(startPos.x, currentX));
    const y = Math.max(0, Math.min(startPos.y, currentY));
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);

    setCurrentCrop({ x, y, width, height });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCrop) return;
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
  };

  // Helper to crop base64 image from selected region
  const getCroppedImageBase64 = (crop: CropRect): Promise<string> => {
    return new Promise((resolve) => {
      const img = imgElementRef.current;
      if (!img) {
        resolve("");
        return;
      }

      const canvas = document.createElement("canvas");
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      canvas.width = Math.max(1, crop.width * scaleX);
      canvas.height = Math.max(1, crop.height * scaleY);
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.imageSmoothingQuality = "high";
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

      resolve(canvas.toDataURL("image/png"));
    });
  };

  // Extract questions from selected region (Gemini Vision OCR + Structuring)
  const handleExtractAndDrag = async () => {
    if (!completedCrop || isExtracting) return;

    setIsExtracting(true);
    setExtractionFeedback(null);

    try {
      let croppedBase64 = await getCroppedImageBase64(completedCrop);
      if (!croppedBase64) {
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

      if (data.needsApiKey) {
        setIsGeminiModalOpen(true);
        setExtractionFeedback("يرجى إدخال مفتاح Gemini API لتفعيل القراءة البصرية الفائقة.");
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

      if (extractedList.length === 0) {
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
      }));

      const updated = [...examQuestions, ...newItems];
      setExamQuestions(updated);
      pushHistorySnapshot(updated);

      setQuestionStyles((prev) => {
        const next = { ...prev };
        newItems.forEach((_, idx) => {
          next[startIndex + idx] = {
            fontSize: globalFontSize,
            isBold: false,
            textAlign: examDirection === "ltr" ? "left" : "right",
          };
        });
        return next;
      });

      setFocusedQuestionIndex(startIndex);

      setExtractionFeedback(
        data.engine === "gemini" ? `تم استخراج ${newItems.length} سؤال بنجاح` : "تم استخراج السؤال"
      );

      setTimeout(() => {
        setCompletedCrop(null);
        setCurrentCrop(null);
        setExtractionFeedback(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      setExtractionFeedback("حدث خطأ أثناء استخراج النص.");
    } finally {
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

  // -------------------------------------------------------------
  // DYNAMIC A4 MULTI-PAGE PAGINATION ALGORITHM
  // "ممنوع تقسيم سوال علي صفحتين" - Each question stays intact!
  // Prevents questions overflowing page boundaries in both Builder Mode and Preview Mode
  // -------------------------------------------------------------
  const computePageSlots = useCallback(
    (questionsList: ExamQuestionItem[]): PageSlot[] => {
      if (!questionsList || questionsList.length === 0) {
        return [{ pageNumber: 1, questionIndices: [] }];
      }

      // Standard A4 physical height budget (962px):
      // Page 1 budget: ~740px questions area (Exam Header is ~105px, Footer ~35px, Padding ~35px)
      // Perfectly fits 7 to 8 questions, filling the page evenly down to the footer without gaps or cut-offs
      const PAGE_1_CAPACITY = 740;
      // Page N budget: ~830px questions area (Subheader ~35px, Footer ~35px, Padding ~35px)
      // Fits 8 to 10 questions evenly
      const PAGE_N_CAPACITY = 830;

      const slots: PageSlot[] = [{ pageNumber: 1, questionIndices: [] }];
      let currentPageIdx = 0;
      let currentHeight = 0;

      questionsList.forEach((q, idx) => {
        const charLimit = 60;
        const lines = Math.max(1, Math.ceil((q.text || "").length / charLimit));
        // Text height includes question label + lines * line-height
        const textHeight = 16 + lines * (globalFontSize * 1.35);

        let optionsHeight = 0;
        if (q.type === "choice") {
          const rows = Math.ceil(Math.max(1, q.options.length) / 2);
          optionsHeight = rows * 26 + 4;
        } else if (q.type === "trueFalse") {
          optionsHeight = 26;
        } else if (q.type === "essay") {
          optionsHeight = 36;
        }

        const imageHeight = q.imageUrl ? 110 : 0;
        const questionSpacing = 14;
        const totalQuestionHeight = textHeight + optionsHeight + imageHeight + questionSpacing;

        const capacity = currentPageIdx === 0 ? PAGE_1_CAPACITY : PAGE_N_CAPACITY;

        if (currentHeight + totalQuestionHeight > capacity && slots[currentPageIdx].questionIndices.length > 0) {
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
                        setSelectedFile(f.name);
                        if (f.filepath) setImageSrc(f.filepath);
                        setIsAllFilesModalOpen(false);
                        setSaveStatus(`تم تحميل المستند: ${f.name}`);
                        setTimeout(() => setSaveStatus(null), 2500);
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
            onClick={() => handleResetToNewExam(true)}
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
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden print:p-0 print:m-0 print:gap-0 print:overflow-visible print:block print:h-auto">
        {/* ======================================================== */}
        {/* 1. RIGHT PANE: Source File Viewer (40% width in RTL) */}
        {/* ======================================================== */}
        {!isPreviewMode && (
          <section
            onDragOver={handleViewerDragOver}
            onDragLeave={handleViewerDragLeave}
            onDrop={handleViewerDrop}
            className={`w-full lg:w-[40%] h-full flex flex-col bg-white rounded-2xl shadow-xs overflow-hidden border transition-all no-print ${
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
                            setSelectedFile(f.name);
                            if (f.filepath) setImageSrc(f.filepath);
                            setIsFileDropdownOpen(false);
                            setSaveStatus(`تم تحديد: ${f.name}`);
                            setTimeout(() => setSaveStatus(null), 2000);
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

            {/* Viewer Toolbar: Selection Pen + Zoom Controls */}
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs shrink-0 select-none">
              {/* Selection Pen Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSelectionPenActive(!isSelectionPenActive)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isSelectionPenActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                  title="تفعيل أو تعطيل أداة التحديد"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>قلم التحديد</span>
                </button>
              </div>

              {/* Zoom & Reset Controls */}
              <div className="flex items-center gap-1">
                {completedCrop && (
                  <button
                    onClick={() => {
                      setCompletedCrop(null);
                      setCurrentCrop(null);
                    }}
                    className="p-1.5 hover:bg-white text-slate-500 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                    title="إلغاء التحديد الحالي"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setFileZoom((prev) => Math.max(prev - 10, 60))}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 text-[11px] font-medium text-slate-600 min-w-[32px] text-center">
                  {fileZoom}%
                </span>
                <button
                  onClick={() => setFileZoom((prev) => Math.min(prev + 10, 160))}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Large Placeholder Box (Image Viewer with Drag & Drop & Crop) */}
            <div
              onDragOver={handleViewerDragOver}
              onDragLeave={handleViewerDragLeave}
              onDrop={handleViewerDrop}
              className="flex-1 m-3 rounded-xl bg-slate-100/70 border border-slate-200 overflow-hidden relative flex flex-col"
            >
              {isDragOverViewer && (
                <div className="absolute inset-0 z-30 bg-blue-600/90 text-white flex flex-col items-center justify-center gap-2 backdrop-blur-xs">
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
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`flex-1 overflow-auto p-4 flex justify-center items-start relative select-none ${
                    isSelectionPenActive ? "cursor-crosshair" : "cursor-default"
                  }`}
                >
                  {/* Scalable Image Container */}
                  <div
                    className="relative transition-transform duration-150 origin-top shadow-md bg-white rounded-lg overflow-hidden shrink-0"
                    style={{
                      width: `${(fileZoom / 100) * 620}px`,
                      minHeight: `${(fileZoom / 100) * 876}px`,
                    }}
                  >
                    {/* Document Image */}
                    <img
                      ref={imgElementRef}
                      src={imageSrc}
                      alt="صفحة المستند المصدري"
                      draggable={false}
                      crossOrigin="anonymous"
                      className="w-full h-auto object-contain block pointer-events-none select-none"
                    />

                    {/* Marquee Selection Bounding Box Overlay */}
                    {activeCrop && activeCrop.width > 0 && activeCrop.height > 0 && (
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
                        {/* Corner Handles */}
                        <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                        <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />
                        <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-[2px]" />

                        {/* Loading Overlay */}
                        {isExtracting && (
                          <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-xs flex items-center justify-center">
                            <div className="bg-white/95 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 text-xs font-bold text-blue-700">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              <span>جاري استخراج السؤال...</span>
                            </div>
                          </div>
                        )}

                        {/* Feedback Tag */}
                        {extractionFeedback && (
                          <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center p-2 text-center">
                            <div className="bg-white/95 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{extractionFeedback}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Floating Extract Button */}
                    {completedCrop && (
                      <div
                        style={{
                          position: "absolute",
                          left: `${Math.max(10, Math.min(activeCrop?.x || 0, 480))}px`,
                          top: `${Math.max(8, completedCrop.y + completedCrop.height + 10)}px`,
                        }}
                        className="floating-extract-btn z-30 pointer-events-auto"
                      >
                        <button
                          onClick={handleExtractAndDrag}
                          disabled={isExtracting}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap disabled:opacity-80"
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>جاري الاستخراج...</span>
                            </>
                          ) : (
                            <span>استخراج السؤال</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stats banner */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between shrink-0">
                <span className="font-medium text-slate-600">
                  {selectedFile ? `المستند: ${selectedFile}` : "لا يوجد مستند مفتوح حالياً"}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 2. LEFT PANE: Physical A4 Exam Canvas (60% or 100% in Preview) */}
        {/* ======================================================== */}
        <section
          className={`h-full flex flex-col bg-slate-200/60 rounded-2xl shadow-xs overflow-hidden border-none print:p-0 print:m-0 print:w-full print:bg-transparent print:overflow-visible print:block print:h-auto ${
            isPreviewMode ? "w-full" : "w-full lg:w-[60%]"
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center gap-8 a4-print-container print:p-0 print:m-0 print:gap-0 print:overflow-visible print:block print:w-full">
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
                className="a4-page-sheet w-full max-w-[680px] min-h-[962px] bg-white rounded-sm shadow-xl p-4 sm:p-5 relative flex flex-col justify-between transition-all border border-slate-200 select-text overflow-hidden print:p-[8mm_12mm] print:m-0 print:border-none print:shadow-none print:w-[210mm] print:max-w-[210mm] print:h-[296.5mm] print:max-h-[296.5mm] print:break-after-page print:[break-after:page] print:[page-break-after:always]"
                style={{
                  aspectRatio: "1 / 1.4142",
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
                <div className="flex-1 flex flex-col relative z-10 min-w-0 main-paper-content h-full">
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

                        {/* Left Column: Model Badge (Top-Left) & Exam Code & Exam Grade */}
                        <div className="shrink-0 flex flex-col justify-between items-end gap-1.5 min-w-[140px] sm:min-w-[155px]">
                          {/* Top-Left Model Name Badge */}
                          {currentModelBadge && (
                            <div className="w-full flex items-center justify-center bg-slate-900 text-white rounded-lg py-1 px-2.5 shadow-2xs border-2 border-slate-900 print:bg-white print:text-black print:border-2 print:border-black">
                              <span className="font-black text-xs sm:text-sm tracking-wide">
                                {currentModelBadge}
                              </span>
                            </div>
                          )}

                          {/* Top: Exam Code */}
                          <div className="w-full flex items-center justify-between gap-2 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300">
                            <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
                              {examDirection === "ltr" ? "Code:" : "كود الامتحان :"}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-extrabold text-xs tracking-wider text-slate-900">
                                {examCode}
                              </span>
                              {!isPreviewMode && (
                                <button
                                  type="button"
                                  onClick={generateNewExamCode}
                                  className="p-0.5 text-slate-500 hover:text-blue-600 rounded transition-colors no-print cursor-pointer"
                                  title="توليد كود جديد"
                                >
                                  <RotateCw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

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
                  ) : (
                    <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2 text-xs text-slate-600 font-bold select-none" dir={examDirection}>
                      <span className="truncate">تتمة: {paperTitle || "ورقة الامتحان"}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentModelBadge && (
                          <span className="border-2 border-slate-900 bg-slate-100 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-md print:bg-white print:text-black">
                            {currentModelBadge}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">صفحة {page.pageNumber}</span>
                      </div>
                    </div>
                  )}

                  {/* List of intact questions allocated to this A4 page */}
                  <div
                    className={`questions-container flex-1 flex flex-col min-h-0 w-full max-w-full ${
                      page.questionIndices.length >= 5
                        ? "justify-between"
                        : "justify-start space-y-4 sm:space-y-5"
                    }`}
                  >
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

                      return (
                        <div
                          key={q.id || index}
                          draggable={!isPreviewMode}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              handleQuestionCardDrop(e, index);
                            } else {
                              handleDrop(e, index);
                            }
                          }}
                          onMouseEnter={() => setHoveredQuestionIndex(index)}
                          onMouseLeave={() => setHoveredQuestionIndex(null)}
                          onFocusCapture={() => setHoveredQuestionIndex(index)}
                          onClick={() => setFocusedQuestionIndex(index)}
                          className={`question-card group relative transition-all rounded-lg border w-full max-w-full min-w-0 overflow-hidden ${
                            isPreviewMode
                              ? "border-transparent bg-transparent py-2.5 px-1 shadow-none"
                              : isFocused
                              ? "bg-blue-50/20 border-blue-400 shadow-xs ring-1 ring-blue-400/20 p-2 sm:p-2.5"
                              : "border-slate-200/60 hover:border-slate-300 p-2"
                          } ${isBeingDragged ? "opacity-30 border-dashed border-blue-600" : ""} ${
                            isDragTarget ? "border-t-2 border-t-blue-600 bg-blue-50/40" : ""
                          }`}
                        >
                          {/* Question Top Row: Label + Stem + Sleek Controls */}
                          <div className="flex items-start justify-between gap-2 w-full max-w-full min-w-0 overflow-hidden" dir={examDirection}>
                            <div className="flex items-start gap-1.5 flex-1 min-w-0 max-w-full overflow-hidden">
                              <span className="font-extrabold text-blue-950 text-xs sm:text-sm select-none shrink-0 pt-0.5">
                                {examDirection === "ltr" ? `Q${index + 1}:` : `س${index + 1}:`}
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
                                >
                                  {cleanStem(q.text)}
                                </p>
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
                                  className="p-1 text-slate-400 hover:text-blue-600 cursor-grab active:cursor-grabbing rounded"
                                  title="اسحب لتغيير ترتيب السؤال"
                                >
                                  <GripVertical className="w-3 h-3" />
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveQuestion(index);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="حذف هذا السؤال"
                                >
                                  <Trash2 className="w-3 h-3" />
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
                          {q.type === "choice" && (
                            <div className="mt-2 space-y-1 w-full max-w-full min-w-0">
                              <div className="grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-2 w-full max-w-full min-w-0">
                                {q.options.map((opt, optIdx) => {
                                  const isCorrect = q.correctOptionIndex === optIdx;
                                  const label = getOptionLabel(optIdx);

                                  return (
                                    <div
                                      key={optIdx}
                                      className={`flex items-center gap-2 rounded px-2 py-1 min-w-0 max-w-full transition-colors ${
                                        isPreviewMode
                                          ? "bg-transparent border-none p-0"
                                          : isCorrect
                                          ? "bg-blue-50/70 border border-blue-300 ring-1 ring-blue-400"
                                          : "bg-slate-50/60 hover:bg-slate-100/70 border border-slate-200/80"
                                      }`}
                                    >
                                      {/* Correct Answer Indicator / Option Bubble */}
                                      {isPreviewMode ? (
                                        <span className="w-5 h-5 rounded-full border border-slate-700 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
                                          {label}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleCorrectOption(index, optIdx)}
                                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
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
                                        <span className="flex-1 text-slate-900 font-semibold text-xs sm:text-sm min-w-0 break-words [overflow-wrap:anywhere]">{opt}</span>
                                      ) : (
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => handleUpdateOptionText(index, optIdx, e.target.value)}
                                          onBlur={() => pushHistorySnapshot(examQuestions)}
                                          className="flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 p-0 text-slate-800 font-medium text-xs sm:text-sm break-words [overflow-wrap:anywhere]"
                                        />
                                      )}

                                      {!isPreviewMode && isFocused && q.options.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveOption(index, optIdx)}
                                          className="text-slate-300 hover:text-red-500 p-0.5 rounded no-print cursor-pointer"
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
                          )}

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

                          {/* Type 3: Essay Lines */}
                          {q.type === "essay" && (
                            <div className="mt-2 space-y-1.5 pointer-events-none select-none">
                              <div className="border-b border-dashed border-slate-300 h-2.5"></div>
                              <div className="border-b border-dashed border-slate-300 h-2.5"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Physical A4 Footer: Page Number Centered */}
                <div className="border-t border-slate-200 pt-2.5 mt-auto shrink-0 flex items-center justify-between text-xs font-bold text-slate-500 select-none page-footer">
                  {/* Clean Page Stamping Options when drawing */}
                  {!isPreviewMode && strokes.some((s) => s.pageNumber === page.pageNumber) && (
                    <button
                      type="button"
                      onClick={() => handleClearPageStrokes(page.pageNumber)}
                      className="text-[10px] text-rose-600 hover:underline no-print"
                    >
                      مسح رسومات الصفحة
                    </button>
                  )}
                  <span className="mx-auto">- {page.pageNumber} -</span>
                </div>
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
