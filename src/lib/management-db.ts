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
import { generateUniqueStudentCode } from "./student-code";
import { sanitizeTenantKey } from "./tenant-context";
import { setCachedManagementStoreBytes } from "./db";
export { generateUniqueStudentCode };

const globalForMgmt = globalThis as unknown as {
  __mgmtStoreCache?: Map<string, any>;
  __mgmtStoreMeta?: Map<string, { mtimeMs: number; checkedAt: number }>;
  __mgmtPendingFlushes?: Map<string, ReturnType<typeof setTimeout>>;
  __mgmtExitHookRegistered?: boolean;
};

function getMgmtMemoryCache(): Map<string, any> {
  if (!globalForMgmt.__mgmtStoreCache) {
    globalForMgmt.__mgmtStoreCache = new Map();
  }
  return globalForMgmt.__mgmtStoreCache;
}

function getMgmtMetaCache(): Map<string, { mtimeMs: number; checkedAt: number }> {
  if (!globalForMgmt.__mgmtStoreMeta) {
    globalForMgmt.__mgmtStoreMeta = new Map();
  }
  return globalForMgmt.__mgmtStoreMeta;
}

function getPendingFlushes(): Map<string, ReturnType<typeof setTimeout>> {
  if (!globalForMgmt.__mgmtPendingFlushes) {
    globalForMgmt.__mgmtPendingFlushes = new Map();
  }
  return globalForMgmt.__mgmtPendingFlushes;
}

const dataDir = path.join(os.homedir(), ".exam_builder");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const tenantsDir = path.join(dataDir, "tenants");
const legacyStorePath = path.join(dataDir, "management_store.json");

export function getLocalTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveStorePath(tenantId?: string): string {
  const key = sanitizeTenantKey(tenantId);
  if (!key || key === "default") {
    return legacyStorePath;
  }

  const tenantFolder = path.join(tenantsDir, key);
  const targetPath = path.join(tenantFolder, "management_store.json");

  if (!fs.existsSync(tenantFolder)) {
    fs.mkdirSync(tenantFolder, { recursive: true });
  }

  return targetPath;
}

