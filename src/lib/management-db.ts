import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  Group,
  Student,
  FinancialRecord,
  PaymentStatus,
  AttendanceRecord,
  AttendanceStatus,
  GroupClassSession,
  ExamRecord,
  StudentGradeRecord,
  SavedQrPdf,
} from "./types/management";

const dataDir = path.join(os.homedir(), ".exam_builder");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const storePath = path.join(dataDir, "management_store.json");

interface ManagementStore {
  groups: Group[];
  students: Student[];
  financials: FinancialRecord[];
  attendance: AttendanceRecord[];
  sessions: GroupClassSession[];
  examRecords: ExamRecord[];
  studentGrades: StudentGradeRecord[];
  savedQrPdfs: SavedQrPdf[];
}

function getInitialStore(): ManagementStore {
  const now = Date.now();

  const groups: Group[] = [
    {
      id: "grp-1",
      name: "مجموعة العباقرة (أ)",
      teacher: "أ. محمد عبد السلام",
      academicYear: "الصف الثالث الثانوي",
      subject: "الفيزياء الحديثة",
      createdAt: now - 30 * 86400000,
      updatedAt: now,
    },
    {
      id: "grp-2",
      name: "مجموعة الفرسان (ب)",
      teacher: "أ. طارق عبد الحميد",
      academicYear: "الصف الثاني الثانوي",
      subject: "الكيمياء العامة",
      createdAt: now - 20 * 86400000,
      updatedAt: now,
    },
    {
      id: "grp-3",
      name: "مجموعة الأوائل (ج)",
      teacher: "أ. محمود فاروق",
      academicYear: "الصف الأول الثانوي",
      subject: "الرياضيات التطبيقية",
      createdAt: now - 10 * 86400000,
      updatedAt: now,
    },
  ];

  const students: Student[] = [
    {
      id: "std-1",
      code: "ST-1001",
      name: "أحمد مصطفى كامل",
      academicYear: "الصف الثالث الثانوي",
      groupId: "grp-1",
      groupName: "مجموعة العباقرة (أ)",
      parentPhone: "01012345671",
      studentPhone: "01098765431",
      monthlyFee: 300,
      status: "active",
      notes: "طالب متفوق في المسائل الحسابية",
      createdAt: now - 25 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-2",
      code: "ST-1002",
      name: "سارة محمود إبراهيم",
      academicYear: "الصف الثالث الثانوي",
      groupId: "grp-1",
      groupName: "مجموعة العباقرة (أ)",
      parentPhone: "01123456782",
      studentPhone: "01187654322",
      monthlyFee: 300,
      status: "active",
      notes: "التزام تام في الحضور والملاحظات",
      createdAt: now - 24 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-3",
      code: "ST-1003",
      name: "يوسف خالد حسان",
      academicYear: "الصف الثالث الثانوي",
      groupId: "grp-1",
      groupName: "مجموعة العباقرة (أ)",
      parentPhone: "01234567893",
      studentPhone: "01276543213",
      monthlyFee: 300,
      status: "active",
      notes: "",
      createdAt: now - 23 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-4",
      code: "ST-1004",
      name: "مريم عادل الشافعي",
      academicYear: "الصف الثالث الثانوي",
      groupId: "grp-1",
      groupName: "مجموعة العباقرة (أ)",
      parentPhone: "01545678904",
      studentPhone: "01565432104",
      monthlyFee: 300,
      status: "inactive", // inactive student
      notes: "اعتذر عن الحضور مؤقتاً لظروف سفر",
      createdAt: now - 22 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-5",
      code: "ST-1005",
      name: "عمر شريف الدسوقي",
      academicYear: "الصف الثالث الثانوي",
      groupId: "grp-1",
      groupName: "مجموعة العباقرة (أ)",
      parentPhone: "01056789015",
      studentPhone: "01043210985",
      monthlyFee: 300,
      status: "active",
      notes: "",
      createdAt: now - 21 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-6",
      code: "ST-2001",
      name: "كريم حسام الدين",
      academicYear: "الصف الثاني الثانوي",
      groupId: "grp-2",
      groupName: "مجموعة الفرسان (ب)",
      parentPhone: "01167890126",
      studentPhone: "01132109876",
      monthlyFee: 250,
      status: "active",
      notes: "",
      createdAt: now - 18 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-7",
      code: "ST-2002",
      name: "نوران ياسر زهران",
      academicYear: "الصف الثاني الثانوي",
      groupId: "grp-2",
      groupName: "مجموعة الفرسان (ب)",
      parentPhone: "01278901237",
      studentPhone: "01221098767",
      monthlyFee: 250,
      status: "active",
      notes: "",
      createdAt: now - 17 * 86400000,
      updatedAt: now,
    },
    {
      id: "std-8",
      code: "ST-3001",
      name: "حسام أشرف فتحي",
      academicYear: "الصف الأول الثانوي",
      groupId: "grp-3",
      groupName: "مجموعة الأوائل (ج)",
      parentPhone: "01089012348",
      studentPhone: "01010987658",
      monthlyFee: 200,
      status: "active",
      notes: "",
      createdAt: now - 8 * 86400000,
      updatedAt: now,
    },
  ];

  // Financial records for October 2026
  const financials: FinancialRecord[] = [
    {
      id: "fin-1",
      studentId: "std-1",
      groupId: "grp-1",
      month: "2026-10",
      status: "paid",
      paidAmount: 300,
      totalAmount: 300,
      updatedAt: now,
      notes: "تم السداد نقداً",
    },
    {
      id: "fin-2",
      studentId: "std-2",
      groupId: "grp-1",
      month: "2026-10",
      status: "unpaid",
      paidAmount: 0,
      totalAmount: 300,
      updatedAt: now,
      notes: "مستحق نهاية الشهر",
    },
    {
      id: "fin-3",
      studentId: "std-3",
      groupId: "grp-1",
      month: "2026-10",
      status: "paid", // partial represented by paid amount < total
      paidAmount: 150,
      totalAmount: 300,
      updatedAt: now,
      notes: "سدد نصف المبلغ ومتبقي ١٥٠ ج.م",
    },
    {
      id: "fin-4",
      studentId: "std-4",
      groupId: "grp-1",
      month: "2026-10",
      status: "returned",
      paidAmount: 0,
      totalAmount: 300,
      updatedAt: now,
      notes: "تم إرجاع الاشتراك بسبب السفر",
    },
    {
      id: "fin-5",
      studentId: "std-5",
      groupId: "grp-1",
      month: "2026-10",
      status: "unpaid",
      paidAmount: 0,
      totalAmount: 300,
      updatedAt: now,
    },
  ];

  // Group class sessions for calendar
  const sessions: GroupClassSession[] = [
    { id: "ses-1", groupId: "grp-1", date: "2026-10-04", title: "حصة دوائر التيار المتردد" },
    { id: "ses-2", groupId: "grp-1", date: "2026-10-07", title: "حصة قانون كيرشوف الأول والثاني" },
    { id: "ses-3", groupId: "grp-1", date: "2026-10-11", title: "حصة أجهزة القياس الكهربي" },
    { id: "ses-4", groupId: "grp-1", date: "2026-10-14", title: "حصة المراجعة واختبار نصف الشهر" },
    { id: "ses-5", groupId: "grp-1", date: "2026-10-18", title: "حصة التأثير المغناطيسي" },
    { id: "ses-6", groupId: "grp-1", date: "2026-10-21", title: "حصة القوة الدافعة الكهربية" },
  ];

  // Attendance records
  const attendance: AttendanceRecord[] = [
    // 2026-10-04
    { id: "att-1", studentId: "std-1", groupId: "grp-1", date: "2026-10-04", status: "attended", time: "05:05 م", method: "camera_qr" },
    { id: "att-2", studentId: "std-2", groupId: "grp-1", date: "2026-10-04", status: "attended", time: "05:10 م", method: "camera_qr" },
    { id: "att-3", studentId: "std-3", groupId: "grp-1", date: "2026-10-04", status: "absent" },
    { id: "att-4", studentId: "std-5", groupId: "grp-1", date: "2026-10-04", status: "attended", time: "05:15 م", method: "manual" },

    // 2026-10-07
    { id: "att-5", studentId: "std-1", groupId: "grp-1", date: "2026-10-07", status: "attended", time: "05:02 م", method: "camera_qr" },
    { id: "att-6", studentId: "std-2", groupId: "grp-1", date: "2026-10-07", status: "attended", time: "05:08 م", method: "camera_qr" },
    { id: "att-7", studentId: "std-3", groupId: "grp-1", date: "2026-10-07", status: "attended", time: "05:12 م", method: "camera_qr" },
    { id: "att-8", studentId: "std-5", groupId: "grp-1", date: "2026-10-07", status: "absent" },

    // 2026-10-11
    { id: "att-9", studentId: "std-1", groupId: "grp-1", date: "2026-10-11", status: "attended", time: "05:01 م", method: "camera_qr" },
    { id: "att-10", studentId: "std-2", groupId: "grp-1", date: "2026-10-11", status: "attended", time: "05:03 م", method: "camera_qr" },
    { id: "att-11", studentId: "std-3", groupId: "grp-1", date: "2026-10-11", status: "attended", time: "05:14 م", method: "manual" },
    { id: "att-12", studentId: "std-5", groupId: "grp-1", date: "2026-10-11", status: "attended", time: "05:18 م", method: "camera_qr" },

    // 2026-10-14 (Today)
    { id: "att-13", studentId: "std-1", groupId: "grp-1", date: "2026-10-14", status: "attended", time: "05:00 م", method: "camera_qr" },
    { id: "att-14", studentId: "std-2", groupId: "grp-1", date: "2026-10-14", status: "attended", time: "05:04 م", method: "camera_qr" },
    { id: "att-15", studentId: "std-3", groupId: "grp-1", date: "2026-10-14", status: "absent" },
    { id: "att-16", studentId: "std-5", groupId: "grp-1", date: "2026-10-14", status: "attended", time: "05:11 م", method: "camera_qr" },
  ];

  // Exam records
  const examRecords: ExamRecord[] = [
    {
      id: "exm-rec-1",
      groupId: "grp-1",
      examName: "اختبار الفصل الأول: التيار الكهربي وقانون أوم",
      totalScore: 20,
      date: "2026-10-07",
      createdAt: now - 7 * 86400000,
    },
    {
      id: "exm-rec-2",
      groupId: "grp-1",
      examName: "امتحان نصف الشهر: كيرشوف وأجهزة القياس",
      totalScore: 30,
      date: "2026-10-14",
      createdAt: now - 86400000,
    },
  ];

  const studentGrades: StudentGradeRecord[] = [
    { id: "grd-1", examRecordId: "exm-rec-1", studentId: "std-1", score: 19.5, method: "camera_ai", recordedAt: now - 7 * 86400000 },
    { id: "grd-2", examRecordId: "exm-rec-1", studentId: "std-2", score: 20, method: "camera_ai", recordedAt: now - 7 * 86400000 },
    { id: "grd-3", examRecordId: "exm-rec-1", studentId: "std-3", score: 16, method: "manual", recordedAt: now - 7 * 86400000 },
    { id: "grd-4", examRecordId: "exm-rec-1", studentId: "std-5", score: 14.5, method: "camera_ai", recordedAt: now - 7 * 86400000 },

    { id: "grd-5", examRecordId: "exm-rec-2", studentId: "std-1", score: 28, method: "camera_ai", recordedAt: now },
    { id: "grd-6", examRecordId: "exm-rec-2", studentId: "std-2", score: 29.5, method: "camera_ai", recordedAt: now },
  ];

  const savedQrPdfs: SavedQrPdf[] = [
    {
      id: "qr-pdf-1",
      title: "بطاقات QR - مجموعة العباقرة (أ) - الفصل الأول",
      groupName: "مجموعة العباقرة (أ)",
      studentIds: ["std-1", "std-2", "std-3", "std-4", "std-5"],
      createdAt: now - 5 * 86400000,
      pagesCount: 1,
    },
  ];

  return {
    groups,
    students,
    financials,
    attendance,
    sessions,
    examRecords,
    studentGrades,
    savedQrPdfs,
  };
}

