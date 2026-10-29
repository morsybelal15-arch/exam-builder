import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { sanitizeTenantKey } from "@/lib/tenant-context";

// Store data in user's home directory outside project root so Turbopack
// dev file watcher does NOT recompile and cause an infinite Fast Refresh reload loop.
const dataDir = path.join(os.homedir(), ".exam_builder");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "exam_builder.db");
const jsonStorePath = path.join(dataDir, "exam_builder_store.json");
const uploadsDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function getUploadsDir(tenantId?: string) {
  const key = sanitizeTenantKey(tenantId);
  if (key && key !== "default") {
    const tenantDir = path.join(uploadsDir, key);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    return tenantDir;
  }
  return uploadsDir;
}

// Dynamically check if node:sqlite is supported on this Node runtime (Node 22+)
let DatabaseSyncClass: any = null;
try {
  // @ts-ignore
  const sqlite = require("node:sqlite");
  if (sqlite && sqlite.DatabaseSync) {
    DatabaseSyncClass = sqlite.DatabaseSync;
  }
} catch {
  // node:sqlite is not available (Node < 22). Will use JSON fallback store.
}

const globalForDb = globalThis as unknown as {
  __exam_builder_db__?: any;
};

// ==========================================
// SQLite Implementation (When Node >= 22)
// ==========================================

export function getDb() {
  if (!DatabaseSyncClass) return null;

  if (!globalForDb.__exam_builder_db__) {
    const db = new DatabaseSyncClass(dbPath);
    try {
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA busy_timeout = 5000;");
      initSchema(db);
    } catch {
      // Table or mode might already be initialized
    }
    globalForDb.__exam_builder_db__ = db;
  }
  return globalForDb.__exam_builder_db__;
}

function initSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      title TEXT NOT NULL,
      paper_title TEXT,
      exam_code TEXT,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      duration TEXT,
      questions TEXT NOT NULL,
      questions_count INTEGER DEFAULT 0,
      total_points INTEGER DEFAULT 0,
      date_created TEXT NOT NULL,
      models TEXT,
      extra_data TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      filepath TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images_to_pdf_queue (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      preview_url TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE exams ADD COLUMN paper_title TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE exams ADD COLUMN exam_code TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE exams ADD COLUMN models TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE exams ADD COLUMN tenant_id TEXT DEFAULT 'default';");
  } catch {}
  try {
    db.exec("ALTER TABLE exams ADD COLUMN extra_data TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE uploaded_files ADD COLUMN tenant_id TEXT DEFAULT 'default';");
  } catch {}
  try {
    db.exec("ALTER TABLE uploaded_files ADD COLUMN size_bytes INTEGER DEFAULT 0;");
  } catch {}

  try {
    // Clean up any legacy demo seed rows so new and reset tenants remain 100% empty
    db.exec(
      "DELETE FROM exams WHERE id = 'exam-1' AND title = 'اختبار العلوم والبيئة - الدور الأول';"
    );
    db.exec("DELETE FROM uploaded_files WHERE id = 'f-1' AND filepath = '/sample-textbook.svg';");
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * No-op: each tenant keeps a strictly isolated partition in `exams` and `uploaded_files`.
 */
function ensureLegacyTenantClaimed(_db: any, _tenantKey: string) {
  // Intentionally empty — prevents new tenants from inheriting default demo rows.
}

// ==========================================
// JSON File Store Fallback (When Node < 22)
// ==========================================

interface JsonStore {
  exams: any[];
  uploaded_files: any[];
}

function getJsonStore(): JsonStore {
  try {
    if (fs.existsSync(jsonStorePath)) {
      const data = fs.readFileSync(jsonStorePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading json store:", err);
  }

  const initial: JsonStore = {
    exams: [],
    uploaded_files: [],
  };

  saveJsonStore(initial);
  return initial;
}

function saveJsonStore(store: JsonStore) {
  try {
    const tmpPath = `${jsonStorePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmpPath, jsonStorePath);
  } catch (err) {
    console.error("Error saving json store:", err);
  }
}

// ==========================================
// DB Helper Exports (Cross-Compatible)
// ==========================================

export function getLocalExams(tenantId?: string) {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    return db
      .prepare("SELECT * FROM exams WHERE tenant_id = ? ORDER BY created_at DESC")
      .all(tenantKey);
  }
  const store = getJsonStore();
  return store.exams
    .filter((e) => (e.tenant_id || "default") === tenantKey)
    .sort((a, b) => b.created_at - a.created_at);
}

export function getLocalExamById(id: string, tenantId?: string) {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    return db.prepare("SELECT * FROM exams WHERE id = ? AND tenant_id = ?").get(id, tenantKey);
  }
  const store = getJsonStore();
  return store.exams.find((e) => e.id === id && (e.tenant_id || "default") === tenantKey) || null;
}

export function saveLocalExam(
  exam: {
    id: string;
    title: string;
    paper_title?: string;
    exam_code?: string;
    subject: string;
    grade: string;
    duration?: string;
    questions: string;
    questions_count: number;
    total_points: number;
    date_created: string;
    models?: string;
    extra_data?: string;
  },
  tenantId?: string
) {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    const existing = getLocalExamById(exam.id, tenantKey);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE exams 
        SET title = ?, paper_title = ?, exam_code = ?, subject = ?, grade = ?, duration = ?, questions = ?, questions_count = ?, total_points = ?, date_created = ?, models = ?, extra_data = ?
        WHERE id = ? AND tenant_id = ?
      `);
      stmt.run(
        exam.title,
        exam.paper_title || exam.title,
        exam.exam_code || "X7K2",
        exam.subject,
        exam.grade,
        exam.duration || "ساعتان",
        exam.questions,
        exam.questions_count,
        exam.total_points,
        exam.date_created,
        exam.models || null,
        exam.extra_data || null,
        exam.id,
        tenantKey
      );
    } else {
      // Ensure ID is unique if another tenant already used the same ID
      const globalCollision = db.prepare("SELECT id FROM exams WHERE id = ?").get(exam.id);
      const finalId = globalCollision ? `${exam.id}-${tenantKey}` : exam.id;
      const stmt = db.prepare(`
        INSERT INTO exams (id, tenant_id, title, paper_title, exam_code, subject, grade, duration, questions, questions_count, total_points, date_created, models, extra_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        finalId,
        tenantKey,
        exam.title,
        exam.paper_title || exam.title,
        exam.exam_code || "X7K2",
        exam.subject,
        exam.grade,
        exam.duration || "ساعتان",
        exam.questions,
        exam.questions_count,
        exam.total_points,
        exam.date_created,
        exam.models || null,
        exam.extra_data || null,
        Date.now()
      );
    }
    return;
  }

  // Fallback
  const store = getJsonStore();
  const index = store.exams.findIndex(
    (e) => e.id === exam.id && (e.tenant_id || "default") === tenantKey
  );
  const record = {
    ...exam,
    tenant_id: tenantKey,
    paper_title: exam.paper_title || exam.title,
    exam_code: exam.exam_code || "X7K2",
    duration: exam.duration || "ساعتان",
    models: exam.models || null,
    extra_data: exam.extra_data || null,
    created_at: index >= 0 ? store.exams[index].created_at : Date.now(),
  };

  if (index >= 0) {
    store.exams[index] = record;
  } else {
    store.exams.push(record);
  }
  saveJsonStore(store);
}

export function deleteLocalExam(id: string, tenantId?: string) {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    db.prepare("DELETE FROM exams WHERE id = ? AND tenant_id = ?").run(id, tenantKey);
    return;
  }
  const store = getJsonStore();
  store.exams = store.exams.filter(
    (e) => !(e.id === id && (e.tenant_id || "default") === tenantKey)
  );
  saveJsonStore(store);
}

export function getLocalUploadedFiles(tenantId?: string) {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    return db
      .prepare("SELECT * FROM uploaded_files WHERE tenant_id = ? ORDER BY created_at DESC")
      .all(tenantKey);
  }
  const store = getJsonStore();
  return store.uploaded_files
    .filter((f) => (f.tenant_id || "default") === tenantKey)
    .sort((a, b) => b.created_at - a.created_at);
}

export function getLocalUploadedFileById(id: string, tenantId?: string): any | null {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    return db
      .prepare("SELECT * FROM uploaded_files WHERE id = ? AND tenant_id = ?")
      .get(id, tenantKey) || null;
  }
  const store = getJsonStore();
  return (
    store.uploaded_files.find(
      (f) => f.id === id && (f.tenant_id || "default") === tenantKey
    ) || null
  );
}

export function addLocalUploadedFile(
  file: {
    id: string;
    name: string;
    type: string;
    size: string;
    size_bytes?: number;
    date: string;
    filepath?: string;
  },
  tenantId?: string
) {
  const tenantKey = sanitizeTenantKey(tenantId);
  const db = getDb();
  if (db) {
    ensureLegacyTenantClaimed(db, tenantKey);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO uploaded_files (id, tenant_id, name, type, size, size_bytes, date, filepath, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      file.id,
      tenantKey,
      file.name,
      file.type,
      file.size,
      file.size_bytes || 0,
      file.date,
      file.filepath || "",
      Date.now()
    );
    return;
  }
  const store = getJsonStore();
  const index = store.uploaded_files.findIndex(
    (f) => f.id === file.id && (f.tenant_id || "default") === tenantKey
  );
  const record = {
    ...file,
    tenant_id: tenantKey,
    size_bytes: file.size_bytes || 0,
    filepath: file.filepath || "",
    created_at: index >= 0 ? store.uploaded_files[index].created_at : Date.now(),
  };
  if (index >= 0) {
    store.uploaded_files[index] = record;
  } else {
    store.uploaded_files.push(record);
  }
  saveJsonStore(store);
}

export function deleteLocalUploadedFile(id: string, tenantId?: string): any | null {
  const tenantKey = sanitizeTenantKey(tenantId);
  const existing = getLocalUploadedFileById(id, tenantKey);
  const db = getDb();
  if (db) {
    db.prepare("DELETE FROM uploaded_files WHERE id = ? AND tenant_id = ?").run(id, tenantKey);
    return existing;
  }
  const store = getJsonStore();
  store.uploaded_files = store.uploaded_files.filter(
    (f) => !(f.id === id && (f.tenant_id || "default") === tenantKey)
  );
  saveJsonStore(store);
  return existing;
}

function computeManagementStoreBytes(tenantKey: string): number {
  try {
    const storeFile =
      !tenantKey || tenantKey === "default"
        ? path.join(dataDir, "management_store.json")
        : path.join(dataDir, "tenants", tenantKey, "management_store.json");
    if (!fs.existsSync(storeFile)) return 0;

    const raw = fs.readFileSync(storeFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return 0;

    let totalBytes = 0;
    const keys = [
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
      const arr = parsed[k];
      if (Array.isArray(arr) && arr.length > 0) {
        totalBytes += Buffer.byteLength(JSON.stringify(arr), "utf8");
      }
    }
    return totalBytes;
  } catch {
    return 0;
  }
}

/**
 * Computes real exam count, uploaded file count, and actual storage bytes used by a tenant
 * (including created exams in KB, management records/QR/Excel data in KB, and server files).
 */
export function getTenantUsageStats(tenantId: string): {
  examsCount: number;
  filesCount: number;
  usedStorageBytes: number;
} {
  const tenantKey = sanitizeTenantKey(tenantId);
  try {
    const managementBytes = computeManagementStoreBytes(tenantKey);
    const db = getDb();
    if (db) {
      ensureLegacyTenantClaimed(db, tenantKey);
      const examRows = db
        .prepare("SELECT * FROM exams WHERE tenant_id = ?")
        .all(tenantKey) as any[];
      const examsBytes = examRows.reduce(
        (sum, row) => sum + Buffer.byteLength(JSON.stringify(row), "utf8"),
        0
      );

      const filesRow = db
        .prepare(
          "SELECT count(*) as count, COALESCE(SUM(size_bytes), 0) as bytes FROM uploaded_files WHERE tenant_id = ?"
        )
        .get(tenantKey) as { count: number; bytes: number } | undefined;

      const filesBytes = Number(filesRow?.bytes || 0);

      return {
        examsCount: examRows.length,
        filesCount: Number(filesRow?.count || 0),
        usedStorageBytes: examsBytes + filesBytes + managementBytes,
      };
    }

    const store = getJsonStore();
    const exams = store.exams.filter((e) => (e.tenant_id || "default") === tenantKey);
    const examsBytes = exams.reduce(
      (sum, row) => sum + Buffer.byteLength(JSON.stringify(row), "utf8"),
      0
    );
    const files = store.uploaded_files.filter((f) => (f.tenant_id || "default") === tenantKey);
    const filesBytes = files.reduce((sum, f) => sum + Number(f.size_bytes || 0), 0);
    return {
      examsCount: exams.length,
      filesCount: files.length,
      usedStorageBytes: examsBytes + filesBytes + managementBytes,
    };
  } catch {
    return { examsCount: 0, filesCount: 0, usedStorageBytes: 0 };
  }
}

/**
 * Permanently removes all exams, uploaded file metadata, and upload directory for a deleted tenant.
 */
export function purgeTenantLocalDb(tenantId: string): void {
  const tenantKey = sanitizeTenantKey(tenantId);
  if (!tenantKey || tenantKey === "default") return;

  try {
    const db = getDb();
    if (db) {
      db.prepare("DELETE FROM exams WHERE tenant_id = ?").run(tenantKey);
      db.prepare("DELETE FROM uploaded_files WHERE tenant_id = ?").run(tenantKey);
    } else {
      const store = getJsonStore();
      store.exams = store.exams.filter((e) => (e.tenant_id || "default") !== tenantKey);
      store.uploaded_files = store.uploaded_files.filter(
        (f) => (f.tenant_id || "default") !== tenantKey
      );
      saveJsonStore(store);
    }
  } catch (err) {
    console.warn("Error purging tenant SQLite/JSON rows:", err);
  }

  try {
    const tenantUploadFolder = path.join(uploadsDir, tenantKey);
    if (fs.existsSync(tenantUploadFolder)) {
      fs.rmSync(tenantUploadFolder, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("Error removing tenant uploads folder:", err);
  }
}
