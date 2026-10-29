"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  UserCheck,
  BookOpen,
  GraduationCap,
  Calendar,
  X,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Group } from "@/lib/types/management";
import {
  getCachedPageData,
  setCachedPageData,
  invalidateCachedPageData,
} from "@/lib/client-session-cache";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentsCount, setStudentsCount] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields (4 fields specified in prompt: Name, Teacher, Academic Year, Subject)
  const [formData, setFormData] = useState({
    name: "",
    teacher: "",
    academicYear: "",
    subject: "",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const cached = getCachedPageData<{
      groups: Group[];
      counts: Record<string, number>;
    }>("groups_page");
    if (cached) {
      setGroups(cached.groups || []);
      setStudentsCount(cached.counts || {});
      setIsLoading(false);
    }
    fetchData(Boolean(cached));
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [resGroups, resStudents] = await Promise.all([
        fetch(`/api/groups?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/students?t=${Date.now()}`, { cache: "no-store" }),
      ]);

      const dataGroups = await resGroups.json();
      const dataStudents = await resStudents.json();

      const nextGroups: Group[] = dataGroups.success ? dataGroups.groups || [] : [];
      const counts: Record<string, number> = {};
      if (dataStudents.success && Array.isArray(dataStudents.students)) {
        dataStudents.students.forEach((s: any) => {
          counts[s.groupId] = (counts[s.groupId] || 0) + 1;
        });
      }

      if (dataGroups.success) {
        setGroups(nextGroups);
      }
      if (dataStudents.success) {
        setStudentsCount(counts);
      }
      setCachedPageData("groups_page", { groups: nextGroups, counts });
      setCachedPageData("groups_list", nextGroups);
    } catch (err) {
      console.error("Failed to fetch groups data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingGroup(null);
    setFormData({
      name: "",
      teacher: "",
      academicYear: "الصف الثالث الثانوي",
      subject: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      teacher: group.teacher,
      academicYear: group.academicYear,
      subject: group.subject,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.teacher.trim() || !formData.academicYear.trim() || !formData.subject.trim()) {
      setFormError("يرجى ملء جميع الحقول الأربعة (اسم المجموعة، المعلم، السنة الدراسية، المادة)");
      return;
    }

    try {
      setIsSaving(true);
      setFormError("");

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingGroup ? editingGroup.id : undefined,
          ...formData,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "فشل حفظ المجموعة");
      }

      setIsModalOpen(false);
      fetchData();
      fetch(`/api/auth/session?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => window.dispatchEvent(new CustomEvent("tenant-session-sync", { detail: d })))
        .catch(() => {});
    } catch (err: any) {
      setFormError(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/groups?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== id));
        setDeleteConfirmId(null);
        fetch(`/api/auth/session?t=${Date.now()}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => window.dispatchEvent(new CustomEvent("tenant-session-sync", { detail: d })))
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const q = searchQuery.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.teacher.toLowerCase().includes(q) ||
      g.subject.toLowerCase().includes(q) ||
      g.academicYear.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-8 lg:p-10 bg-slate-50/60">
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                  إدارة المجموعات
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  إنشاء وتعديل المجموعات الدراسية وحصص المعلمين والصفوف
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة مجموعة جديدة</span>
          </button>
        </div>

        {/* Quick Stats & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 bg-white rounded-2xl shadow-sm p-3.5 flex items-center border border-slate-100">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم المجموعة، المعلم، المادة، أو السنة الدراسية..."
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50/80 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 border border-slate-200/60"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي المجموعات</span>
            <span className="text-xl font-black text-blue-600 font-mono">
              {groups.length}
            </span>
          </div>
        </div>

        {/* Groups Grid / List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-pulse space-y-4">
                <div className="h-5 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-50 rounded" />
              </div>
            ))}
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGroups.map((group) => {
              const count = studentsCount[group.id] || 0;
              return (
                <div
                  key={group.id}
                  className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-slate-100 hover:border-blue-200 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Academic Year Tag & Actions */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100/60">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                        {group.academicYear}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(group)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="تعديل بيانات المجموعة"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(group.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="حذف المجموعة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Group Name (H1 concept) */}
                    <div>
                      <h2 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                        {group.name}
                      </h2>
                    </div>

                    {/* Details: Subject & Teacher (4 fields) */}
                    <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-slate-700">المادة:</span>
                        <span className="text-slate-600">{group.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-semibold text-slate-700">المعلم:</span>
                        <span className="text-slate-600">{group.teacher}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer & CTA to Group in Students Page */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{count} طالب مسجل</span>
                    </div>

                    <Link
                      href={`/students?groupId=${group.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl transition-all"
                    >
                      <span>عرض الطلاب واللوحة</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-bold text-base">
              لا توجد مجموعات مسجلة حالياً
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              اضغط على زر &quot;إضافة مجموعة جديدة&quot; لإنشاء أول مجموعة دراسية وتعيين المادة والمعلم.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مجموعة الآن</span>
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  تأكيد حذف المجموعة
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع بيانات الطلاب والغياب والماليات المرتبطة بها نهائياً.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  نعم، احذف المجموعة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Group Modal (4 fields) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">
                      {editingGroup ? "تعديل بيانات المجموعة" : "إنشاء مجموعة جديدة"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      أدخل الحقول الأربعة الأساسية للمجموعة
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                {/* 1. Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    اسم المجموعة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: مجموعة العباقرة (أ) أو سنتر الأوائل"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                {/* 2. Teacher */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    المعلم المشرف <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.teacher}
                    onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                    placeholder="مثال: أ. محمد عبد السلام"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                {/* 3. Academic Year */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    السنة الدراسية / الصف <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer"
                  >
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                    <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                    <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                    <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                    <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                    <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                    <option value="المرحلة الابتدائية">المرحلة الابتدائية</option>
                    <option value="جامعي / عام">جامعي / عام</option>
                  </select>
                </div>

                {/* 4. Subject */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    المادة التعليمية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="مثال: الفيزياء، الكيمياء، الرياضيات، الأحياء..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? "جاري الحفظ..." : editingGroup ? "تحديث المجموعة" : "إنشاء المجموعة"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
