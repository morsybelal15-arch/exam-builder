"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  UserPlus,
  CheckCircle2,
  QrCode,
  GraduationCap,
  Users,
} from "lucide-react";
import { Student } from "@/lib/types/management";

interface ExternalAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetGroupId?: string;
  currentGroupId?: string;
  targetGroupName?: string;
  currentGroupName?: string;
  attendanceDate?: string;
  date?: string;
  onAttendanceMarked?: () => void;
  onSuccess?: () => void;
}

export default function ExternalAttendanceModal(props: ExternalAttendanceModalProps) {
  const {
    isOpen,
    onClose,
    onAttendanceMarked,
    onSuccess,
  } = props;

  const targetGroupId = props.targetGroupId || props.currentGroupId || "";
  const targetGroupName = props.targetGroupName || props.currentGroupName || "";
  const attendanceDate = props.attendanceDate || props.date || new Date().toISOString().split("T")[0];

  const [searchQuery, setSearchQuery] = useState("");
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch("/api/students")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            // Filter out students who are already members of this target group
            const externals = (data.students || []).filter(
              (s: Student) => s.groupId !== targetGroupId
            );
            setAllStudents(externals);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setSearchQuery("");
      setSuccessMsg("");
    }
  }, [isOpen, targetGroupId]);

  if (!isOpen) return null;

  const filteredStudents = allStudents.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.groupName && s.groupName.toLowerCase().includes(q))
    );
  });

  const handleMarkExternalStudent = async (student: Student) => {
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIdOrCode: student.id,
          groupId: targetGroupId,
          date: attendanceDate,
          status: "attended",
          method: "manual",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم تسجيل حضور الطالب ${student.name} من (${student.groupName || "مجموعة أخرى"}) بنجاح!`);
        if (typeof onAttendanceMarked === "function") {
          onAttendanceMarked();
        }
        if (typeof onSuccess === "function") {
          onSuccess();
        }
        setTimeout(() => {
          setSuccessMsg("");
          onClose();
        }, 900);
      } else {
        alert(data.error || "حدث خطأ أثناء تسجيل الحضور");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                تسجيل حضور لطالب خارج المجموعة
              </h3>
              <p className="text-[11px] text-slate-400">
                تسجيل حضور في حصة {attendanceDate} • لمجموعة: {targetGroupName || "المجموعة الحالية"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو الكود أو مجموعته الأصلية..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-slate-400">
              جاري تحميل الطلاب...
            </div>
          ) : filteredStudents.length > 0 ? (
            filteredStudents.map((st) => (
              <div
                key={st.id}
                className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/30 transition-all flex items-center justify-between gap-3 text-right"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 truncate">
                      {st.name}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {st.code}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-slate-400" />
                      <span>{st.academicYear}</span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      <Users className="w-3 h-3" />
                      <span>مجموعته الأصلية: {st.groupName || "مجموعة أخرى"}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleMarkExternalStudent(st)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-50"
                >
                  تسجيل حاضر
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold">لا يوجد طلاب مطابقون لبحثك خارج هذه المجموعة</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>يتم تمييز الطالب في كشف الحضور بعلامة (من مجموعة أخرى)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
