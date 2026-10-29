"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  Upload,
  Users,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  FileCheck2,
  Sparkles,
  Check,
  X,
  ArrowLeft,
  ShieldCheck,
  Layers,
  Filter,
  HelpCircle,
} from "lucide-react";
import { Group } from "@/lib/types/management";
import {
  CANONICAL_ACADEMIC_YEARS,
  ExcelColumnSpec,
  ImportFieldKey,
  detectHeaderAndColumns,
  generateUtf8BomCsv,
  generateXlsxWorkbook,
  normalizeAcademicYear,
  normalizeArabicKey,
  parseUploadedSheetFile,
  sanitizeMonthlyFee,
  sanitizePhoneNumber,
  sanitizeStudentName,
} from "@/lib/excel-engine";

const MONTHS_LIST = [
  { value: "2026-01", label: "يناير 2026" },
  { value: "2026-02", label: "فبراير 2026" },
  { value: "2026-03", label: "مارس 2026" },
  { value: "2026-04", label: "أبريل 2026" },
  { value: "2026-05", label: "مايو 2026" },
  { value: "2026-06", label: "يونيو 2026" },
  { value: "2026-07", label: "يوليو 2026" },
  { value: "2026-08", label: "أغسطس 2026" },
  { value: "2026-09", label: "سبتمبر 2026" },
  { value: "2026-10", label: "أكتوبر 2026" },
  { value: "2026-11", label: "نوفمبر 2026" },
  { value: "2026-12", label: "ديسمبر 2026" },
  { value: "2027-01", label: "يناير 2027" },
  { value: "2027-02", label: "فبراير 2027" },
  { value: "2027-03", label: "مارس 2027" },
  { value: "2027-04", label: "أبريل 2027" },
  { value: "2027-05", label: "مايو 2027" },
  { value: "2027-06", label: "يونيو 2027" },
];

type ExportPresetType = "all" | "students_group" | "financials" | "phones" | "custom";

interface ExistingStudentLite {
  id: string;
  code: string;
  name: string;
  groupId: string;
  groupName?: string;
  academicYear: string;
  studentPhone?: string;
  parentPhone?: string;
}

interface ParsedPreviewRow {
  rowId: string;
  sourceRowNumber: number;
  selected: boolean;
  name: string;
  parentPhone: string;
  studentPhone: string;
  monthlyFee: number;
  academicYear: string;
  groupNameFromSheet: string;
  notes: string;
  codeFromSheet: string;
  // Diagnostics
  isValidName: boolean;
  nameError?: string;
  parentPhoneWarning?: string;
  studentPhoneWarning?: string;
  wasAutoRepaired: boolean;
  repairDetails: string[];
  isDuplicateInSheet: boolean;
  isDuplicateInDb: boolean;
}

