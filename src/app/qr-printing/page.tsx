"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  QrCode,
  Users,
  Search,
  Printer,
  Save,
  Send,
  MessageCircle,
  FileText,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckSquare,
  Square,
  Sparkles,
  Download,
} from "lucide-react";
import { Group, Student, SavedQrPdf } from "@/lib/types/management";
import { generateQrDataUrl, getStudentQrUrl } from "@/lib/qr-service";
import { notifyTenantDataMutated } from "@/lib/client-session-cache";
import StudentProfileModal from "@/components/students/StudentProfileModal";

function QrPrintingContent() {
  const searchParams = useSearchParams();
  const paramGroupId = searchParams.get("groupId");
  const paramStudentIds = searchParams.get("studentIds")?.split(",").filter(Boolean) || [];

  const [activeTab, setActiveTab] = useState<"group" | "specific" | "archive">("group");

  // Groups and Students data
  const [groups, setGroups] = useState<Group[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(paramGroupId || "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(paramStudentIds);
  const [searchStudentQuery, setSearchStudentQuery] = useState("");

  // Saved PDFs Archive
  const [savedPdfs, setSavedPdfs] = useState<SavedQrPdf[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Split-view Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [qrImagesMap, setQrImagesMap] = useState<Record<string, string>>({});
  const [isGeneratingQrs, setIsGeneratingQrs] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState("");

  // Student Profile Modal
  const [activeStudentProfileId, setActiveStudentProfileId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
    const onSync = () => {
      fetchInitialData(true);
    };
    window.addEventListener("tenant-data-mutated", onSync);
    window.addEventListener("focus", onSync);
    return () => {
      window.removeEventListener("tenant-data-mutated", onSync);
      window.removeEventListener("focus", onSync);
    };
  }, []);

  const fetchInitialData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const ts = Date.now();
      const [resGroups, resStudents, resPdfs] = await Promise.all([
        fetch(`/api/groups?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/students?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/qr-sheets?t=${ts}`, { cache: "no-store" }),
      ]);

      const dataGroups = await resGroups.json();
      const dataStudents = await resStudents.json();
      const dataPdfs = await resPdfs.json();

      if (dataGroups.success) setGroups(dataGroups.groups || []);
      if (dataStudents.success) {
        setAllStudents(dataStudents.students || []);
        // If paramGroupId provided or first group, auto select its students
        const gid = paramGroupId || dataGroups.groups?.[0]?.id;
        if (gid) {
          setSelectedGroupId(gid);
          if (paramStudentIds.length === 0) {
            const grpStudents = (dataStudents.students || []).filter((s: Student) => s.groupId === gid);
            setSelectedStudentIds(grpStudents.map((s: Student) => s.id));
          }
        }
      }
      if (dataPdfs.success) setSavedPdfs(dataPdfs.sheets || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // When selectedGroupId changes in "group" tab, auto-select all students of that group
  const handleGroupChange = (gid: string) => {
    setSelectedGroupId(gid);
    const grpStudents = allStudents.filter((s) => s.groupId === gid);
    setSelectedStudentIds(grpStudents.map((s) => s.id));
  };

  // Toggle single student
  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select / Deselect All for group tab
  const handleToggleSelectAll = () => {
    const currentGroupStudents = allStudents.filter((s) => s.groupId === selectedGroupId);
    if (selectedStudentIds.length === currentGroupStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(currentGroupStudents.map((s) => s.id));
    }
  };

  // Launch Split Preview
  const handleOpenPreview = async (overrideStudentIds?: string[], customTitle?: string) => {
    const targetIds = overrideStudentIds || selectedStudentIds;
    if (targetIds.length === 0) {
      alert("يرجى اختيار طالب واحد على الأقل للطباعة");
      return;
    }

    try {
      setIsGeneratingQrs(true);
      setIsPreviewOpen(true);
      const targetGroup = groups.find((g) => g.id === selectedGroupId);
      const defaultName =
        customTitle ||
        `بطاقات QR - ${targetGroup?.name || "مجموعة مخصصة"} - ${new Date().toLocaleDateString("ar-EG")}`;
      setPdfTitle(defaultName);

      // Generate QR data URLs for all selected students with full smart public parent URL
      const newMap: Record<string, string> = {};
      const targetStudents = allStudents.filter((s) => targetIds.includes(s.id));

      await Promise.all(
        targetStudents.map(async (st) => {
          const qrUrl = getStudentQrUrl(st.code || st.id);
          const url = await generateQrDataUrl(qrUrl, 260);
          newMap[st.id] = url;
        })
      );

      setQrImagesMap(newMap);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingQrs(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdfDocument = async () => {
    if (!pdfTitle.trim() || selectedStudentIds.length === 0) return;
    try {
      setIsSavingPdf(true);
      const targetGroup = groups.find((g) => g.id === selectedGroupId);

      const res = await fetch("/api/qr-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pdfTitle.trim(),
          groupName: targetGroup?.name || "مجموعة مخصصة",
          studentIds: selectedStudentIds,
          pagesCount: Math.ceil(selectedStudentIds.length / 12) || 1,
        }),
      });

      const data = await res.json();
      if (data.success && data.pdf) {
        setSavedPdfs((prev) => [data.pdf, ...prev]);
        notifyTenantDataMutated();
        setSavedSuccessMsg("تم حفظ المستند في الأرشيف بنجاح ✓");
        setTimeout(() => setSavedSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleDeleteSavedPdf = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستند من الأرشيف؟")) return;
    try {
      await fetch(`/api/qr-sheets?id=${id}`, { method: "DELETE" });
      setSavedPdfs((prev) => prev.filter((p) => p.id !== id));
      notifyTenantDataMutated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendToWhatsApp = () => {
    const targetStudents = allStudents.filter((s) => selectedStudentIds.includes(s.id));
    const firstWithPhone = targetStudents.find((s) => s.parentPhone);
    const phone = firstWithPhone?.parentPhone?.replace(/\D/g, "") || "";
    const cleanPhone = phone.startsWith("0") ? "2" + phone : phone;

    const msg = `مرحباً، تم تجهيز بطاقات ورموز QR للطلاب في ${pdfTitle}.
إجمالي الطلاب: ${selectedStudentIds.length} طالب.`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Selected students for printing
  const previewStudents = allStudents.filter((s) => selectedStudentIds.includes(s.id));

  // Chunk students into pages of 12 (3 columns x 4 rows fits comfortably on standard A4 with 5x5 cm boxes)
  const pageSize = 12;
  const pages: Student[][] = [];
  for (let i = 0; i < previewStudents.length; i += pageSize) {
    pages.push(previewStudents.slice(i, i + pageSize));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/60 print:p-0 print:bg-white print:overflow-visible">
      {/* Printable Area Wrapper (Visible on Print) */}
      <div className="max-w-6xl mx-auto space-y-6 pb-24 print:max-w-none print:m-0 print:p-0">
        {/* Top Header (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                طباعة بطاقات ورموز QR للطلاب
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                توليد بطاقات بحجم 5×5 سم لكل طالب مع الاسم والسنة الدراسية والمجموعة جاهزة للقص والطباعة A4
              </p>
            </div>
          </div>
        </div>

        {/* 3 CHOICES TABS (Hidden on Print) */}
        {!isPreviewOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-200/70 p-1.5 rounded-2xl print:hidden">
            <button
              onClick={() => setActiveTab("group")}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "group"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>طباعة لمجموعة كاملة</span>
            </button>

            <button
              onClick={() => setActiveTab("specific")}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "specific"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>تحديد طلاب محددين</span>
            </button>

            <button
              onClick={() => setActiveTab("archive")}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "archive"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>ملفات PDF المنشأة للطباعة ({savedPdfs.length})</span>
            </button>
          </div>
        )}

        {/* =========================================================================
            TAB 1: PRINTING FOR WHOLE GROUP
            ========================================================================= */}
        {!isPreviewOpen && activeTab === "group" && (
          <div className="space-y-4 print:hidden">
            {/* Group Selector & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">اختر المجموعة:</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  {selectedStudentIds.length === allStudents.filter((s) => s.groupId === selectedGroupId).length
                    ? "إلغاء تحديد الكل"
                    : "تحديد الكل"}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenPreview()}
                  disabled={selectedStudentIds.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  <span>معاينة وطباعة المستند ({selectedStudentIds.length})</span>
                </button>
              </div>
            </div>

            {/* Students List in Group with Checkboxes */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedStudentIds.length ===
                              allStudents.filter((s) => s.groupId === selectedGroupId).length &&
                            allStudents.filter((s) => s.groupId === selectedGroupId).length > 0
                          }
                          onChange={handleToggleSelectAll}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">كود الطالب</th>
                      <th className="p-4">الصف الدراسي</th>
                      <th className="p-4">هاتف ولي الأمر</th>
                      <th className="p-4">حالة الحساب</th>
                      <th className="p-4 text-center">الملف الشخصي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allStudents
                      .filter((s) => s.groupId === selectedGroupId)
                      .map((st) => {
                        const isSelected = selectedStudentIds.includes(st.id);
                        return (
                          <tr
                            key={st.id}
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/40" : ""
                            }`}
                            onClick={() => handleToggleStudent(st.id)}
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudent(st.id)}
                                className="rounded border-slate-300 cursor-pointer"
                              />
                            </td>

                            <td className="p-4 font-bold text-slate-900">
                              {st.name}
                            </td>

                            <td className="p-4 font-mono font-bold text-slate-600">
                              {st.code}
                            </td>

                            <td className="p-4 text-slate-600">
                              {st.academicYear}
                            </td>

                            <td className="p-4 font-mono text-slate-700">
                              {st.parentPhone || "-"}
                            </td>

                            <td className="p-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  st.status === "active"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {st.status === "active" ? "نشط" : "معطل"}
                              </span>
                            </td>

                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setActiveStudentProfileId(st.id)}
                                className="text-blue-600 hover:underline font-bold text-xs"
                              >
                                عرض الملف
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: MULTI-SELECT SPECIFIC STUDENTS
            ========================================================================= */}
        {!isPreviewOpen && activeTab === "specific" && (
          <div className="space-y-4 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchStudentQuery}
                  onChange={(e) => setSearchStudentQuery(e.target.value)}
                  placeholder="البحث باسم الطالب، الكود، أو المجموعة..."
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  المحدد: <strong className="text-blue-600 font-mono">{selectedStudentIds.length}</strong> طالب
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenPreview()}
                  disabled={selectedStudentIds.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  <span>معاينة وطباعة المستند ({selectedStudentIds.length})</span>
                </button>
              </div>
            </div>

            {/* All Students List */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-4 w-10">تحديد</th>
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">الكود</th>
                      <th className="p-4">المجموعة</th>
                      <th className="p-4">الصف الدراسي</th>
                      <th className="p-4 text-center">الملف الشخصي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allStudents
                      .filter(
                        (s) =>
                          s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) ||
                          s.code.toLowerCase().includes(searchStudentQuery.toLowerCase()) ||
                          (s.groupName || "").toLowerCase().includes(searchStudentQuery.toLowerCase())
                      )
                      .map((st) => {
                        const isSelected = selectedStudentIds.includes(st.id);
                        return (
                          <tr
                            key={st.id}
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/40" : ""
                            }`}
                            onClick={() => handleToggleStudent(st.id)}
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudent(st.id)}
                                className="rounded border-slate-300 cursor-pointer"
                              />
                            </td>

                            <td className="p-4 font-bold text-slate-900">
                              {st.name}
                            </td>

                            <td className="p-4 font-mono font-bold text-slate-600">
                              {st.code}
                            </td>

                            <td className="p-4 font-bold text-blue-600">
                              {st.groupName || "عام"}
                            </td>

                            <td className="p-4 text-slate-600">
                              {st.academicYear}
                            </td>

                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setActiveStudentProfileId(st.id)}
                                className="text-blue-600 hover:underline font-bold text-xs"
                              >
                                عرض الملف
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: CREATED PDFS ARCHIVE
            ========================================================================= */}
        {!isPreviewOpen && activeTab === "archive" && (
          <div className="space-y-4 print:hidden">
            {savedPdfs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {savedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between space-y-4 hover:border-blue-200 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                          {pdf.groupName || "مجموعة مخصصة"}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(pdf.createdAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                        {pdf.title}
                      </h3>

                      <p className="text-xs text-slate-500">
                        عدد الطلاب: <strong className="text-slate-800 font-mono">{pdf.studentIds.length}</strong> بطاقة QR
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedStudentIds(pdf.studentIds);
                          handleOpenPreview(pdf.studentIds, pdf.title);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>فتح ومعاينة</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSavedPdf(pdf.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="حذف من الأرشيف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-700">لا توجد ملفات PDF محفوظة حتى الآن</h3>
                <p className="text-xs text-slate-400">
                  قم بمعاينة وحفظ بطاقات الطلاب لتبقى محفوظة هنا للطباعة السريعة في أي وقت
                </p>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SPLIT VIEW PREVIEW & PRINT PROCESS (Requested by user)
            "the process after click print button (in split view sides preview the pdf - save and name, send to WhatsApp button, print button)"
            ========================================================================= */}
        {isPreviewOpen && (
          <div className="space-y-6">
            {/* Split Top Actions Bar (Hidden on Print) */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm print:hidden">
              <div className="space-y-1">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>إغلاق المعاينة والعودة للاختيار</span>
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    placeholder="اسم وتسمية مستند الطباعة..."
                    className="text-base sm:text-lg font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 w-full sm:w-96"
                  />
                </div>
              </div>

              {/* Action Buttons: Save & Name, Send to WhatsApp, Print */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSavePdfDocument}
                  disabled={isSavingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  <span>{isSavingPdf ? "جاري الحفظ..." : "حفظ وتسمية المستند"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendToWhatsApp}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مشاركة بالواتساب</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الآن (A4)</span>
                </button>
              </div>
            </div>

            {savedSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 print:hidden animate-in fade-in">
                {savedSuccessMsg}
              </div>
            )}

            {/* Realistic A4 White Pages Split View (Screen preview + Standard Print Layout) */}
            <div className="space-y-8 print:space-y-0">
              {pages.map((pageStudents, pageIndex) => (
                <div
                  key={pageIndex}
                  className="bg-white rounded-2xl shadow-md border border-slate-200/80 mx-auto p-8 sm:p-12 print:p-8 print:shadow-none print:border-none print:m-0 print:w-full print:h-full print:page-break-after-always overflow-hidden"
                  style={{
                    width: "100%",
                    maxWidth: "210mm",
                    minHeight: "297mm",
                  }}
                >
                  {/* Page Header (Subtle) */}
                  <div className="border-b border-slate-200 pb-3 mb-6 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold text-slate-800">{pdfTitle}</span>
                    <span>
                      صفحة {pageIndex + 1} من {pages.length}
                    </span>
                  </div>

                  {/* 5x5 cm QR Grid: 
                      Note user prompt:
                      "Each pdf is A4 size white pages filled rows and columns with 5x5 qr code for each selected students to print (note numbers of selected students same number the qrs in the pdf, if two selected students in the pdf two 5x5 qrs in one page )
                      qr design and name/year/group below the qr"
                  */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-7">
                    {pageStudents.map((student) => {
                      const qrData = qrImagesMap[student.id];

                      return (
                        <div
                          key={student.id}
                          className="border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-between text-center bg-white shadow-2xs select-none hover:border-blue-400 transition-colors"
                          style={{
                            // 5x5 cm card with QR and info
                            minHeight: "5.5cm",
                          }}
                        >
                          {/* 5x5 QR Code Graphic */}
                          <div
                            className="bg-white flex items-center justify-center p-1"
                            style={{ width: "4cm", height: "4cm" }}
                          >
                            {qrData ? (
                              <img
                                src={qrData}
                                alt={`QR ${student.code}`}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full border border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-400">
                                جاري التوليد...
                              </div>
                            )}
                          </div>

                          {/* Name / Year / Group below QR as requested */}
                          <div className="mt-2 w-full space-y-0.5 border-t border-slate-100 pt-2">
                            <div className="font-black text-slate-900 text-xs sm:text-sm truncate">
                              {student.name}
                            </div>
                            <div className="text-[10px] font-bold text-blue-600 truncate">
                              {student.academicYear}
                            </div>
                            <div className="text-[9px] text-slate-500 truncate">
                              {student.groupName || groups.find((g) => g.id === student.groupId)?.name || groups.find((g) => g.id === selectedGroupId)?.name || "المجموعة"} • كود: {student.code}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cut Guide Footer */}
                  <div className="border-t border-slate-100 mt-8 pt-3 text-center text-[9px] text-slate-400 print:block">
                    ✂ قص على طول الخطوط المتقطعة للحصول على بطاقات QR بمقاس 5×5 سم
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student Profile Modal if opened */}
        {activeStudentProfileId && (
          <StudentProfileModal
            studentId={activeStudentProfileId}
            onClose={() => setActiveStudentProfileId(null)}
            onUpdate={() => fetchInitialData()}
            onEditStudent={() => {}}
            onDeleteStudent={() => {}}
          />
        )}
      </div>
    </div>
  );
}

export default function QrPrintingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center p-8 bg-slate-50/60">
          <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>جاري تجهيز بطاقات ورموز QR...</span>
          </div>
        </div>
      }
    >
      <QrPrintingContent />
    </Suspense>
  );
}