export function getManagementStore(): ManagementStore {
  try {
    if (fs.existsSync(storePath)) {
      const data = fs.readFileSync(storePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading management store:", err);
  }

  const initial = getInitialStore();
  saveManagementStore(initial);
  return initial;
}

export function saveManagementStore(store: ManagementStore): void {
  try {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving management store:", err);
  }
}

// ==========================================
// GROUPS API
// ==========================================

export function getGroups(): Group[] {
  const store = getManagementStore();
  return store.groups.sort((a, b) => b.createdAt - a.createdAt);
}

export function getGroupById(id: string): Group | null {
  const store = getManagementStore();
  return store.groups.find((g) => g.id === id) || null;
}

export function saveGroup(group: Partial<Group> & { name: string; teacher: string; academicYear: string; subject: string }): Group {
  const store = getManagementStore();
  const now = Date.now();
  if (group.id) {
    const idx = store.groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      store.groups[idx] = {
        ...store.groups[idx],
        ...group,
        updatedAt: now,
      };
      saveManagementStore(store);
      return store.groups[idx];
    }
  }

  const newGroup: Group = {
    id: group.id || `grp-${Date.now()}`,
    name: group.name,
    teacher: group.teacher,
    academicYear: group.academicYear,
    subject: group.subject,
    createdAt: now,
    updatedAt: now,
  };

  store.groups.push(newGroup);
  saveManagementStore(store);
  return newGroup;
}

export function deleteGroup(id: string): boolean {
  const store = getManagementStore();
  store.groups = store.groups.filter((g) => g.id !== id);
  // Also unassign or remove students
  store.students = store.students.filter((s) => s.groupId !== id);
  store.financials = store.financials.filter((f) => f.groupId !== id);
  store.attendance = store.attendance.filter((a) => a.groupId !== id);
  store.sessions = store.sessions.filter((s) => s.groupId !== id);
  store.examRecords = store.examRecords.filter((e) => e.groupId !== id);
  saveManagementStore(store);
  return true;
}

// ==========================================
// STUDENTS API
// ==========================================

export function getStudents(groupId?: string): Student[] {
  const store = getManagementStore();
  let list = store.students;
  if (groupId) {
    list = list.filter((s) => s.groupId === groupId);
  }
  return list.map((s) => {
    const grp = store.groups.find((g) => g.id === s.groupId);
    return {
      ...s,
      groupName: grp ? grp.name : s.groupName,
    };
  });
}

export function getStudentById(id: string): Student | null {
  const store = getManagementStore();
  const s = store.students.find((std) => std.id === id || std.code === id);
  if (!s) return null;
  const grp = store.groups.find((g) => g.id === s.groupId);
  return {
    ...s,
    groupName: grp ? grp.name : s.groupName,
  };
}

export function saveStudent(student: Partial<Student> & { name: string; groupId: string }): Student {
  const store = getManagementStore();
  const now = Date.now();
  const grp = store.groups.find((g) => g.id === student.groupId);

  if (student.id) {
    const idx = store.students.findIndex((s) => s.id === student.id);
    if (idx >= 0) {
      store.students[idx] = {
        ...store.students[idx],
        ...student,
        groupName: grp ? grp.name : store.students[idx].groupName,
        updatedAt: now,
      };
      saveManagementStore(store);
      return store.students[idx];
    }
  }

  // Generate unique code e.g. ST-XXXX
  const nextNum = 1000 + store.students.length + 1;
  const newStudent: Student = {
    id: student.id || `std-${Date.now()}`,
    code: student.code || `ST-${nextNum}`,
    name: student.name,
    academicYear: student.academicYear || grp?.academicYear || "الصف الأول الثانوي",
    groupId: student.groupId,
    groupName: grp?.name,
    parentPhone: student.parentPhone || "",
    studentPhone: student.studentPhone || "",
    monthlyFee: student.monthlyFee ?? 250,
    status: student.status || "active",
    notes: student.notes || "",
    createdAt: now,
    updatedAt: now,
  };

  store.students.push(newStudent);
  saveManagementStore(store);
  return newStudent;
}

export function deleteStudent(id: string): boolean {
  const store = getManagementStore();
  store.students = store.students.filter((s) => s.id !== id);
  store.financials = store.financials.filter((f) => f.studentId !== id);
  store.attendance = store.attendance.filter((a) => a.studentId !== id);
  store.studentGrades = store.studentGrades.filter((g) => g.studentId !== id);
  saveManagementStore(store);
  return true;
}

export function transferStudents(studentIds: string[], targetGroupId: string): boolean {
  const store = getManagementStore();
  const targetGroup = store.groups.find((g) => g.id === targetGroupId);
  if (!targetGroup) return false;

  store.students = store.students.map((s) => {
    if (studentIds.includes(s.id)) {
      return {
        ...s,
        groupId: targetGroupId,
        groupName: targetGroup.name,
        academicYear: targetGroup.academicYear || s.academicYear,
        updatedAt: Date.now(),
      };
    }
    return s;
  });

  saveManagementStore(store);
  return true;
}

export function bulkUpdateStudents(studentIds: string[], updates: Partial<Student>): boolean {
  const store = getManagementStore();
  store.students = store.students.map((s) => {
    if (studentIds.includes(s.id)) {
      return {
        ...s,
        ...updates,
        updatedAt: Date.now(),
      };
    }
    return s;
  });
  saveManagementStore(store);
  return true;
}

// ==========================================
// FINANCIALS API
// ==========================================

export function getFinancials(groupId: string, month: string) {
  const store = getManagementStore();
  const students = store.students.filter((s) => s.groupId === groupId);

  return students.map((std) => {
    const existing = store.financials.find(
      (f) => f.studentId === std.id && f.month === month
    );

    if (existing) {
      return {
        ...existing,
        studentName: std.name,
        parentPhone: std.parentPhone,
        monthlyFee: std.monthlyFee,
      };
    }

    // Default status is UNPAID as requested
    return {
      id: `fin-${std.id}-${month}`,
      studentId: std.id,
      studentName: std.name,
      parentPhone: std.parentPhone,
      monthlyFee: std.monthlyFee,
      groupId,
      month,
      status: "unpaid" as const,
      paidAmount: 0,
      totalAmount: std.monthlyFee || 250,
      updatedAt: Date.now(),
    };
  });
}

export function updateFinancial(record: {
  studentId: string;
  groupId: string;
  month: string;
  status: "paid" | "unpaid" | "returned";
  paidAmount: number;
  totalAmount?: number;
  notes?: string;
}): FinancialRecord {
  const store = getManagementStore();
  const idx = store.financials.findIndex(
    (f) => f.studentId === record.studentId && f.month === record.month
  );

  const student = store.students.find((s) => s.id === record.studentId);
  const totalAmount = record.totalAmount ?? (student?.monthlyFee || 250);

  if (idx >= 0) {
    store.financials[idx] = {
      ...store.financials[idx],
      ...record,
      totalAmount,
      updatedAt: Date.now(),
    };
    saveManagementStore(store);
    return store.financials[idx];
  }

  const newRec: FinancialRecord = {
    id: `fin-${record.studentId}-${record.month}`,
    studentId: record.studentId,
    groupId: record.groupId,
    month: record.month,
    status: record.status,
    paidAmount: record.paidAmount,
    totalAmount,
    updatedAt: Date.now(),
    notes: record.notes,
  };

  store.financials.push(newRec);
  saveManagementStore(store);
  return newRec;
}

export function bulkUpdateFinancials(
  studentIds: string[],
  groupId: string,
  month: string,
  status: "paid" | "unpaid" | "returned",
  partialPaidAmount?: number
) {
  const store = getManagementStore();
  studentIds.forEach((studentId) => {
    const student = store.students.find((s) => s.id === studentId);
    const totalAmount = student?.monthlyFee || 250;
    const paidAmount =
      status === "paid"
        ? (partialPaidAmount !== undefined ? partialPaidAmount : totalAmount)
        : 0;

    const idx = store.financials.findIndex(
      (f) => f.studentId === studentId && f.month === month
    );

    if (idx >= 0) {
      store.financials[idx] = {
        ...store.financials[idx],
        status,
        paidAmount,
        totalAmount,
        updatedAt: Date.now(),
      };
    } else {
      store.financials.push({
        id: `fin-${studentId}-${month}`,
        studentId,
        groupId,
        month,
        status,
        paidAmount,
        totalAmount,
        updatedAt: Date.now(),
      });
    }
  });

  saveManagementStore(store);
  return true;
}

// ==========================================
// ATTENDANCE API
// ==========================================

export function getGroupSessions(groupId: string, monthPrefix?: string): GroupClassSession[] {
  const store = getManagementStore();
  let list = store.sessions.filter((s) => s.groupId === groupId);
  if (monthPrefix) {
    list = list.filter((s) => s.date.startsWith(monthPrefix));
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function createClassSession(groupId: string, date: string, title?: string): GroupClassSession {
  const store = getManagementStore();
  const existing = store.sessions.find((s) => s.groupId === groupId && s.date === date);
  if (existing) return existing;

  const newSession: GroupClassSession = {
    id: `ses-${Date.now()}`,
    groupId,
    date,
    title: title || "حصة دراسية",
  };
  store.sessions.push(newSession);
  saveManagementStore(store);
  return newSession;
}

export function getAttendance(groupId: string, date: string) {
  const store = getManagementStore();
  const students = store.students.filter((s) => s.groupId === groupId);

  return students.map((std) => {
    const record = store.attendance.find(
      (a) => a.studentId === std.id && a.date === date
    );

    return {
      studentId: std.id,
      code: std.code,
      studentName: std.name,
      status: record ? record.status : ("absent" as AttendanceStatus),
      time: record?.time,
      method: record?.method,
      studentStatus: std.status,
    };
  });
}

export function markAttendance(
  studentIdOrCode: string,
  groupId: string | undefined,
  date: string,
  status: AttendanceStatus,
  method: "camera_qr" | "manual" = "manual"
) {
  const store = getManagementStore();
  const clean = (studentIdOrCode || "").includes("/s/")
    ? studentIdOrCode.split("/s/").pop()?.split("?")[0]?.trim() || studentIdOrCode.trim()
    : (studentIdOrCode || "").trim();

  const student = store.students.find(
    (s) =>
      s.id === clean ||
      s.code === clean ||
      s.id.toLowerCase() === clean.toLowerCase() ||
      s.code.toLowerCase() === clean.toLowerCase()
  );
  if (!student) return { success: false, error: "الطالب غير موجود" };

  const targetGroupId = (groupId && groupId !== "auto") ? groupId : student.groupId;
  const group = store.groups.find((g) => g.id === targetGroupId);

  // Ensure class session exists for this day
  if (!store.sessions.some((s) => s.groupId === targetGroupId && s.date === date)) {
    store.sessions.push({
      id: `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      groupId: targetGroupId,
      date,
      title: "حصة دراسية",
    });
  }

  const idx = store.attendance.findIndex(
    (a) => a.studentId === student.id && a.date === date
  );

  const time = new Date().toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (idx >= 0) {
    store.attendance[idx] = {
      ...store.attendance[idx],
      groupId: targetGroupId,
      status,
      time: status === "attended" ? time : undefined,
      method,
    };
  } else {
    store.attendance.push({
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentId: student.id,
      groupId: targetGroupId,
      date,
      status,
      time: status === "attended" ? time : undefined,
      method,
    });
  }

  saveManagementStore(store);
  return {
    success: true,
    student: {
      ...student,
      groupName: group?.name || student.groupName,
    },
    group,
    status,
    time,
  };
}

export function bulkMarkAttendance(
  studentIds: string[],
  groupId: string,
  date: string,
  status: AttendanceStatus
) {
  const store = getManagementStore();
  // Ensure session exists
  if (!store.sessions.some((s) => s.groupId === groupId && s.date === date)) {
    store.sessions.push({
      id: `ses-${Date.now()}`,
      groupId,
      date,
      title: "حصة دراسية",
    });
  }

  const time = new Date().toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  studentIds.forEach((studentId) => {
    const idx = store.attendance.findIndex(
      (a) => a.studentId === studentId && a.date === date
    );
    if (idx >= 0) {
      store.attendance[idx].status = status;
      store.attendance[idx].time = status === "attended" ? time : undefined;
      store.attendance[idx].method = "manual";
    } else {
      store.attendance.push({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId,
        groupId,
        date,
        status,
        time: status === "attended" ? time : undefined,
        method: "manual",
      });
    }
  });

  saveManagementStore(store);
  return true;
}

// ==========================================
// EXAM RECORDS & GRADES API
// ==========================================

export function getExamRecords(groupId: string): ExamRecord[] {
  const store = getManagementStore();
  return store.examRecords
    .filter((e) => e.groupId === groupId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveExamRecord(groupId: string, examName: string, totalScore: number, date?: string): ExamRecord {
  const store = getManagementStore();
  const newExam: ExamRecord = {
    id: `exm-rec-${Date.now()}`,
    groupId,
    examName,
    totalScore: Number(totalScore) || 20,
    date: date || new Date().toISOString().split("T")[0],
    createdAt: Date.now(),
  };

  store.examRecords.push(newExam);
  saveManagementStore(store);
  return newExam;
}

export function deleteExamRecord(id: string): boolean {
  const store = getManagementStore();
  store.examRecords = store.examRecords.filter((e) => e.id !== id);
  store.studentGrades = store.studentGrades.filter((g) => g.examRecordId !== id);
  saveManagementStore(store);
  return true;
}

export function getExamGrades(examRecordId: string, groupId: string) {
  const store = getManagementStore();
  const students = store.students.filter((s) => s.groupId === groupId);
  const exam = store.examRecords.find((e) => e.id === examRecordId);

  return students.map((std) => {
    const grade = store.studentGrades.find(
      (g) => g.examRecordId === examRecordId && g.studentId === std.id
    );

    return {
      studentId: std.id,
      code: std.code,
      studentName: std.name,
      parentPhone: std.parentPhone,
      studentPhone: std.studentPhone,
      studentStatus: std.status,
      score: grade ? grade.score : null,
      totalScore: exam?.totalScore || 20,
      method: grade?.method,
      notes: grade?.notes,
    };
  });
}

export function saveStudentGrade(
  examRecordId: string,
  studentIdOrCode: string,
  score: number,
  notes?: string,
  method: "camera_ai" | "manual" = "manual"
) {
  const store = getManagementStore();
  const student = store.students.find(
    (s) => s.id === studentIdOrCode || s.code === studentIdOrCode || s.name.trim() === studentIdOrCode.trim()
  );
  if (!student) return { success: false, error: "الطالب غير موجود" };

  const idx = store.studentGrades.findIndex(
    (g) => g.examRecordId === examRecordId && g.studentId === student.id
  );

  if (idx >= 0) {
    store.studentGrades[idx] = {
      ...store.studentGrades[idx],
      score: Number(score),
      notes: notes || store.studentGrades[idx].notes,
      method,
      recordedAt: Date.now(),
    };
  } else {
    store.studentGrades.push({
      id: `grd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      examRecordId,
      studentId: student.id,
      score: Number(score),
      notes,
      method,
      recordedAt: Date.now(),
    });
  }

  saveManagementStore(store);
  return { success: true, student, score };
}

// ==========================================
// STUDENT PROFILE AGGREGATOR
// ==========================================

export function getFullStudentProfile(studentId: string) {
  const store = getManagementStore();
  const clean = (studentId || "").includes("/s/")
    ? studentId.split("/s/").pop()?.split("?")[0]?.trim() || studentId.trim()
    : (studentId || "").trim();

  const student = store.students.find(
    (s) =>
      s.id === clean ||
      s.code === clean ||
      s.id.toLowerCase() === clean.toLowerCase() ||
      s.code.toLowerCase() === clean.toLowerCase()
  );
  if (!student) return null;

  const group = store.groups.find((g) => g.id === student.groupId);
  const financials = store.financials
    .filter((f) => f.studentId === student.id)
    .sort((a, b) => b.month.localeCompare(a.month));

  const attendance = store.attendance
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const sessions = store.sessions.filter((s) => s.groupId === student.groupId);

  const grades = store.studentGrades
    .filter((g) => g.studentId === student.id)
    .map((g) => {
      const exam = store.examRecords.find((e) => e.id === g.examRecordId);
      return {
        ...g,
        examName: exam?.examName || "اختبار دوري",
        totalScore: exam?.totalScore || 20,
        date: exam?.date,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    student: {
      ...student,
      groupName: group?.name || student.groupName,
    },
    group,
    financials,
    attendance,
    sessions,
    grades,
  };
}

// ==========================================
// SAVED QR PDFS API
// ==========================================

export function getSavedQrPdfs(): SavedQrPdf[] {
  const store = getManagementStore();
  return (store.savedQrPdfs || []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveQrPdf(title: string, groupName: string, studentIds: string[], pagesCount: number = 1): SavedQrPdf {
  const store = getManagementStore();
  const newPdf: SavedQrPdf = {
    id: `qr-pdf-${Date.now()}`,
    title,
    groupName,
    studentIds,
    createdAt: Date.now(),
    pagesCount,
  };

  if (!store.savedQrPdfs) store.savedQrPdfs = [];
  store.savedQrPdfs.unshift(newPdf);
  saveManagementStore(store);
  return newPdf;
}

export function deleteSavedQrPdf(id: string): boolean {
  const store = getManagementStore();
  if (!store.savedQrPdfs) return false;
  store.savedQrPdfs = store.savedQrPdfs.filter((p) => p.id !== id);
  saveManagementStore(store);
  return true;
}

// ==========================================
// FAST PAYMENT & ZERO-LATENCY QR LOOKUP
// ==========================================

export function getStudentForPayment(studentIdOrCode: string, month?: string) {
  const store = getManagementStore();
  const clean = (studentIdOrCode || "").includes("/s/")
    ? studentIdOrCode.split("/s/").pop()?.split("?")[0]?.trim() || studentIdOrCode.trim()
    : (studentIdOrCode || "").trim();

  const student = store.students.find(
    (s) =>
      s.id === clean ||
      s.code === clean ||
      s.id.toLowerCase() === clean.toLowerCase() ||
      s.code.toLowerCase() === clean.toLowerCase()
  );
  if (!student) return null;

  const targetMonth = month || new Date().toISOString().substring(0, 7);
  const group = store.groups.find((g) => g.id === student.groupId);
  const fin = store.financials.find(
    (f) => f.studentId === student.id && f.month === targetMonth
  );

  const totalAmount = fin?.totalAmount ?? (student.monthlyFee || 250);
  const paidAmount = fin?.paidAmount ?? 0;
  const status: PaymentStatus = fin?.status ?? "unpaid";

  return {
    student: {
      ...student,
      groupName: group?.name || student.groupName,
    },
    group,
    month: targetMonth,
    financial: fin || {
      id: `fin-${student.id}-${targetMonth}`,
      studentId: student.id,
      groupId: student.groupId,
      month: targetMonth,
      status,
      paidAmount,
      totalAmount,
      updatedAt: Date.now(),
    },
  };
}

export function recordFastPayment(
  studentIdOrCode: string,
  month: string,
  status: PaymentStatus = "paid",
  customPaidAmount?: number,
  notes?: string
) {
  const store = getManagementStore();
  const clean = (studentIdOrCode || "").includes("/s/")
    ? studentIdOrCode.split("/s/").pop()?.split("?")[0]?.trim() || studentIdOrCode.trim()
    : (studentIdOrCode || "").trim();

  const student = store.students.find(
    (s) =>
      s.id === clean ||
      s.code === clean ||
      s.id.toLowerCase() === clean.toLowerCase() ||
      s.code.toLowerCase() === clean.toLowerCase()
  );
  if (!student) return { success: false, error: "الطالب غير موجود في النظام" };

  const group = store.groups.find((g) => g.id === student.groupId);
  const totalAmount = student.monthlyFee || 250;
  let paidAmount = 0;
  if (status === "paid") {
    paidAmount = customPaidAmount !== undefined ? customPaidAmount : totalAmount;
  } else if (status === "returned") {
    paidAmount = 0;
  } else {
    paidAmount = customPaidAmount !== undefined ? customPaidAmount : 0;
  }

  const idx = store.financials.findIndex(
    (f) => f.studentId === student.id && f.month === month
  );

  const now = Date.now();
  let savedRecord: FinancialRecord;

  if (idx >= 0) {
    store.financials[idx] = {
      ...store.financials[idx],
      status,
      paidAmount,
      totalAmount,
      notes: notes !== undefined ? notes : store.financials[idx].notes,
      updatedAt: now,
    };
    savedRecord = store.financials[idx];
  } else {
    savedRecord = {
      id: `fin-${student.id}-${month}-${now}`,
      studentId: student.id,
      groupId: student.groupId,
      month,
      status,
      paidAmount,
      totalAmount,
      notes,
      updatedAt: now,
    };
    store.financials.push(savedRecord);
  }

  saveManagementStore(store);

  return {
    success: true,
    student: {
      ...student,
      groupName: group?.name || student.groupName,
    },
    group,
    financial: savedRecord,
  };
}

// ==========================================
// HOME ANALYTICS API
// ==========================================

export interface HomeAnalytics {
  todayDate: string;
  currentMonth: string;
  todayDateFormatted: string;
  currentMonthFormatted: string;
  overall: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    totalGroups: number;
    totalAcademicYears: number;
    todayAttendedCount: number;
    todayAbsentCount: number;
    todayAttendanceRate: number;
    monthlyExpectedRevenue: number;
    monthlyCollectedRevenue: number;
    monthlyRemainingRevenue: number;
    monthlyCollectionRate: number;
    paidStudentsCount: number;
    unpaidStudentsCount: number;
    partialStudentsCount: number;
  };
  byYear: Array<{
    year: string;
    studentsCount: number;
    activeStudentsCount: number;
    inactiveStudentsCount: number;
    groupsCount: number;
    percentageOfAllStudents: number;
    monthlyExpectedRevenue: number;
    monthlyCollectedRevenue: number;
    todayAttendedCount: number;
    todayTotalCount: number;
    attendanceRate: number;
  }>;
  byGroup: Array<{
    id: string;
    name: string;
    academicYear: string;
    subject: string;
    teacher: string;
    studentsCount: number;
    activeStudentsCount: number;
    monthlyFee: number;
    todayAttendedCount: number;
    todayAttendanceRate: number;
    monthlyPaidCount: number;
    monthlyUnpaidCount: number;
    monthlyPartialCount: number;
    monthlyCollectionRate: number;
  }>;
  recentAttendance: Array<{
    id: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    groupName: string;
    time?: string;
    status: AttendanceStatus;
    method?: string;
    date: string;
  }>;
  recentPayments: Array<{
    id: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    groupName: string;
    month: string;
    status: PaymentStatus;
    paidAmount: number;
    totalAmount: number;
    updatedAt: number;
  }>;
}

export function getHomeAnalytics(targetDate?: string, targetMonth?: string): HomeAnalytics {
  const store = getManagementStore();
  const todayDate = targetDate || new Date().toISOString().split("T")[0];
  const currentMonth = targetMonth || todayDate.substring(0, 7);

  // Format Dates in Arabic
  let todayDateFormatted = todayDate;
  let currentMonthFormatted = currentMonth;
  try {
    const d = new Date(todayDate);
    todayDateFormatted = d.toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    currentMonthFormatted = d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
    });
  } catch (e) {
    // fallback
  }

  const totalStudents = store.students.length;
  const activeStudents = store.students.filter((s) => s.status === "active").length;
  const inactiveStudents = store.students.filter((s) => s.status === "inactive").length;
  const totalGroups = store.groups.length;

  // Distinct academic years
  const yearsSet = new Set<string>();
  store.students.forEach((s) => {
    if (s.academicYear) yearsSet.add(s.academicYear);
  });
  store.groups.forEach((g) => {
    if (g.academicYear) yearsSet.add(g.academicYear);
  });
  const academicYears = Array.from(yearsSet);

  // Today's attendance
  const todayAttendedRecords = store.attendance.filter(
    (a) => a.date === todayDate && a.status === "attended"
  );
  const todayAttendedCount = todayAttendedRecords.length;
  const todayAbsentCount = Math.max(0, totalStudents - todayAttendedCount);
  const todayAttendanceRate =
    totalStudents > 0 ? Math.round((todayAttendedCount / totalStudents) * 100) : 0;

  // Monthly financials
  let monthlyExpectedRevenue = 0;
  let monthlyCollectedRevenue = 0;
  let paidStudentsCount = 0;
  let unpaidStudentsCount = 0;
  let partialStudentsCount = 0;

  store.students.forEach((s) => {
    const fee = s.monthlyFee || 250;
    if (s.status === "active") {
      monthlyExpectedRevenue += fee;
    }
    const fin = store.financials.find(
      (f) => f.studentId === s.id && f.month === currentMonth
    );
    if (fin) {
      monthlyCollectedRevenue += fin.paidAmount || 0;
      if (fin.status === "paid") {
        paidStudentsCount++;
      } else if (fin.status === "returned") {
        unpaidStudentsCount++;
      } else if (fin.paidAmount > 0 && fin.paidAmount < (fin.totalAmount || fee)) {
        partialStudentsCount++;
      } else {
        unpaidStudentsCount++;
      }
    } else {
      unpaidStudentsCount++;
    }
  });

  const monthlyRemainingRevenue = Math.max(0, monthlyExpectedRevenue - monthlyCollectedRevenue);
  const monthlyCollectionRate =
    monthlyExpectedRevenue > 0
      ? Math.round((monthlyCollectedRevenue / monthlyExpectedRevenue) * 100)
      : 0;

  // By Academic Year
  const byYear = academicYears.map((year) => {
    const yearStudents = store.students.filter((s) => s.academicYear === year);
    const activeCount = yearStudents.filter((s) => s.status === "active").length;
    const inactiveCount = yearStudents.filter((s) => s.status === "inactive").length;
    const groupsCount = store.groups.filter((g) => g.academicYear === year).length;
    const percentageOfAllStudents =
      totalStudents > 0 ? Math.round((yearStudents.length / totalStudents) * 100) : 0;

    let expectedRev = 0;
    let collectedRev = 0;
    let attendedToday = 0;

    yearStudents.forEach((st) => {
      const fee = st.monthlyFee || 250;
      if (st.status === "active") expectedRev += fee;
      const fin = store.financials.find(
        (f) => f.studentId === st.id && f.month === currentMonth
      );
      if (fin) collectedRev += fin.paidAmount || 0;

      const att = store.attendance.find(
        (a) => a.studentId === st.id && a.date === todayDate && a.status === "attended"
      );
      if (att) attendedToday++;
    });

    const attRate =
      yearStudents.length > 0 ? Math.round((attendedToday / yearStudents.length) * 100) : 0;

    return {
      year,
      studentsCount: yearStudents.length,
      activeStudentsCount: activeCount,
      inactiveStudentsCount: inactiveCount,
      groupsCount,
      percentageOfAllStudents,
      monthlyExpectedRevenue: expectedRev,
      monthlyCollectedRevenue: collectedRev,
      todayAttendedCount: attendedToday,
      todayTotalCount: yearStudents.length,
      attendanceRate: attRate,
    };
  });

  // By Group
  const byGroup = store.groups.map((grp) => {
    const grpStudents = store.students.filter((s) => s.groupId === grp.id);
    const activeCount = grpStudents.filter((s) => s.status === "active").length;
    const avgFee =
      grpStudents.length > 0
        ? Math.round(
            grpStudents.reduce((sum, s) => sum + (s.monthlyFee || 250), 0) /
              grpStudents.length
          )
        : 250;

    let attendedToday = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let collectedAmount = 0;
    let expectedAmount = 0;

    grpStudents.forEach((st) => {
      const fee = st.monthlyFee || 250;
      if (st.status === "active") expectedAmount += fee;

      const att = store.attendance.find(
        (a) => a.studentId === st.id && a.date === todayDate && a.status === "attended"
      );
      if (att) attendedToday++;

      const fin = store.financials.find(
        (f) => f.studentId === st.id && f.month === currentMonth
      );
      if (fin) {
        collectedAmount += fin.paidAmount || 0;
        if (fin.status === "paid") paidCount++;
        else if (fin.paidAmount > 0) partialCount++;
        else unpaidCount++;
      } else {
        unpaidCount++;
      }
    });

    const attRate =
      grpStudents.length > 0 ? Math.round((attendedToday / grpStudents.length) * 100) : 0;
    const collRate =
      expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 100) : 0;

    return {
      id: grp.id,
      name: grp.name,
      academicYear: grp.academicYear,
      subject: grp.subject,
      teacher: grp.teacher,
      studentsCount: grpStudents.length,
      activeStudentsCount: activeCount,
      monthlyFee: avgFee,
      todayAttendedCount: attendedToday,
      todayAttendanceRate: attRate,
      monthlyPaidCount: paidCount,
      monthlyUnpaidCount: unpaidCount,
      monthlyPartialCount: partialCount,
      monthlyCollectionRate: collRate,
    };
  });

  // Recent attendance (latest 10)
  const recentAttendance = [...store.attendance]
    .sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")))
    .slice(0, 8)
    .map((att) => {
      const student = store.students.find((s) => s.id === att.studentId);
      const group = store.groups.find((g) => g.id === att.groupId);
      return {
        id: att.id,
        studentId: att.studentId,
        studentName: student?.name || "طالب غير مسجل",
        studentCode: student?.code || "",
        groupName: group?.name || "مجموعة عامة",
        time: att.time,
        status: att.status,
        method: att.method,
        date: att.date,
      };
    });

  // Recent payments (latest 8)
  const recentPayments = [...store.financials]
    .filter((f) => (f.paidAmount && f.paidAmount > 0) || f.status === "paid" || f.status === "returned")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)
    .map((fin) => {
      const student = store.students.find((s) => s.id === fin.studentId);
      const group = store.groups.find((g) => g.id === fin.groupId);
      return {
        id: fin.id,
        studentId: fin.studentId,
        studentName: student?.name || "طالب غير مسجل",
        studentCode: student?.code || "",
        groupName: group?.name || "مجموعة عامة",
        month: fin.month,
        status: fin.status,
        paidAmount: fin.paidAmount,
        totalAmount: fin.totalAmount,
        updatedAt: fin.updatedAt,
      };
    });

  return {
    todayDate,
    currentMonth,
    todayDateFormatted,
    currentMonthFormatted,
    overall: {
      totalStudents,
      activeStudents,
      inactiveStudents,
      totalGroups,
      totalAcademicYears: academicYears.length,
      todayAttendedCount,
      todayAbsentCount,
      todayAttendanceRate,
      monthlyExpectedRevenue,
      monthlyCollectedRevenue,
      monthlyRemainingRevenue,
      monthlyCollectionRate,
      paidStudentsCount,
      unpaidStudentsCount,
      partialStudentsCount,
    },
    byYear,
    byGroup,
    recentAttendance,
    recentPayments,
  };
}