export default function ExcelSheetsPage() {
  // Top-level mode: "choice" (or direct switch between "export" and "import")
  const [activeMode, setActiveMode] = useState<"export" | "import">("export");

  // Shared Metadata
  const [groups, setGroups] = useState<Group[]>([]);
  const [existingStudents, setExistingStudents] = useState<ExistingStudentLite[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // ==========================================================================
  // EXPORT STATE
  // ==========================================================================
  const [exportPreset, setExportPreset] = useState<ExportPresetType>("all");
  const [includeStudentGroupInfo, setIncludeStudentGroupInfo] = useState<boolean>(true);
  const [includePhonesInfo, setIncludePhonesInfo] = useState<boolean>(true);
  const [includeFinancialsInfo, setIncludeFinancialsInfo] = useState<boolean>(true);

  const [exportAcademicYear, setExportAcademicYear] = useState<string>("ALL");
  const [exportGroupId, setExportGroupId] = useState<string>("ALL");
  const [exportStudentStatus, setExportStudentStatus] = useState<"active" | "inactive" | "all">("active");
  const [exportMonth, setExportMonth] = useState<string>("2026-10");
  const [exportPaymentFilter, setExportPaymentFilter] = useState<"all" | "paid" | "unpaid" | "overdue">("all");
  const [exportSearchQuery, setExportSearchQuery] = useState<string>("");

  const [exportRows, setExportRows] = useState<any[]>([]);
  const [exportSummary, setExportSummary] = useState({
    totalStudents: 0,
    totalExpectedFee: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
  });

  // ==========================================================================
  // IMPORT STATE (STUDENTS ONLY)
  // ==========================================================================
  const [importAcademicYear, setImportAcademicYear] = useState<string>("الصف الثالث الثانوي");
  const [importGroupId, setImportGroupId] = useState<string>("");
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState<number>(250);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update" | "allow">("skip");
  const [respectSheetGroupIfMatched, setRespectSheetGroupIfMatched] = useState<boolean>(false);

  // Quick Inline Group Creation Modal State
  const [isQuickGroupOpen, setIsQuickGroupOpen] = useState<boolean>(false);
  const [quickGroupName, setQuickGroupName] = useState<string>("");
  const [quickGroupTeacher, setQuickGroupTeacher] = useState<string>("");
  const [quickGroupSubject, setQuickGroupSubject] = useState<string>("");
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);

  // Uploaded File & Raw Sheet State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [rawSheetRows, setRawSheetRows] = useState<string[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, ImportFieldKey>>({});
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string>("");
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResultBanner, setImportResultBanner] = useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    groupName: string;
  } | null>(null);
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "warnings" | "duplicates">("all");

  // Fetch dataset on load & when export filters change
  const fetchExcelDataset = async () => {
    try {
      setIsLoadingData(true);
      const params = new URLSearchParams({
        academicYear: exportAcademicYear,
        groupId: exportGroupId,
        studentStatus: exportStudentStatus,
        month: exportMonth,
        paymentFilter: includeFinancialsInfo ? exportPaymentFilter : "all",
      });

      const res = await fetch(`/api/excel?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setExportRows(data.rows || []);
        setExportSummary(
          data.summary || {
            totalStudents: 0,
            totalExpectedFee: 0,
            totalPaidAmount: 0,
            totalRemainingAmount: 0,
          }
        );
        const loadedGroups: Group[] = data.groups || [];
        setGroups(loadedGroups);
        setExistingStudents(data.existingStudentsLite || []);

        // Initialize import defaults if not yet selected
        if (!importGroupId && loadedGroups.length > 0) {
          setImportGroupId(loadedGroups[0].id);
          setImportAcademicYear(loadedGroups[0].academicYear || "الصف الثالث الثانوي");
        }
      }
    } catch (err) {
      console.error("Failed to fetch excel dataset:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchExcelDataset();
  }, [exportAcademicYear, exportGroupId, exportStudentStatus, exportMonth, exportPaymentFilter, includeFinancialsInfo]);

  // Synchronize preset toggles
  const handleSelectExportPreset = (preset: ExportPresetType) => {
    setExportPreset(preset);
    if (preset === "all") {
      setIncludeStudentGroupInfo(true);
      setIncludePhonesInfo(true);
      setIncludeFinancialsInfo(true);
    } else if (preset === "students_group") {
      setIncludeStudentGroupInfo(true);
      setIncludePhonesInfo(false);
      setIncludeFinancialsInfo(false);
    } else if (preset === "financials") {
      setIncludeStudentGroupInfo(true);
      setIncludePhonesInfo(false);
      setIncludeFinancialsInfo(true);
    } else if (preset === "phones") {
      setIncludeStudentGroupInfo(true);
      setIncludePhonesInfo(true);
      setIncludeFinancialsInfo(false);
    }
  };

  // Filtered groups for Export dropdown when Academic Year is selected
  const filteredExportGroups = useMemo(() => {
    if (exportAcademicYear === "ALL") return groups;
    return groups.filter((g) => g.academicYear === exportAcademicYear);
  }, [groups, exportAcademicYear]);

  // Filtered groups for Import dropdown based on selected Academic Year
  const filteredImportGroups = useMemo(() => {
    const matching = groups.filter((g) => g.academicYear === importAcademicYear);
    return matching.length > 0 ? matching : groups;
  }, [groups, importAcademicYear]);

  // Active columns for export based on user selection (الطلاب/مجموعة - مالياتهم - أرقامهم)
  const activeExportColumns = useMemo<ExcelColumnSpec[]>(() => {
    const cols: ExcelColumnSpec[] = [
      { header: "كود الطالب", key: "code", width: 14, type: "string" },
      { header: "اسم الطالب", key: "name", width: 28, type: "string" },
    ];

    if (includeStudentGroupInfo) {
      cols.push(
        { header: "السنة الدراسية", key: "academicYear", width: 22, type: "string" },
        { header: "المجموعة الدراسية", key: "groupName", width: 24, type: "string" }
      );
      if (exportPreset === "students_group" || exportPreset === "all") {
        cols.push(
          { header: "قيمة الاشتراك الشهري (ج.م)", key: "monthlyFee", width: 20, type: "number" },
          { header: "حالة القيد", key: "statusArabic", width: 14, type: "string" }
        );
      }
    }

    if (includePhonesInfo) {
      cols.push(
        { header: "رقم هاتف ولي الأمر (واتساب)", key: "parentPhone", width: 22, type: "string" },
        { header: "رقم هاتف الطالب", key: "studentPhone", width: 20, type: "string" }
      );
    }

    if (includeFinancialsInfo) {
      // Ensure monthlyFee is present if not already added
      if (!cols.some((c) => c.key === "monthlyFee")) {
        cols.push({ header: "قيمة الاشتراك الشهري (ج.م)", key: "monthlyFee", width: 20, type: "number" });
      }
      cols.push(
        { header: "الشهر المالي", key: "month", width: 14, type: "string" },
        { header: "حالة السداد", key: "paymentStatusArabic", width: 18, type: "string" },
        { header: "المبلغ المدفوع (ج.م)", key: "paidAmount", width: 18, type: "number" },
        { header: "المبلغ المتبقي (ج.م)", key: "remainingAmount", width: 18, type: "number" },
        { header: "ملاحظات المالية", key: "financialNotes", width: 24, type: "string" }
      );
    }

    if (exportPreset === "students_group") {
      cols.push({ header: "ملاحظات الطالب", key: "studentNotes", width: 24, type: "string" });
    }

    return cols;
  }, [exportPreset, includeStudentGroupInfo, includePhonesInfo, includeFinancialsInfo]);

  // Search filter on export preview rows
  const displayedExportRows = useMemo(() => {
    if (!exportSearchQuery.trim()) return exportRows;
    const q = exportSearchQuery.toLowerCase().trim();
    return exportRows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.studentPhone?.includes(q) ||
        r.parentPhone?.includes(q) ||
        r.groupName?.toLowerCase().includes(q)
    );
  }, [exportRows, exportSearchQuery]);

  // Trigger native .xlsx download
  const handleDownloadExportXlsx = () => {
    if (displayedExportRows.length === 0) return;
    const presetLabel =
      exportPreset === "financials"
        ? `ماليات_${exportMonth}`
        : exportPreset === "phones"
        ? "ارقام_الهواتف"
        : exportPreset === "students_group"
        ? "كشف_الطلاب"
        : "تقرير_شامل";

    const bytes = generateXlsxWorkbook({
      sheetName: presetLabel,
      columns: activeExportColumns,
      rows: displayedExportRows,
    });

    const blob = new Blob([bytes as unknown as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تصدير_السنتر_${presetLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Trigger UTF-8 BOM .csv download
  const handleDownloadExportCsv = () => {
    if (displayedExportRows.length === 0) return;
    const csvContent = generateUtf8BomCsv({
      columns: activeExportColumns,
      rows: displayedExportRows,
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تصدير_السنتر_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==========================================================================
  // IMPORT HELPERS & RE-COMPUTATION
  // ==========================================================================

  // Download ready-to-fill Student Import Template (.xlsx)
  const handleDownloadImportTemplate = () => {
    const selectedGroupObj = groups.find((g) => g.id === importGroupId);
    const sampleGroupName = selectedGroupObj?.name || "مجموعة العباقرة (أ)";
    const sampleYear = importAcademicYear || selectedGroupObj?.academicYear || "الصف الثالث الثانوي";

    const templateCols: ExcelColumnSpec[] = [
      { header: "اسم الطالب", key: "name", width: 28, type: "string" },
      { header: "رقم هاتف ولي الأمر", key: "parentPhone", width: 22, type: "string" },
      { header: "رقم هاتف الطالب", key: "studentPhone", width: 22, type: "string" },
      { header: "قيمة الاشتراك الشهري", key: "monthlyFee", width: 20, type: "number" },
      { header: "السنة الدراسية", key: "academicYear", width: 22, type: "string" },
      { header: "المجموعة", key: "groupName", width: 24, type: "string" },
      { header: "ملاحظات", key: "notes", width: 24, type: "string" },
    ];

    const sampleRows = [
      {
        name: "أحمد مصطفى كامل",
        parentPhone: "01012345678",
        studentPhone: "01198765432",
        monthlyFee: defaultMonthlyFee || 250,
        academicYear: sampleYear,
        groupName: sampleGroupName,
        notes: "مثال توضيحي - يمكنك مسحه وكتابة طلابك",
      },
      {
        name: "سارة محمود إبراهيم",
        parentPhone: "01234567890",
        studentPhone: "01555667788",
        monthlyFee: defaultMonthlyFee || 250,
        academicYear: sampleYear,
        groupName: sampleGroupName,
        notes: "",
      },
    ];

    const bytes = generateXlsxWorkbook({
      sheetName: "قالب استيراد الطلاب",
      columns: templateCols,
      rows: sampleRows,
    });

    const blob = new Blob([bytes as unknown as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `قالب_استيراد_طلاب_السنتر.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Build validated preview rows whenever rawSheetRows, columnMapping, headerRowIndex, or destination group changes
  useEffect(() => {
    if (rawSheetRows.length === 0) {
      setPreviewRows([]);
      return;
    }

    const startIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const dataSlice = rawSheetRows.slice(startIdx);

    // Find column indices for each field
    const findCol = (field: ImportFieldKey): number => {
      const entry = Object.entries(columnMapping).find(([, val]) => val === field);
      return entry ? Number(entry[0]) : -1;
    };

    const nameCol = findCol("name");
    const parentPhoneCol = findCol("parentPhone");
    const studentPhoneCol = findCol("studentPhone");
    const feeCol = findCol("monthlyFee");
    const yearCol = findCol("academicYear");
    const groupCol = findCol("groupName");
    const notesCol = findCol("notes");
    const codeCol = findCol("code");

    // Existing DB lookup for duplicate flagging
    const dbNamesInGroup = new Set(
      existingStudents
        .filter((s) => s.groupId === importGroupId)
        .map((s) => normalizeArabicKey(s.name))
    );

    const seenInSheet = new Set<string>();
    const built: ParsedPreviewRow[] = [];

    dataSlice.forEach((rowCells, idx) => {
      if (!rowCells || rowCells.every((c) => !c || !c.trim())) return;

      const rawName = nameCol >= 0 ? rowCells[nameCol] : rowCells[0];
      const nameCheck = sanitizeStudentName(rawName);
      if (nameCheck.isHeaderOrSummary) return; // Skip summary/total/repeated header rows automatically!

      const rawParent = parentPhoneCol >= 0 ? rowCells[parentPhoneCol] : "";
      const rawStudent = studentPhoneCol >= 0 ? rowCells[studentPhoneCol] : "";
      const rawFee = feeCol >= 0 ? rowCells[feeCol] : "";
      const rawYear = yearCol >= 0 ? rowCells[yearCol] : "";
      const rawGroup = groupCol >= 0 ? rowCells[groupCol] : "";
      const rawNotes = notesCol >= 0 ? rowCells[notesCol] : "";
      const rawCode = codeCol >= 0 ? rowCells[codeCol] : "";

      const parentSanitized = sanitizePhoneNumber(rawParent);
      const studentSanitized = sanitizePhoneNumber(rawStudent);
      const feeSanitized = sanitizeMonthlyFee(rawFee, defaultMonthlyFee);
      const normalizedYear = normalizeAcademicYear(rawYear, importAcademicYear);

      const repairDetails: string[] = [];
      if (parentSanitized.wasRepaired) {
        repairDetails.push(`إصلاح رقم ولي الأمر (${parentSanitized.phone})`);
      }
      if (studentSanitized.wasRepaired) {
        repairDetails.push(`إصلاح رقم الطالب (${studentSanitized.phone})`);
      }

      const normName = normalizeArabicKey(nameCheck.name);
      const isDuplicateInSheet = normName.length > 0 && seenInSheet.has(normName);
      if (normName.length > 0) seenInSheet.add(normName);

      const isDuplicateInDb = normName.length > 0 && dbNamesInGroup.has(normName);

      built.push({
        rowId: `imp-row-${idx}`,
        sourceRowNumber: startIdx + idx + 1,
        selected: nameCheck.isValid && !(isDuplicateInSheet || (isDuplicateInDb && duplicateMode === "skip")),
        name: nameCheck.name,
        parentPhone: parentSanitized.phone,
        studentPhone: studentSanitized.phone,
        monthlyFee: feeSanitized.fee,
        academicYear: normalizedYear,
        groupNameFromSheet: (rawGroup || "").trim(),
        notes: (rawNotes || "").trim(),
        codeFromSheet: (rawCode || "").trim(),
        isValidName: nameCheck.isValid,
        nameError: nameCheck.error,
        parentPhoneWarning: parentSanitized.warning,
        studentPhoneWarning: studentSanitized.warning,
        wasAutoRepaired: repairDetails.length > 0,
        repairDetails,
        isDuplicateInSheet,
        isDuplicateInDb,
      });
    });

    setPreviewRows(built);
  }, [rawSheetRows, columnMapping, headerRowIndex, importGroupId, importAcademicYear, defaultMonthlyFee, existingStudents, duplicateMode]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setParseError("");
    setImportResultBanner(null);
    setIsParsingFile(true);
    setUploadedFileName(file.name);

    try {
      const { rows } = await parseUploadedSheetFile(file);
      const detection = detectHeaderAndColumns(rows);
      setRawSheetRows(rows);
      setHeaderRowIndex(detection.headerRowIndex);
      setDetectedHeaders(detection.headers);
      setColumnMapping(detection.mapping);
    } catch (err: any) {
      setRawSheetRows([]);
      setPreviewRows([]);
      setParseError(err?.message || "تعذر قراءة الملف. تأكد من أنه ملف Excel (.xlsx) أو (.csv) سليم.");
    } finally {
      setIsParsingFile(false);
    }
  };

  // Inline edit of a preview row cell
  const handleUpdatePreviewRow = (rowId: string, field: keyof ParsedPreviewRow, value: any) => {
    setPreviewRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const updated = { ...row, [field]: value };
        if (field === "name") {
          const check = sanitizeStudentName(value);
          updated.isValidName = check.isValid;
          updated.nameError = check.error;
        } else if (field === "parentPhone") {
          const p = sanitizePhoneNumber(value);
          updated.parentPhone = p.phone;
          updated.parentPhoneWarning = p.warning;
        } else if (field === "studentPhone") {
          const p = sanitizePhoneNumber(value);
          updated.studentPhone = p.phone;
          updated.studentPhoneWarning = p.warning;
        }
        return updated;
      })
    );
  };

  // Quick Create Group Handler
  const handleQuickCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickGroupName.trim()) return;
    try {
      setIsCreatingGroup(true);
      const res = await fetch("/api/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quickCreateGroup",
          name: quickGroupName.trim(),
          teacher: quickGroupTeacher.trim() || "إدارة السنتر",
          academicYear: importAcademicYear,
          subject: quickGroupSubject.trim() || "مادة عامة",
        }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroups(data.groups || []);
        setImportGroupId(data.group.id);
        setQuickGroupName("");
        setQuickGroupTeacher("");
        setQuickGroupSubject("");
        setIsQuickGroupOpen(false);
      }
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Execute Final Import to Database
  const handleConfirmImport = async () => {
    const selectedValidRows = previewRows.filter((r) => r.selected && r.isValidName);
    if (selectedValidRows.length === 0) {
      setParseError("يرجى تحديد طالب واحد صالح على الأقل للاستيراد.");
      return;
    }
    if (!importGroupId) {
      setParseError("يرجى اختيار المجموعة الدراسية المستهدفة أولاً.");
      return;
    }

    try {
      setIsImporting(true);
      setParseError("");

      const targetGroupObj = groups.find((g) => g.id === importGroupId);

      const payloadRows = selectedValidRows.map((r) => ({
        name: r.name.trim(),
        parentPhone: r.parentPhone.trim(),
        studentPhone: r.studentPhone.trim(),
        monthlyFee: Number(r.monthlyFee) >= 0 ? Number(r.monthlyFee) : defaultMonthlyFee,
        academicYear: importAcademicYear || r.academicYear,
        groupId: respectSheetGroupIfMatched ? undefined : importGroupId,
        groupName: respectSheetGroupIfMatched ? r.groupNameFromSheet : targetGroupObj?.name,
        notes: r.notes,
        code: r.codeFromSheet,
      }));

      const res = await fetch("/api/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkImport",
          rows: payloadRows,
          defaultGroupId: importGroupId,
          defaultAcademicYear: importAcademicYear,
          defaultMonthlyFee,
          duplicateMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "حدث خطأ أثناء حفظ الطلاب");
      }

      setImportResultBanner({
        importedCount: data.importedCount || 0,
        updatedCount: data.updatedCount || 0,
        skippedCount: data.skippedCount || 0,
        groupName: targetGroupObj?.name || "المجموعة المختارة",
      });

      // Refresh dataset so export & duplicate checks are immediately up-to-date
      await fetchExcelDataset();
    } catch (err: any) {
      setParseError(err?.message || "حدث خطأ غير متوقع أثناء الاستيراد");
    } finally {
      setIsImporting(false);
    }
  };

  // Preview table stats
  const previewStats = useMemo(() => {
    const total = previewRows.length;
    const valid = previewRows.filter((r) => r.isValidName).length;
    const selected = previewRows.filter((r) => r.selected && r.isValidName).length;
    const autoRepaired = previewRows.filter((r) => r.wasAutoRepaired).length;
    const duplicates = previewRows.filter((r) => r.isDuplicateInDb || r.isDuplicateInSheet).length;
    const warnings = previewRows.filter(
      (r) => !r.isValidName || r.parentPhoneWarning || r.studentPhoneWarning
    ).length;
    return { total, valid, selected, autoRepaired, duplicates, warnings };
  }, [previewRows]);

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === "valid") return previewRows.filter((r) => r.isValidName && !r.isDuplicateInDb && !r.isDuplicateInSheet);
    if (previewFilter === "warnings")
      return previewRows.filter((r) => !r.isValidName || r.parentPhoneWarning || r.studentPhoneWarning);
    if (previewFilter === "duplicates")
      return previewRows.filter((r) => r.isDuplicateInDb || r.isDuplicateInSheet);
    return previewRows;
  }, [previewRows, previewFilter]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6FA] p-4 sm:p-6 lg:p-8 pb-16">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ================================================================
            PAGE HEADER & MODE SWITCHER (تصدير أو استيراد)
            ================================================================ */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  مركز تصدير واستيراد شيتات Excel
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
                  اختر بين تصدير بيانات مخصصة من السنتر إلى ملف Excel، أو استيراد كشوف الطلاب مع المعالجة الذكية للأخطاء البشرية
                </p>
              </div>
            </div>

            <Link
              href="/students"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all self-start md:self-auto"
            >
              <Users className="w-4 h-4" />
              <span>الذهاب لصفحة الطلاب والحسابات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Prominent Two-Choice Mode Cards: Export vs Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Choice 1: Export */}
            <button
              type="button"
              onClick={() => setActiveMode("export")}
              className={`text-right p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                activeMode === "export"
                  ? "border-blue-600 bg-blue-50/60 shadow-sm ring-2 ring-blue-500/15"
                  : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/70"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  activeMode === "export"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                <Download className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-black text-slate-900">
                    1. تصدير بيانات من التطبيق (Export)
                  </h2>
                  {activeMode === "export" && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-600 text-white">
                      الوضع النشط
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                  تصدير شيت Excel احترافي حسب اختيارك: <strong>(الطلاب/مجموعة - مالياتهم - أرقامهم)</strong> مع دعم الفلترة بالسنة والمجموعة والشهر المالي.
                </p>
              </div>
            </button>

            {/* Choice 2: Import (Students Only) */}
            <button
              type="button"
              onClick={() => setActiveMode("import")}
              className={`text-right p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                activeMode === "import"
                  ? "border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/15"
                  : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/70"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  activeMode === "import"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                <Upload className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-black text-slate-900">
                    2. استيراد طلاب إلى التطبيق (Import)
                  </h2>
                  {activeMode === "import" && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white">
                      الوضع النشط
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                  مخصص لاستيراد <strong>بيانات الطلاب فقط</strong> (الاسم، الأرقام، المبلغ، السنة الدراسية، المجموعة) مع تصحيح تلقائي للأرقام ومنع التكرار.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ================================================================
            MODE 1: EXPORT SECTION (تصدير: الطلاب/مجموعة - مالياتهم - أرقامهم)
            ================================================================ */}
        {activeMode === "export" && (
          <div className="space-y-6">
            {/* Step 1: Choose What to Export */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>حدد نوع البيانات والفلاتر المطلوب تصديرها</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر قالباً جاهزاً أو خصص الأقسام (الطلاب/المجموعة - الماليات - الأرقام)
                  </p>
                </div>

                {/* Download Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExportXlsx}
                    disabled={displayedExportRows.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل شيت Excel (.xlsx) ({displayedExportRows.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExportCsv}
                    disabled={displayedExportRows.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير CSV</span>
                  </button>
                </div>
              </div>

              {/* 4 Export Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectExportPreset("all")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                    exportPreset === "all"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold">1. كشف شامل ومتكامل</span>
                    <Layers className="w-4 h-4 opacity-90" />
                  </div>
                  <p className={`text-[11px] ${exportPreset === "all" ? "text-white/90" : "text-slate-500"}`}>
                    الطلاب والمجموعة + أرقام الهواتف + حالة الماليات
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectExportPreset("students_group")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                    exportPreset === "students_group"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold">2. الطلاب / المجموعة فقط</span>
                    <Users className="w-4 h-4 opacity-90" />
                  </div>
                  <p className={`text-[11px] ${exportPreset === "students_group" ? "text-white/90" : "text-slate-500"}`}>
                    الاسم، الكود، السنة الدراسية، المجموعة، الاشتراك، الحالة
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectExportPreset("financials")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                    exportPreset === "financials"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold">3. كشف ماليات الطلاب</span>
                    <CreditCard className="w-4 h-4 opacity-90" />
                  </div>
                  <p className={`text-[11px] ${exportPreset === "financials" ? "text-white/90" : "text-slate-500"}`}>
                    الاشتراك الشهري، المسدد، المتبقي، وحالة الدفع للشهر
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectExportPreset("phones")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                    exportPreset === "phones"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold">4. أرقام الطلاب وأولياء الأمور</span>
                    <Phone className="w-4 h-4 opacity-90" />
                  </div>
                  <p className={`text-[11px] ${exportPreset === "phones" ? "text-white/90" : "text-slate-500"}`}>
                    دليل أرقام هواتف الطلاب وأرقام واتساب أولياء الأمور
                  </p>
                </button>
              </div>

              {/* Custom Data Pillars Checkboxes */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-slate-600 ml-1">تضمين الأعمدة في الملف:</span>
                <button
                  type="button"
                  onClick={() => {
                    setExportPreset("custom");
                    setIncludeStudentGroupInfo((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    includeStudentGroupInfo
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${includeStudentGroupInfo ? "opacity-100" : "opacity-30"}`} />
                  <span>بيانات الطالب والمجموعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportPreset("custom");
                    setIncludePhonesInfo((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    includePhonesInfo
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${includePhonesInfo ? "opacity-100" : "opacity-30"}`} />
                  <span>أرقام الهواتف (الطالب + ولي الأمر)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportPreset("custom");
                    setIncludeFinancialsInfo((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    includeFinancialsInfo
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${includeFinancialsInfo ? "opacity-100" : "opacity-30"}`} />
                  <span>الماليات والاشتراكات</span>
                </button>
              </div>

              {/* Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
                {/* 1. Academic Year Filter */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">السنة الدراسية</label>
                  <select
                    value={exportAcademicYear}
                    onChange={(e) => {
                      setExportAcademicYear(e.target.value);
                      setExportGroupId("ALL");
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="ALL">جميع السنوات الدراسية</option>
                    {CANONICAL_ACADEMIC_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Group Filter */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">المجموعة الدراسية</label>
                  <select
                    value={exportGroupId}
                    onChange={(e) => setExportGroupId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="ALL">جميع المجموعات ({filteredExportGroups.length})</option>
                    {filteredExportGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.academicYear})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Student Status Filter */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">حالة قيد الطلاب</label>
                  <select
                    value={exportStudentStatus}
                    onChange={(e) => setExportStudentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="active">الطلاب النشطون فقط (الفعليون)</option>
                    <option value="all">جميع الطلاب (النشطون والمنقطعون)</option>
                    <option value="inactive">الطلاب المنقطعون فقط</option>
                  </select>
                </div>

                {/* 4. Financial Month (when Financials enabled) */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">الشهر المالي</label>
                  <select
                    value={exportMonth}
                    disabled={!includeFinancialsInfo}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer disabled:opacity-50"
                  >
                    {MONTHS_LIST.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Payment Status Filter */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">فلتر حالة الدفع</label>
                  <select
                    value={exportPaymentFilter}
                    disabled={!includeFinancialsInfo}
                    onChange={(e) => setExportPaymentFilter(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="all">كل حالات السداد</option>
                    <option value="overdue">المتأخرون عن الدفع فقط (غير مسدد / جزئي)</option>
                    <option value="unpaid">غير المسددين نهائياً فقط</option>
                    <option value="paid">المسددون بالكامل فقط</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Export Live Preview Table & Summary Cards */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200">
                    إجمالي السجلات المطابقة: {displayedExportRows.length} طالب
                  </span>
                  {includeFinancialsInfo && (
                    <>
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200">
                        المحصل: {exportSummary.totalPaidAmount.toLocaleString("ar-EG")} ج.م
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-extrabold border border-red-200">
                        المتبقي المتأخر: {exportSummary.totalRemainingAmount.toLocaleString("ar-EG")} ج.م
                      </span>
                    </>
                  )}
                </div>

                {/* Quick Search in Export Table */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={exportSearchQuery}
                    onChange={(e) => setExportSearchQuery(e.target.value)}
                    placeholder="بحث سريع في الجدول قبل التصدير..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-right text-xs border-collapse bg-white">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-3 font-extrabold text-slate-600 w-12 text-center">#</th>
                        {activeExportColumns.map((col) => (
                          <th key={col.key} className="py-3 px-3.5 font-extrabold text-slate-700 whitespace-nowrap">
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={activeExportColumns.length + 1} className="py-12 text-center text-slate-500 font-bold">
                            جاري تحميل معاينة البيانات...
                          </td>
                        </tr>
                      ) : displayedExportRows.length === 0 ? (
                        <tr>
                          <td colSpan={activeExportColumns.length + 1} className="py-12 text-center text-slate-500 font-bold">
                            لا توجد بيانات مطابقة للفلاتر المحددة حالياً
                          </td>
                        </tr>
                      ) : (
                        displayedExportRows.slice(0, 150).map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            {activeExportColumns.map((col) => {
                              const val = row[col.key];
                              const isPhone = col.key.toLowerCase().includes("phone");
                              const isPaymentBadge = col.key === "paymentStatusArabic";
                              return (
                                <td
                                  key={col.key}
                                  className={`py-2.5 px-3.5 whitespace-nowrap ${
                                    col.key === "name"
                                      ? "font-extrabold text-slate-900"
                                      : isPhone || col.key === "code"
                                      ? "font-mono font-bold text-slate-700"
                                      : "font-medium text-slate-700"
                                  }`}
                                >
                                  {isPaymentBadge ? (
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                        row.paymentStatus === "paid"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : row.paymentStatus === "partial"
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-red-50 text-red-700 border-red-200"
                                      }`}
                                    >
                                      {String(val || "-")}
                                    </span>
                                  ) : (
                                    String(val ?? "-") || "-"
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {displayedExportRows.length > 150 && (
                  <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-500 border-t border-slate-200 text-center">
                    يتم عرض أول 150 طالباً في المعاينة السريعة، وسيتم تصدير جميع الـ {displayedExportRows.length} طالباً بالكامل عند الضغط على تحميل Excel.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            MODE 2: IMPORT SECTION (استيراد الطلاب فقط مع معالجة كافة الأخطاء)
            ================================================================ */}
        {activeMode === "import" && (
          <div className="space-y-6">
            {/* Success Banner after import */}
            {importResultBanner && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-900">
                      تمت عملية استيراد الطلاب بنجاح إلى ({importResultBanner.groupName})!
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-bold text-emerald-800">
                      <span>✓ طلاب جدد تم إضافتهم: {importResultBanner.importedCount}</span>
                      {importResultBanner.updatedCount > 0 && (
                        <span>• طلاب تم تحديث بياناتهم: {importResultBanner.updatedCount}</span>
                      )}
                      {importResultBanner.skippedCount > 0 && (
                        <span>• مكررون تم تخطيهم: {importResultBanner.skippedCount}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/students?groupId=${encodeURIComponent(importGroupId)}`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all"
                  >
                    عرض طلاب المجموعة الآن
                  </Link>
                  <button
                    type="button"
                    onClick={() => setImportResultBanner(null)}
                    className="p-2 rounded-xl text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Select Destination Academic Year, Group & Defaults */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>الخطوة 1: حدد السنة الدراسية والمجموعة المستهدفة للاستيراد</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الاستيراد مخصص لبيانات الطلاب فقط (الاسم، رقم ولي الأمر، رقم الطالب، المبلغ، السنة الدراسية، المجموعة)
                  </p>
                </div>

                {/* Download Ready-to-Fill Excel Template */}
                <button
                  type="button"
                  onClick={handleDownloadImportTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-extrabold transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل قالب Excel فارغ جاهز للتعبئة (.xlsx)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Target Academic Year */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    1. السنة الدراسية المستهدفة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={importAcademicYear}
                    onChange={(e) => {
                      const nextYear = e.target.value;
                      setImportAcademicYear(nextYear);
                      const firstGrpInYear = groups.find((g) => g.academicYear === nextYear);
                      if (firstGrpInYear) {
                        setImportGroupId(firstGrpInYear.id);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {CANONICAL_ACADEMIC_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Target Group + Quick Create Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      2. المجموعة المستهدفة <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickGroupOpen((v) => !v)}
                      className="text-[11px] font-extrabold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>مجموعة جديدة</span>
                    </button>
                  </div>
                  <select
                    value={importGroupId}
                    onChange={(e) => {
                      const gId = e.target.value;
                      setImportGroupId(gId);
                      const grp = groups.find((g) => g.id === gId);
                      if (grp?.academicYear) {
                        setImportAcademicYear(grp.academicYear);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {filteredImportGroups.length === 0 ? (
                      <option value="">-- أنشئ مجموعة أولاً --</option>
                    ) : (
                      filteredImportGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.academicYear})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* 3. Default Monthly Fee */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    3. الاشتراك الشهري الافتراضي (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50000}
                    value={defaultMonthlyFee}
                    onChange={(e) => setDefaultMonthlyFee(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                    placeholder="250"
                  />
                  <span className="block text-[10px] text-slate-400">
                    يُطبق تلقائياً إذا كانت خانة المبلغ فارغة في الشيت
                  </span>
                </div>

                {/* 4. Duplicate Handling Mode */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    4. عند وجود طالب مكرر بنفس الاسم
                  </label>
                  <select
                    value={duplicateMode}
                    onChange={(e) => setDuplicateMode(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="skip">تخطي المكرر وعدم إضافته مرتين (موصى به)</option>
                    <option value="update">تحديث أرقام ومبلغ الطالب المسجل مسبقاً</option>
                    <option value="allow">إضافته كطالب جديد بكود مختلف</option>
                  </select>
                </div>
              </div>

              {/* Inline Quick Create Group Form */}
              {isQuickGroupOpen && (
                <form
                  onSubmit={handleQuickCreateGroup}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">
                      إنشاء مجموعة جديدة سريعاً ({importAcademicYear})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsQuickGroupOpen(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      required
                      value={quickGroupName}
                      onChange={(e) => setQuickGroupName(e.target.value)}
                      placeholder="اسم المجموعة (مثال: مجموعة الأحد والأربعاء) *"
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800"
                    />
                    <input
                      type="text"
                      value={quickGroupSubject}
                      onChange={(e) => setQuickGroupSubject(e.target.value)}
                      placeholder="المادة (اختياري)"
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingGroup}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer"
                    >
                      {isCreatingGroup ? "جاري الإنشاء..." : "حفظ واختيار المجموعة"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Step 2: Upload Sheet File Dropzone */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>الخطوة 2: ارفع شيت الطلاب (.xlsx أو .csv)</span>
              </h3>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.tsv,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  handleFileChange(f);
                  e.target.value = "";
                }}
                className="hidden"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0] || null;
                  handleFileChange(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-slate-100/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <FileCheck2 className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {uploadedFileName
                      ? `الملف المرفوع: ${uploadedFileName} (انقر لاختيار ملف آخر)`
                      : "اضغط هنا لاختيار شيت Excel من جهازك أو اسحب الملف وأفلته هنا"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات Microsoft Excel الحديثة (<strong>.xlsx</strong>) وملفات Google Sheets (<strong>.csv</strong>) مع إصلاح تلقائي للأرقام التي حُذف منها الصفر الأول
                  </p>
                </div>
              </div>

              {parseError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs font-bold text-red-700">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            {/* Step 3: Smart Column Mapping & Interactive Validation Preview */}
            {rawSheetRows.length > 0 && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      <span>الخطوة 3: مراجعة ربط الأعمدة والتدقيق التلقائي قبل الحفظ</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تم التعرف على أعمدة الملف وإصلاح صيغ الهواتف والمبالغ تلقائياً — يمكنك تعديل أي خانة مباشرة في الجدول أدناه
                    </p>
                  </div>

                  {/* Final Confirm Import Button */}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting || previewStats.selected === 0}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isImporting
                        ? "جاري استيراد وحفظ الطلاب..."
                        : `تأكيد استيراد (${previewStats.selected}) طالب الآن`}
                    </span>
                  </button>
                </div>

                {/* Column Mapping Bar */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">
                      ربط أعمدة الشيت ببيانات التطبيق (تم الربط الذكي تلقائياً):
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      إذا كان أحد الأعمدة غير مربوط، اختر نوعه من القائمة المنسدلة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {detectedHeaders.map((colHeader, colIdx) => {
                      const mappedTo = columnMapping[colIdx] || "ignore";
                      return (
                        <div
                          key={colIdx}
                          className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                            mappedTo !== "ignore"
                              ? "bg-white border-blue-300"
                              : "bg-slate-100/70 border-slate-200 opacity-75"
                          }`}
                        >
                          <span className="text-[11px] font-bold text-slate-500 truncate" title={colHeader}>
                            عمود الملف: <strong className="text-slate-800">{colHeader}</strong>
                          </span>
                          <select
                            value={mappedTo}
                            onChange={(e) =>
                              setColumnMapping((prev) => ({
                                ...prev,
                                [colIdx]: e.target.value as ImportFieldKey,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800 outline-none cursor-pointer"
                          >
                            <option value="name">اسم الطالب (أساسي)</option>
                            <option value="parentPhone">رقم هاتف ولي الأمر (واتساب)</option>
                            <option value="studentPhone">رقم هاتف الطالب</option>
                            <option value="monthlyFee">قيمة الاشتراك الشهري (المبلغ)</option>
                            <option value="academicYear">السنة الدراسية</option>
                            <option value="groupName">اسم المجموعة</option>
                            <option value="notes">ملاحظات</option>
                            <option value="code">كود الطالب (إن وجد)</option>
                            <option value="ignore">-- تجاهل هذا العمود --</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Diagnostic Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        previewFilter === "all"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      إجمالي الصفوف ({previewStats.total})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewFilter("valid")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        previewFilter === "valid"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      جاهز ومحدد للاستيراد ({previewStats.selected})
                    </button>

                    {previewStats.autoRepaired > 0 && (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        ✨ أرقام تم إصلاح صيغتها تلقائياً: {previewStats.autoRepaired}
                      </span>
                    )}

                    {previewStats.duplicates > 0 && (
                      <button
                        type="button"
                        onClick={() => setPreviewFilter("duplicates")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          previewFilter === "duplicates"
                            ? "bg-slate-800 text-white border-slate-800"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        طلاب مكررون ({previewStats.duplicates})
                      </button>
                    )}

                    {previewStats.warnings > 0 && (
                      <button
                        type="button"
                        onClick={() => setPreviewFilter("warnings")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          previewFilter === "warnings"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        تنبيهات الأرقام أو الأسماء ({previewStats.warnings})
                      </button>
                    )}
                  </div>

                  {/* Select All / Deselect All */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewRows((prev) =>
                          prev.map((r) => ({ ...r, selected: r.isValidName }))
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                    >
                      تحديد كل الصالحين
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewRows((prev) => prev.map((r) => ({ ...r, selected: false })))
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* Interactive Editable Preview Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="max-h-[460px] overflow-auto">
                    <table className="w-full text-right text-xs border-collapse bg-white">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-3 px-3 font-extrabold text-slate-600 w-10 text-center">استيراد</th>
                          <th className="py-3 px-2 font-extrabold text-slate-600 w-12 text-center">صف</th>
                          <th className="py-3 px-3 font-extrabold text-slate-700 min-w-[210px]">اسم الطالب *</th>
                          <th className="py-3 px-3 font-extrabold text-slate-700 min-w-[150px]">هاتف ولي الأمر (واتساب)</th>
                          <th className="py-3 px-3 font-extrabold text-slate-700 min-w-[150px]">هاتف الطالب</th>
                          <th className="py-3 px-3 font-extrabold text-slate-700 w-28">الاشتراك (ج.م)</th>
                          <th className="py-3 px-3 font-extrabold text-slate-700 min-w-[180px]">الحالة والتدقيق التلقائي</th>
                          <th className="py-3 px-2 font-extrabold text-slate-600 w-10 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPreviewRows.map((row) => (
                          <tr
                            key={row.rowId}
                            className={`transition-colors ${
                              !row.selected ? "opacity-60 bg-slate-50/50" : "hover:bg-slate-50/80"
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                disabled={!row.isValidName}
                                onChange={(e) =>
                                  handleUpdatePreviewRow(row.rowId, "selected", e.target.checked)
                                }
                                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                              />
                            </td>

                            {/* Row number */}
                            <td className="py-2 px-2 text-center font-mono text-slate-400">
                              {row.sourceRowNumber}
                            </td>

                            {/* Editable Student Name */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) =>
                                  handleUpdatePreviewRow(row.rowId, "name", e.target.value)
                                }
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-none ${
                                  row.isValidName
                                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                                    : "bg-red-50 border-red-300 text-red-800"
                                }`}
                              />
                            </td>

                            {/* Editable Parent Phone */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.parentPhone}
                                onChange={(e) =>
                                  handleUpdatePreviewRow(row.rowId, "parentPhone", e.target.value)
                                }
                                placeholder="010..."
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none ${
                                  row.parentPhoneWarning
                                    ? "bg-red-50 border-red-300 text-red-700"
                                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500"
                                }`}
                              />
                            </td>

                            {/* Editable Student Phone */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.studentPhone}
                                onChange={(e) =>
                                  handleUpdatePreviewRow(row.rowId, "studentPhone", e.target.value)
                                }
                                placeholder="011..."
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none ${
                                  row.studentPhoneWarning
                                    ? "bg-red-50 border-red-300 text-red-700"
                                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500"
                                }`}
                              />
                            </td>

                            {/* Editable Monthly Fee */}
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                value={row.monthlyFee}
                                onChange={(e) =>
                                  handleUpdatePreviewRow(
                                    row.rowId,
                                    "monthlyFee",
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                              />
                            </td>

                            {/* Status & Auto-Repair Badges */}
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap items-center gap-1">
                                {!row.isValidName ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                    {row.nameError || "الاسم غير صالح"}
                                  </span>
                                ) : row.isDuplicateInDb ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                    مسجل مسبقاً بالمجموعة
                                  </span>
                                ) : row.isDuplicateInSheet ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                    مكرر داخل نفس الشيت
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    صالح وجاهز ✓
                                  </span>
                                )}

                                {row.wasAutoRepaired && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                    title={row.repairDetails.join("، ")}
                                  >
                                    تم إصلاح الرقم تلقائياً
                                  </span>
                                )}

                                {(row.parentPhoneWarning || row.studentPhoneWarning) && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                    {row.parentPhoneWarning || row.studentPhoneWarning}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Remove Row */}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewRows((prev) => prev.filter((r) => r.rowId !== row.rowId))
                                }
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="حذف هذا الصف من المعاينة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