export function purgeTenantManagementStore(tenantId: string): void {
  const key = sanitizeTenantKey(tenantId);
  if (!key || key === "default") return;
  const activeStorePath = resolveStorePath(tenantId);
  getMgmtMemoryCache().delete(activeStorePath);
  const pending = getPendingFlushes().get(activeStorePath);
  if (pending) {
    clearTimeout(pending);
    getPendingFlushes().delete(activeStorePath);
  }
  setCachedManagementStoreBytes(key, 0);
  try {
    const tenantFolder = path.join(tenantsDir, key);
    if (fs.existsSync(tenantFolder)) {
      fs.rmSync(tenantFolder, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("Error removing tenant management store folder:", err);
  }
}

export interface DeletedStudentLogEntry {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  groupId: string;
  groupName?: string;
  leftAt: number;
}

interface ManagementStore {
  groups: Group[];
  students: Student[];
  financials: FinancialRecord[];
  attendance: AttendanceRecord[];
  sessions: GroupClassSession[];
  examRecords: ExamRecord[];
  studentGrades: StudentGradeRecord[];
  savedQrPdfs: SavedQrPdf[];
  deletedStudentsLog?: DeletedStudentLogEntry[];
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

function getEmptyStore(): ManagementStore {
  return {
    groups: [],
    students: [],
    financials: [],
    attendance: [],
    sessions: [],
    examRecords: [],
    studentGrades: [],
    savedQrPdfs: [],
    deletedStudentsLog: [],
  };
}

function computeStoreActiveBytes(store: ManagementStore): number {
  let totalBytes = 0;
  const keys: Array<keyof ManagementStore> = [
    "groups",
    "students",
    "financials",
    "attendance",
    "sessions",
    "examRecords",
    "studentGrades",
    "savedQrPdfs",
  ];
  for (const k of keys) {
    const arr = store[k];
    if (Array.isArray(arr) && arr.length > 0) {
      totalBytes += Buffer.byteLength(JSON.stringify(arr), "utf8");
    }
  }
  return totalBytes;
}

let tmpWriteCounter = 0;

function flushStoreToDiskSync(activeStorePath: string, store: ManagementStore): void {
  try {
    const dir = path.dirname(activeStorePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized = JSON.stringify(store);
    const tmpPath = `${activeStorePath}.${process.pid}.${Date.now()}.${++tmpWriteCounter}.tmp`;
    try {
      fs.writeFileSync(tmpPath, serialized, "utf-8");
      fs.renameSync(tmpPath, activeStorePath);
    } catch {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
      fs.writeFileSync(activeStorePath, serialized, "utf-8");
    }
    try {
      const st = fs.statSync(activeStorePath);
      getMgmtMetaCache().set(activeStorePath, { mtimeMs: st.mtimeMs, checkedAt: Date.now() });
    } catch {}
  } catch (err) {
    console.error("Error saving management store:", err);
  }
}

export function flushAllPendingManagementStores(): void {
  const flushes = getPendingFlushes();
  if (flushes.size === 0) return;
  const memCache = getMgmtMemoryCache();
  for (const [storePath, timer] of flushes.entries()) {
    clearTimeout(timer);
    flushes.delete(storePath);
    const store = memCache.get(storePath);
    if (store) {
      flushStoreToDiskSync(storePath, store);
    }
  }
}

if (typeof process !== "undefined" && !globalForMgmt.__mgmtExitHookRegistered) {
  globalForMgmt.__mgmtExitHookRegistered = true;
  const onExit = () => {
    try {
      flushAllPendingManagementStores();
    } catch {}
  };
  process.once("beforeExit", onExit);
  process.once("SIGTERM", () => {
    onExit();
    process.exit(0);
  });
  process.once("SIGINT", () => {
    onExit();
    process.exit(0);
  });
}

export function getManagementStore(tenantId?: string): ManagementStore {
  const key = sanitizeTenantKey(tenantId);
  const activeStorePath = resolveStorePath(tenantId);
  const memCache = getMgmtMemoryCache();
  const metaCache = getMgmtMetaCache();
  const flushes = getPendingFlushes();
  const cached = memCache.get(activeStorePath);

  if (cached) {
    // If there is an active write-behind flush in this process, RAM is strictly newer than disk
    if (flushes.has(activeStorePath)) {
      return cached;
    }
    // Throttle disk mtime check to at most once every 3s per tenant (zero load during bursts)
    const meta = metaCache.get(activeStorePath);
    const now = Date.now();
    if (meta && now - meta.checkedAt < 3000) {
      return cached;
    }
    try {
      if (fs.existsSync(activeStorePath)) {
        const st = fs.statSync(activeStorePath);
        if (meta && st.mtimeMs === meta.mtimeMs) {
          meta.checkedAt = now;
          return cached;
        }
      }
    } catch {}
  }

  try {
    if (fs.existsSync(activeStorePath)) {
      const st = fs.statSync(activeStorePath);
      const data = fs.readFileSync(activeStorePath, "utf-8");
      const parsed = JSON.parse(data) as ManagementStore;
      memCache.set(activeStorePath, parsed);
      metaCache.set(activeStorePath, { mtimeMs: st.mtimeMs, checkedAt: Date.now() });
      setCachedManagementStoreBytes(key, computeStoreActiveBytes(parsed));
      return parsed;
    }
  } catch (err) {
    console.error("Error reading management store:", err);
    const backupPath = `${activeStorePath}.bak`;
    try {
      if (fs.existsSync(backupPath)) {
        const backupData = fs.readFileSync(backupPath, "utf-8");
        const parsed = JSON.parse(backupData) as ManagementStore;
        fs.copyFileSync(backupPath, activeStorePath);
        memCache.set(activeStorePath, parsed);
        setCachedManagementStoreBytes(key, computeStoreActiveBytes(parsed));
        return parsed;
      }
    } catch (backupErr) {
      console.error("Error reading management store backup:", backupErr);
    }
  }

  // Every new tenant installation starts 100% zeroed and empty
  const initial = getEmptyStore();
  saveManagementStore(initial, tenantId, true);
  return initial;
}

export function resetTenantManagementStore(tenantId?: string): void {
  const empty = getEmptyStore();
  saveManagementStore(empty, tenantId, true);
}

export function saveManagementStore(
  store: ManagementStore,
  tenantId?: string,
  immediate: boolean = true
): void {
  const key = sanitizeTenantKey(tenantId);
  const activeStorePath = resolveStorePath(tenantId);
  getMgmtMemoryCache().set(activeStorePath, store);
  setCachedManagementStoreBytes(key, computeStoreActiveBytes(store));

  const flushes = getPendingFlushes();
  const existingTimer = flushes.get(activeStorePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
    flushes.delete(activeStorePath);
  }

  if (immediate) {
    flushStoreToDiskSync(activeStorePath, store);
    return;
  }

  // Debounced asynchronous write-behind (1200ms) so 200 rapid QR scans respond in < 1ms from RAM
  const timer = setTimeout(async () => {
    flushes.delete(activeStorePath);
    try {
      const latest = getMgmtMemoryCache().get(activeStorePath) || store;
      const dir = path.dirname(activeStorePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const serialized = JSON.stringify(latest);
      const tmpPath = `${activeStorePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmpPath, serialized, "utf-8");
      await fs.promises.rename(tmpPath, activeStorePath);
      try {
        const st = await fs.promises.stat(activeStorePath);
        getMgmtMetaCache().set(activeStorePath, { mtimeMs: st.mtimeMs, checkedAt: Date.now() });
      } catch {}
    } catch (err) {
      console.error("Async management store flush failed, falling back to sync:", err);
      flushStoreToDiskSync(activeStorePath, store);
    }
  }, 1200);

  flushes.set(activeStorePath, timer);
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
  const removedStudentIds = new Set(
    store.students.filter((s) => s.groupId === id).map((s) => s.id)
  );
  const removedExamRecordIds = new Set(
    store.examRecords.filter((e) => e.groupId === id).map((e) => e.id)
  );

  store.groups = store.groups.filter((g) => g.id !== id);
  store.students = store.students.filter((s) => s.groupId !== id);
  store.financials = store.financials.filter(
    (f) => f.groupId !== id && !removedStudentIds.has(f.studentId)
  );
  store.attendance = store.attendance.filter(
    (a) => a.groupId !== id && !removedStudentIds.has(a.studentId)
  );
  store.sessions = store.sessions.filter((s) => s.groupId !== id);
  store.examRecords = store.examRecords.filter((e) => e.groupId !== id);
  store.studentGrades = (store.studentGrades || []).filter(
    (gr) => !removedExamRecordIds.has(gr.examRecordId) && !removedStudentIds.has(gr.studentId)
  );
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
      const existing = store.students[idx];
      const existingCode = existing.code;
      const nextStatus = student.status || existing.status;
      let nextLeftAt = existing.leftAt;
      if (nextStatus === "inactive" && existing.status !== "inactive") {
        nextLeftAt = now;
      } else if (nextStatus === "active") {
        nextLeftAt = undefined;
      }
      store.students[idx] = {
        ...existing,
        ...student,
        status: nextStatus,
        leftAt: nextLeftAt,
        code: existingCode, // Code is immutable once generated
        groupName: grp ? grp.name : existing.groupName,
        updatedAt: now,
      };
      saveManagementStore(store);
      return store.students[idx];
    }
  }

  // Generate unique code (max 8 chars, high-entropy shuffled alphanumeric: digits + letters)
  const existingCodes = new Set(store.students.map((s) => s.code));
  const assignedCode = student.code?.trim()
    ? student.code.trim().toUpperCase()
    : generateUniqueStudentCode(existingCodes);

  const initialStatus = student.status || "active";
  const newStudent: Student = {
    id: student.id || `std-${now}-${Math.random().toString(36).slice(2, 6)}`,
    code: assignedCode,
    name: student.name,
    academicYear: student.academicYear || grp?.academicYear || "الصف الأول الثانوي",
    groupId: student.groupId,
    groupName: grp?.name,
    parentPhone: student.parentPhone || "",
    studentPhone: student.studentPhone || "",
    monthlyFee: student.monthlyFee ?? 250,
    status: initialStatus,
    leftAt: initialStatus === "inactive" ? now : undefined,
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
  const target = store.students.find((s) => s.id === id);
  if (target) {
    const grp = store.groups.find((g) => g.id === target.groupId);
    if (!store.deletedStudentsLog) {
      store.deletedStudentsLog = [];
    }
    store.deletedStudentsLog.push({
      id: target.id,
      name: target.name,
      code: target.code,
      academicYear: target.academicYear || grp?.academicYear || "غير محدد",
      groupId: target.groupId,
      groupName: target.groupName || grp?.name,
      leftAt: Date.now(),
    });
  }
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
  const now = Date.now();
  store.students = store.students.map((s) => {
    if (studentIds.includes(s.id)) {
      let nextLeftAt = s.leftAt;
      if (updates.status === "inactive" && s.status !== "inactive") {
        nextLeftAt = now;
      } else if (updates.status === "active") {
        nextLeftAt = undefined;
      }
      return {
        ...s,
        ...updates,
        leftAt: nextLeftAt,
        updatedAt: now,
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
        studentCode: std.code,
        studentStatus: std.status,
        parentPhone: std.parentPhone,
        monthlyFee: std.monthlyFee,
      };
    }

    // Default status is UNPAID as requested
    return {
      id: `fin-${std.id}-${month}`,
      studentId: std.id,
      studentName: std.name,
      studentCode: std.code,
      studentStatus: std.status,
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

  // Empty calendar always waiting for action of the buttons (تثبيت حصة يوم)
  const sessionExists = store.sessions.some((s) => s.groupId === groupId && s.date === date);
  if (!sessionExists) {
    return [];
  }

  const groupStudents = store.students.filter((s) => s.groupId === groupId);
  const attendanceForGroupAndDate = store.attendance.filter(
    (a) => a.groupId === groupId && a.date === date
  );

  // Group members
  const result: any[] = groupStudents.map((std) => {
    const record = attendanceForGroupAndDate.find((a) => a.studentId === std.id);
    return {
      studentId: std.id,
      code: std.code,
      studentName: std.name,
      status: record ? record.status : ("absent" as AttendanceStatus),
      time: record?.time,
      method: record?.method,
      studentStatus: std.status,
      isExternal: false,
      originGroupName: undefined,
    };
  });

  // Students from outside this group who attended this session
  const externalRecords = attendanceForGroupAndDate.filter(
    (a) => !groupStudents.some((s) => s.id === a.studentId)
  );

  externalRecords.forEach((extRec) => {
    const extStudent = store.students.find((s) => s.id === extRec.studentId);
    if (extStudent) {
      const originGroup = store.groups.find((g) => g.id === extStudent.groupId);
      result.push({
        studentId: extStudent.id,
        code: extStudent.code,
        studentName: extStudent.name,
        status: extRec.status,
        time: extRec.time,
        method: extRec.method,
        studentStatus: extStudent.status,
        isExternal: true,
        originGroupName: originGroup?.name || "مجموعة أخرى",
      });
    }
  });

  return result;
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

export function deleteClassSession(groupId: string, date: string): boolean {
  const store = getManagementStore();
  store.sessions = store.sessions.filter((s) => !(s.groupId === groupId && s.date === date));
  store.attendance = store.attendance.filter((a) => !(a.groupId === groupId && a.date === date));
  saveManagementStore(store);
  return true;
}

export function deleteStudentAttendance(groupId: string, studentId: string, date: string): boolean {
  const store = getManagementStore();
  store.attendance = store.attendance.filter(
    (a) => !(a.groupId === groupId && a.studentId === studentId && a.date === date)
  );
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
    date: date || getLocalTodayDate(),
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

export function deleteStudentGrade(examRecordId: string, studentId: string): boolean {
  const store = getManagementStore();
  store.studentGrades = store.studentGrades.filter(
    (g) => !(g.examRecordId === examRecordId && g.studentId === studentId)
  );
  saveManagementStore(store);
  return true;
}

export function deleteFinancialRecord(groupId: string, studentId: string, month: string): boolean {
  const store = getManagementStore();
  store.financials = store.financials.filter(
    (f) => !(f.groupId === groupId && f.studentId === studentId && f.month === month)
  );
  saveManagementStore(store);
  return true;
}

// ==========================================
// STUDENT PROFILE AGGREGATOR
// ==========================================

export function getFullStudentProfile(
  studentId: string,
  options?: { publicTokenOnly?: boolean; strictTenantOnly?: boolean }
) {
  const activeKey = sanitizeTenantKey();
  const clean = (studentId || "").includes("/s/")
    ? studentId.split("/s/").pop()?.split("?")[0]?.trim() || studentId.trim()
    : (studentId || "").trim();

  if (!clean) return null;
  if (options?.publicTokenOnly && /^std-\d+$/i.test(clean)) {
    return null;
  }

  const matchStudent = (stList: Student[]) =>
    stList.find((s) => {
      if (options?.publicTokenOnly) {
        return (
          s.code === clean ||
          s.code.toLowerCase() === clean.toLowerCase() ||
          (!/^std-\d+$/i.test(s.id) &&
            (s.id === clean || s.id.toLowerCase() === clean.toLowerCase()))
        );
      }
      return (
        s.id === clean ||
        s.code === clean ||
        s.id.toLowerCase() === clean.toLowerCase() ||
        s.code.toLowerCase() === clean.toLowerCase()
      );
    });

  let store = getManagementStore();
  let student =
    activeKey && activeKey !== "default" ? matchStudent(store.students) : undefined;

  // If not found in a dedicated tenant context (e.g. public /s/[token] on the main platform domain),
  // search across all real tenant stores first, then legacy store as last resort.
  if (!student && !options?.strictTenantOnly) {
    const candidateFiles: string[] = [];
    if (fs.existsSync(tenantsDir)) {
      try {
        for (const entry of fs.readdirSync(tenantsDir)) {
          const candidate = path.join(tenantsDir, entry, "management_store.json");
          if (fs.existsSync(candidate)) candidateFiles.push(candidate);
        }
      } catch {}
    }
    if (fs.existsSync(legacyStorePath)) {
      candidateFiles.push(legacyStorePath);
    }

    for (const filePath of candidateFiles) {
      try {
        const candidateStore = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ManagementStore;
        const found = matchStudent(candidateStore.students || []);
        if (found) {
          store = candidateStore;
          student = found;
          break;
        }
      } catch {}
    }
  }

  if (!student && activeKey === "default") {
    student = matchStudent(store.students);
  }

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

export type AnalyticsFilterMode = "month" | "year" | "custom";

export interface AnalyticsRangeOptions {
  mode?: AnalyticsFilterMode;
  month?: string; // YYYY-MM
  year?: string; // YYYY
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface HomeAnalytics {
  todayDate: string;
  currentMonth: string;
  todayDateFormatted: string;
  currentMonthFormatted: string;
  filter: {
    mode: AnalyticsFilterMode;
    month: string;
    year: string;
    startDate: string;
    endDate: string;
    periodLabel: string;
  };
  overall: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    totalGroups: number;
    totalAcademicYears: number;
    currentMonthlySubscriptionTotal: number;
    newStudentsCount: number;
    leftStudentsCount: number;
    netStudentsChange: number;
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
    overdueStudentsCount: number;
    totalOverdueAmount: number;
  };
  absentStudentsToday: Array<{
    id: string;
    name: string;
    code: string;
    academicYear: string;
    groupId: string;
    groupName: string;
    parentPhone: string;
    studentPhone: string;
  }>;
  overdueStudentsList: Array<{
    id: string;
    name: string;
    code: string;
    academicYear: string;
    groupId: string;
    groupName: string;
    parentPhone: string;
    studentPhone: string;
    requiredAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: "unpaid" | "partial";
  }>;
  byYear: Array<{
    year: string;
    studentsCount: number;
    activeStudentsCount: number;
    inactiveStudentsCount: number;
    newStudentsCount: number;
    leftStudentsCount: number;
    monthlySubscriptionTotal: number;
    groupsCount: number;
    percentageOfAllStudents: number;
    monthlyExpectedRevenue: number;
    monthlyCollectedRevenue: number;
    todayAttendedCount: number;
    todayTotalCount: number;
    attendanceRate: number;
  }>;
  newStudentsList: Array<{
    id: string;
    name: string;
    code: string;
    academicYear: string;
    groupName: string;
    monthlyFee: number;
    createdAt: number;
  }>;
  leftStudentsList: Array<{
    id: string;
    name: string;
    code: string;
    academicYear: string;
    groupName: string;
    leftAt: number;
    reason: "inactive" | "deleted";
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

export function getHomeAnalytics(
  targetDate?: string,
  targetMonth?: string,
  rangeOptions?: AnalyticsRangeOptions
): HomeAnalytics {
  const store = getManagementStore();
  const todayDate = targetDate || getLocalTodayDate();
  const defaultMonth = targetMonth || todayDate.substring(0, 7);
  const defaultYear = todayDate.substring(0, 4);

  const mode: AnalyticsFilterMode = rangeOptions?.mode || "month";
  const selectedMonth = rangeOptions?.month || defaultMonth;
  const selectedYear = rangeOptions?.year || selectedMonth.substring(0, 4) || defaultYear;

  let startDate = `${selectedMonth}-01`;
  let endDate = todayDate;

  if (mode === "month") {
    const [yStr, mStr] = selectedMonth.split("-");
    const y = parseInt(yStr, 10) || new Date().getFullYear();
    const m = parseInt(mStr, 10) || new Date().getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  } else if (mode === "year") {
    const y = parseInt(selectedYear, 10) || new Date().getFullYear();
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31`;
  } else if (mode === "custom") {
    startDate = rangeOptions?.startDate || `${defaultMonth}-01`;
    endDate = rangeOptions?.endDate || todayDate;
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
  }

  const rangeStartMs = new Date(`${startDate}T00:00:00`).getTime();
  const rangeEndMs = new Date(`${endDate}T23:59:59.999`).getTime();
  const startMonthKey = startDate.substring(0, 7);
  const endMonthKey = endDate.substring(0, 7);
  const currentMonth = mode === "month" ? selectedMonth : endMonthKey;

  // Format Dates in Arabic
  let todayDateFormatted = todayDate;
  let currentMonthFormatted = currentMonth;
  let periodLabel = currentMonth;
  try {
    const d = new Date(`${todayDate}T12:00:00`);
    todayDateFormatted = d.toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (mode === "month") {
      const mDate = new Date(`${startDate}T12:00:00`);
      currentMonthFormatted = mDate.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
      });
      periodLabel = currentMonthFormatted;
    } else if (mode === "year") {
      periodLabel = `سنة ${selectedYear}`;
      currentMonthFormatted = periodLabel;
    } else {
      const sDate = new Date(`${startDate}T12:00:00`).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const eDate = new Date(`${endDate}T12:00:00`).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      periodLabel = `من ${sDate} إلى ${eDate}`;
      currentMonthFormatted = periodLabel;
    }
  } catch {
    // fallback
  }

  const totalStudents = store.students.length;
  const activeStudentsList = store.students.filter((s) => s.status === "active");
  const inactiveStudentsList = store.students.filter((s) => s.status === "inactive");
  const activeStudents = activeStudentsList.length;
  const inactiveStudents = inactiveStudentsList.length;
  const totalGroups = store.groups.length;

  // 1. Current Monthly Subscription Total (إجمالي الاشتراك الشهري الحالي للطلاب الفعليين)
  const currentMonthlySubscriptionTotal = activeStudentsList.reduce(
    (sum, s) => sum + (s.monthlyFee || 250),
    0
  );

  // 2. New Students & Left Students in [rangeStartMs, rangeEndMs]
  const newStudentsInRange = store.students
    .filter((s) => s.createdAt >= rangeStartMs && s.createdAt <= rangeEndMs)
    .sort((a, b) => b.createdAt - a.createdAt);

  const newStudentsList = newStudentsInRange.slice(0, 12).map((s) => {
    const grp = store.groups.find((g) => g.id === s.groupId);
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      academicYear: s.academicYear || grp?.academicYear || "غير محدد",
      groupName: grp?.name || s.groupName || "مجموعة عامة",
      monthlyFee: s.monthlyFee || 250,
      createdAt: s.createdAt,
    };
  });

  const leftStudentsRaw: Array<{
    id: string;
    name: string;
    code: string;
    academicYear: string;
    groupName: string;
    leftAt: number;
    reason: "inactive" | "deleted";
  }> = [];
  const seenLeftIds = new Set<string>();

  inactiveStudentsList.forEach((s) => {
    const leftTimestamp = s.leftAt || s.updatedAt || s.createdAt;
    if (leftTimestamp >= rangeStartMs && leftTimestamp <= rangeEndMs) {
      const grp = store.groups.find((g) => g.id === s.groupId);
      seenLeftIds.add(s.id);
      leftStudentsRaw.push({
        id: s.id,
        name: s.name,
        code: s.code,
        academicYear: s.academicYear || grp?.academicYear || "غير محدد",
        groupName: grp?.name || s.groupName || "مجموعة عامة",
        leftAt: leftTimestamp,
        reason: "inactive",
      });
    }
  });

  (store.deletedStudentsLog || []).forEach((del) => {
    if (!seenLeftIds.has(del.id) && del.leftAt >= rangeStartMs && del.leftAt <= rangeEndMs) {
      seenLeftIds.add(del.id);
      leftStudentsRaw.push({
        id: del.id,
        name: del.name,
        code: del.code,
        academicYear: del.academicYear || "غير محدد",
        groupName: del.groupName || "مجموعة عامة",
        leftAt: del.leftAt,
        reason: "deleted",
      });
    }
  });

  leftStudentsRaw.sort((a, b) => b.leftAt - a.leftAt);
  const leftStudentsList = leftStudentsRaw.slice(0, 12);

  const newStudentsCount = newStudentsInRange.length;
  const leftStudentsCount = leftStudentsRaw.length;
  const netStudentsChange = newStudentsCount - leftStudentsCount;

  // Distinct academic years
  const yearsSet = new Set<string>();
  store.students.forEach((s) => {
    if (s.academicYear) yearsSet.add(s.academicYear);
  });
  store.groups.forEach((g) => {
    if (g.academicYear) yearsSet.add(g.academicYear);
  });
  leftStudentsRaw.forEach((l) => {
    if (l.academicYear) yearsSet.add(l.academicYear);
  });
  const academicYears = Array.from(yearsSet);

  // Today's attendance (measured against active students when available)
  const todayAttendedRecords = store.attendance.filter(
    (a) => a.date === todayDate && a.status === "attended"
  );
  const attendedStudentIdsToday = new Set(todayAttendedRecords.map((a) => a.studentId));
  const absentStudentsToday = activeStudentsList
    .filter((s) => !attendedStudentIdsToday.has(s.id))
    .map((s) => {
      const grp = store.groups.find((g) => g.id === s.groupId);
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        academicYear: s.academicYear || grp?.academicYear || "غير محدد",
        groupId: s.groupId,
        groupName: grp?.name || s.groupName || "مجموعة عامة",
        parentPhone: s.parentPhone || "",
        studentPhone: s.studentPhone || "",
      };
    });

  const todayAttendedCount = todayAttendedRecords.length;
  const attendanceDenominator = activeStudents > 0 ? activeStudents : totalStudents;
  const todayAbsentCount = absentStudentsToday.length;
  const todayAttendanceRate =
    attendanceDenominator > 0 ? Math.min(100, Math.round((todayAttendedCount / attendanceDenominator) * 100)) : 0;

  // Helper to check if a financial record belongs to the selected period
  const isFinancialInPeriod = (fin: FinancialRecord) => {
    if (mode === "month") {
      return fin.month === selectedMonth;
    }
    if (mode === "year") {
      return fin.month.startsWith(selectedYear);
    }
    // custom mode: match month range [startMonthKey, endMonthKey]
    return fin.month >= startMonthKey && fin.month <= endMonthKey;
  };

  // Monthly / Period financials & Overdue Students Tracking
  let monthlyExpectedRevenue = 0;
  let monthlyCollectedRevenue = 0;
  let paidStudentsCount = 0;
  let unpaidStudentsCount = 0;
  let partialStudentsCount = 0;
  let totalOverdueAmount = 0;

  const overdueStudentsList: Array<{
    id: string;
    name: string;
    code: string;
    academicYear: string;
    groupId: string;
    groupName: string;
    parentPhone: string;
    studentPhone: string;
    requiredAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: "unpaid" | "partial";
  }> = [];

  store.students.forEach((s) => {
    const fee = s.monthlyFee || 250;
    const grp = store.groups.find((g) => g.id === s.groupId);
    if (s.status === "active") {
      monthlyExpectedRevenue += fee;
    }
    const matchingFins = store.financials.filter(
      (f) => f.studentId === s.id && isFinancialInPeriod(f)
    );
    if (matchingFins.length > 0) {
      const studentPaidSum = matchingFins.reduce((acc, f) => acc + (f.paidAmount || 0), 0);
      monthlyCollectedRevenue += studentPaidSum;
      // Evaluate against the primary/latest month in period
      const latestFin =
        matchingFins.find((f) => f.month === currentMonth) ||
        matchingFins[matchingFins.length - 1];
      const targetTotal = latestFin.totalAmount || fee;
      const paidVal = latestFin.status === "returned" ? 0 : latestFin.paidAmount || 0;
      const remVal = Math.max(0, targetTotal - paidVal);

      if (latestFin.status === "returned") {
        unpaidStudentsCount++;
      } else if (paidVal > 0 && paidVal < targetTotal) {
        partialStudentsCount++;
      } else if (latestFin.status === "paid" || (paidVal >= targetTotal && targetTotal > 0)) {
        paidStudentsCount++;
      } else {
        unpaidStudentsCount++;
      }

      if (s.status === "active" && remVal > 0) {
        totalOverdueAmount += remVal;
        overdueStudentsList.push({
          id: s.id,
          name: s.name,
          code: s.code,
          academicYear: s.academicYear || grp?.academicYear || "غير محدد",
          groupId: s.groupId,
          groupName: grp?.name || s.groupName || "مجموعة عامة",
          parentPhone: s.parentPhone || "",
          studentPhone: s.studentPhone || "",
          requiredAmount: targetTotal,
          paidAmount: paidVal,
          remainingAmount: remVal,
          status: paidVal > 0 ? "partial" : "unpaid",
        });
      }
    } else {
      unpaidStudentsCount++;
      if (s.status === "active") {
        totalOverdueAmount += fee;
        overdueStudentsList.push({
          id: s.id,
          name: s.name,
          code: s.code,
          academicYear: s.academicYear || grp?.academicYear || "غير محدد",
          groupId: s.groupId,
          groupName: grp?.name || s.groupName || "مجموعة عامة",
          parentPhone: s.parentPhone || "",
          studentPhone: s.studentPhone || "",
          requiredAmount: fee,
          paidAmount: 0,
          remainingAmount: fee,
          status: "unpaid",
        });
      }
    }
  });

  overdueStudentsList.sort((a, b) => b.remainingAmount - a.remainingAmount);
  const overdueStudentsCount = overdueStudentsList.length;

  const monthlyRemainingRevenue = Math.max(0, monthlyExpectedRevenue - monthlyCollectedRevenue);
  const monthlyCollectionRate =
    monthlyExpectedRevenue > 0
      ? Math.min(100, Math.round((monthlyCollectedRevenue / monthlyExpectedRevenue) * 100))
      : 0;

  // By Academic Year
  const byYear = academicYears.map((year) => {
    const yearStudents = store.students.filter((s) => s.academicYear === year);
    const activeYearStudents = yearStudents.filter((s) => s.status === "active");
    const activeCount = activeYearStudents.length;
    const inactiveCount = yearStudents.filter((s) => s.status === "inactive").length;
    const yearNewCount = newStudentsInRange.filter((s) => s.academicYear === year).length;
    const yearLeftCount = leftStudentsRaw.filter((s) => s.academicYear === year).length;
    const monthlySubscriptionTotal = activeYearStudents.reduce(
      (sum, s) => sum + (s.monthlyFee || 250),
      0
    );
    const groupsCount = store.groups.filter((g) => g.academicYear === year).length;
    const percentageOfAllStudents =
      totalStudents > 0 ? Math.round((yearStudents.length / totalStudents) * 100) : 0;

    let expectedRev = 0;
    let collectedRev = 0;
    let attendedToday = 0;

    yearStudents.forEach((st) => {
      const fee = st.monthlyFee || 250;
      if (st.status === "active") expectedRev += fee;
      const matchingFins = store.financials.filter(
        (f) => f.studentId === st.id && isFinancialInPeriod(f)
      );
      matchingFins.forEach((fin) => {
        collectedRev += fin.paidAmount || 0;
      });

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
      newStudentsCount: yearNewCount,
      leftStudentsCount: yearLeftCount,
      monthlySubscriptionTotal,
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

      const matchingFins = store.financials.filter(
        (f) => f.studentId === st.id && isFinancialInPeriod(f)
      );
      if (matchingFins.length > 0) {
        collectedAmount += matchingFins.reduce((acc, f) => acc + (f.paidAmount || 0), 0);
        const fin =
          matchingFins.find((f) => f.month === currentMonth) ||
          matchingFins[matchingFins.length - 1];
        const targetTotal = fin.totalAmount || fee;
        if (fin.status === "returned") unpaidCount++;
        else if (fin.paidAmount > 0 && fin.paidAmount < targetTotal) partialCount++;
        else if (fin.status === "paid" || (fin.paidAmount >= targetTotal && targetTotal > 0)) paidCount++;
        else unpaidCount++;
      } else {
        unpaidCount++;
      }
    });

    const attRate =
      grpStudents.length > 0 ? Math.round((attendedToday / grpStudents.length) * 100) : 0;
    const collRate =
      expectedAmount > 0 ? Math.min(100, Math.round((collectedAmount / expectedAmount) * 100)) : 0;

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

  // Recent attendance (latest 8)
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
    filter: {
      mode,
      month: selectedMonth,
      year: selectedYear,
      startDate,
      endDate,
      periodLabel,
    },
    overall: {
      totalStudents,
      activeStudents,
      inactiveStudents,
      totalGroups,
      totalAcademicYears: academicYears.length,
      currentMonthlySubscriptionTotal,
      newStudentsCount,
      leftStudentsCount,
      netStudentsChange,
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
      overdueStudentsCount,
      totalOverdueAmount,
    },
    absentStudentsToday,
    overdueStudentsList,
    byYear,
    newStudentsList,
    leftStudentsList,
    byGroup,
    recentAttendance,
    recentPayments,
  };
}


// ============================================================================
// EXCEL / SHEETS BULK IMPORT & EXPORT ENGINE
// ============================================================================

function normalizeNameForMatch(name: string): string {
  return String(name || "")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface BulkImportStudentRow {
  name: string;
  parentPhone?: string;
  studentPhone?: string;
  monthlyFee?: number;
  academicYear?: string;
  groupId?: string;
  groupName?: string;
  notes?: string;
  code?: string;
}

export function bulkImportStudents(params: {
  rows: BulkImportStudentRow[];
  defaultGroupId: string;
  defaultAcademicYear: string;
  defaultMonthlyFee?: number;
  duplicateMode?: "skip" | "update" | "allow";
}): {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
  totalProcessed: number;
  importedStudents: Student[];
} {
  const store = getManagementStore();
  const now = Date.now();
  const duplicateMode = params.duplicateMode || "skip";
  const defaultFee = Number.isFinite(params.defaultMonthlyFee) ? Number(params.defaultMonthlyFee) : 250;

  const existingCodes = new Set(store.students.map((s) => s.code.toUpperCase()));

  // Build lookup maps for duplicate detection within target group
  const existingByGroupAndName = new Map<string, number>();
  const existingByCode = new Map<string, number>();

  store.students.forEach((s, idx) => {
    const key = `${s.groupId}::${normalizeNameForMatch(s.name)}`;
    existingByGroupAndName.set(key, idx);
    if (s.code) {
      existingByCode.set(s.code.toUpperCase(), idx);
    }
  });

  // Also map group names to group IDs in case a row specifies a valid groupName
  const groupByName = new Map<string, Group>();
  const groupById = new Map<string, Group>();
  store.groups.forEach((g) => {
    groupById.set(g.id, g);
    groupByName.set(normalizeNameForMatch(g.name), g);
  });

  const fallbackGroup = groupById.get(params.defaultGroupId) || store.groups[0];
  if (!fallbackGroup) {
    throw new Error("لا توجد مجموعة دراسية محددة للاستيراد. يرجى إنشاء أو اختيار مجموعة أولاً.");
  }

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorsCount = 0;
  const importedStudents: Student[] = [];

  params.rows.forEach((rawRow, index) => {
    const cleanName = String(rawRow.name || "").replace(/\s+/g, " ").trim();
    if (!cleanName || cleanName.length < 2) {
      errorsCount++;
      return;
    }

    // Resolve group: explicit groupId -> explicit matching groupName -> fallbackGroup
    let targetGroup = fallbackGroup;
    if (rawRow.groupId && groupById.has(rawRow.groupId)) {
      targetGroup = groupById.get(rawRow.groupId)!;
    } else if (rawRow.groupName) {
      const matchedGrp = groupByName.get(normalizeNameForMatch(rawRow.groupName));
      if (matchedGrp) targetGroup = matchedGrp;
    }

    const resolvedYear =
      rawRow.academicYear?.trim() ||
      targetGroup.academicYear ||
      params.defaultAcademicYear ||
      "الصف الأول الثانوي";

    const resolvedFee =
      rawRow.monthlyFee !== undefined && Number.isFinite(Number(rawRow.monthlyFee)) && Number(rawRow.monthlyFee) >= 0
        ? Math.round(Number(rawRow.monthlyFee))
        : defaultFee;

    const cleanParentPhone = String(rawRow.parentPhone || "").trim();
    const cleanStudentPhone = String(rawRow.studentPhone || "").trim();
    const cleanNotes = String(rawRow.notes || "").trim();
    const requestedCode = String(rawRow.code || "").trim().toUpperCase();

    const dupKey = `${targetGroup.id}::${normalizeNameForMatch(cleanName)}`;
    const existingIdx =
      (requestedCode && existingByCode.has(requestedCode)
        ? existingByCode.get(requestedCode)
        : undefined) ?? existingByGroupAndName.get(dupKey);

    if (existingIdx !== undefined && duplicateMode !== "allow") {
      if (duplicateMode === "skip") {
        skippedCount++;
        return;
      }
      if (duplicateMode === "update") {
        const current = store.students[existingIdx];
        store.students[existingIdx] = {
          ...current,
          name: cleanName,
          academicYear: resolvedYear,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          parentPhone: cleanParentPhone || current.parentPhone,
          studentPhone: cleanStudentPhone || current.studentPhone,
          monthlyFee: resolvedFee,
          notes: cleanNotes || current.notes,
          status: "active",
          leftAt: undefined,
          updatedAt: now,
        };
        updatedCount++;
        importedStudents.push(store.students[existingIdx]);
        return;
      }
    }

    // Assign guaranteed unique code
    let finalCode = "";
    if (requestedCode && requestedCode.length >= 3 && requestedCode.length <= 12 && !existingCodes.has(requestedCode)) {
      finalCode = requestedCode;
    } else {
      finalCode = generateUniqueStudentCode(existingCodes);
    }
    existingCodes.add(finalCode);

    const newStudent: Student = {
      id: `std-${now}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      code: finalCode,
      name: cleanName,
      academicYear: resolvedYear,
      groupId: targetGroup.id,
      groupName: targetGroup.name,
      parentPhone: cleanParentPhone,
      studentPhone: cleanStudentPhone,
      monthlyFee: resolvedFee,
      status: "active",
      notes: cleanNotes,
      createdAt: now + index,
      updatedAt: now + index,
    };

    const newIdx = store.students.push(newStudent) - 1;
    existingByGroupAndName.set(dupKey, newIdx);
    existingByCode.set(finalCode, newIdx);
    importedCount++;
    importedStudents.push(newStudent);
  });

  if (importedCount > 0 || updatedCount > 0) {
    saveManagementStore(store);
  }

  return {
    importedCount,
    updatedCount,
    skippedCount,
    errorsCount,
    totalProcessed: params.rows.length,
    importedStudents,
  };
}

export interface ExportRowItem {
  id: string;
  code: string;
  name: string;
  academicYear: string;
  groupId: string;
  groupName: string;
  teacher: string;
  subject: string;
  studentPhone: string;
  parentPhone: string;
  monthlyFee: number;
  status: "active" | "inactive";
  statusArabic: string;
  month: string;
  paymentStatus: "paid" | "partial" | "unpaid" | "returned";
  paymentStatusArabic: string;
  paidAmount: number;
  remainingAmount: number;
  financialNotes: string;
  studentNotes: string;
  createdAtArabic: string;
}

export function getExportDataset(params: {
  academicYear?: string;
  groupId?: string;
  studentStatus?: "active" | "inactive" | "all";
  month?: string;
  paymentFilter?: "all" | "paid" | "unpaid" | "overdue";
}): {
  rows: ExportRowItem[];
  groups: Group[];
  academicYears: string[];
  month: string;
  summary: {
    totalStudents: number;
    totalExpectedFee: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
  };
} {
  const store = getManagementStore();
  const targetMonth = params.month || getLocalTodayDate().slice(0, 7);
  const groupMap = new Map<string, Group>();
  store.groups.forEach((g) => groupMap.set(g.id, g));

  // Financial lookup for targetMonth
  const finMap = new Map<string, FinancialRecord>();
  store.financials.forEach((f) => {
    if (f.month === targetMonth) {
      finMap.set(f.studentId, f);
    }
  });

  const yearsSet = new Set<string>();
  store.groups.forEach((g) => {
    if (g.academicYear) yearsSet.add(g.academicYear);
  });
  store.students.forEach((s) => {
    if (s.academicYear) yearsSet.add(s.academicYear);
  });

  let filteredStudents = store.students.map((s) => {
    const grp = groupMap.get(s.groupId);
    return {
      ...s,
      groupName: grp?.name || s.groupName || "غير محدد",
      academicYear: s.academicYear || grp?.academicYear || "غير محدد",
      teacher: grp?.teacher || "",
      subject: grp?.subject || "",
    };
  });

  // 1. Filter by Student Status
  const statusFilter = params.studentStatus || "active";
  if (statusFilter === "active") {
    filteredStudents = filteredStudents.filter((s) => s.status === "active");
  } else if (statusFilter === "inactive") {
    filteredStudents = filteredStudents.filter((s) => s.status === "inactive");
  }

  // 2. Filter by Academic Year
  if (params.academicYear && params.academicYear !== "ALL") {
    filteredStudents = filteredStudents.filter((s) => s.academicYear === params.academicYear);
  }

  // 3. Filter by Group ID
  if (params.groupId && params.groupId !== "ALL") {
    filteredStudents = filteredStudents.filter((s) => s.groupId === params.groupId);
  }

  // Build enriched rows
  let rows: ExportRowItem[] = filteredStudents.map((s) => {
    const fin = finMap.get(s.id);
    const fee = Number(s.monthlyFee) || 0;
    let paid = 0;
    let paymentStatus: "paid" | "partial" | "unpaid" | "returned" = "unpaid";
    let paymentStatusArabic = "غير مسدد (متأخر)";

    if (fin) {
      if (fin.status === "returned") {
        paymentStatus = "returned";
        paymentStatusArabic = "مسترد / ملغي";
        paid = 0;
      } else if (fin.status === "paid" || (fin.paidAmount && fin.paidAmount > 0)) {
        paid = Number(fin.paidAmount) || 0;
        if (paid >= fee && fee > 0) {
          paymentStatus = "paid";
          paymentStatusArabic = "مسدد بالكامل";
        } else if (paid > 0) {
          paymentStatus = "partial";
          paymentStatusArabic = "سداد جزئي";
        }
      }
    }

    const remaining = paymentStatus === "returned" ? 0 : Math.max(0, fee - paid);

    let createdAtArabic = "";
    try {
      createdAtArabic = new Date(s.createdAt).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      createdAtArabic = "";
    }

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      academicYear: s.academicYear,
      groupId: s.groupId,
      groupName: s.groupName,
      teacher: s.teacher,
      subject: s.subject,
      studentPhone: s.studentPhone || "",
      parentPhone: s.parentPhone || "",
      monthlyFee: fee,
      status: s.status,
      statusArabic: s.status === "active" ? "نشط" : "منقطع / غير نشط",
      month: targetMonth,
      paymentStatus,
      paymentStatusArabic,
      paidAmount: paid,
      remainingAmount: remaining,
      financialNotes: fin?.notes || "",
      studentNotes: s.notes || "",
      createdAtArabic,
    };
  });

  // 4. Filter by Payment Status if requested
  if (params.paymentFilter === "paid") {
    rows = rows.filter((r) => r.paymentStatus === "paid");
  } else if (params.paymentFilter === "unpaid") {
    rows = rows.filter((r) => r.paymentStatus === "unpaid");
  } else if (params.paymentFilter === "overdue") {
    rows = rows.filter((r) => r.paymentStatus === "unpaid" || r.paymentStatus === "partial");
  }

  const totalExpectedFee = rows.reduce((sum, r) => sum + r.monthlyFee, 0);
  const totalPaidAmount = rows.reduce((sum, r) => sum + r.paidAmount, 0);
  const totalRemainingAmount = rows.reduce((sum, r) => sum + r.remainingAmount, 0);

  return {
    rows,
    groups: store.groups.sort((a, b) => b.createdAt - a.createdAt),
    academicYears: Array.from(yearsSet),
    month: targetMonth,
    summary: {
      totalStudents: rows.length,
      totalExpectedFee,
      totalPaidAmount,
      totalRemainingAmount,
    },
  };
}
