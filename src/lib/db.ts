import path from "node:path";
import fs from "node:fs";
import os from "node:os";

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

export function getUploadsDir() {
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
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size TEXT NOT NULL,
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
    const examsCount = db.prepare("SELECT count(*) as count FROM exams").get() as { count: number };
    if (examsCount && examsCount.count === 0) {
      const insertExam = db.prepare(`
        INSERT INTO exams (id, title, subject, grade, duration, questions, questions_count, total_points, date_created, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertExam.run(
        "exam-1",
        "اختبار العلوم والبيئة - الدور الأول",
        "العلوم والبيئة",
        "الصف الثالث الثانوي",
        "ساعتان",
        JSON.stringify([
          {
            id: "q-seed-1",
            type: "choice",
            text: "أي من الخيارات التالية يُعد الوحدة الأساسية لبناء الكائنات الحية وتكاثرها؟",
            options: ["الخلية", "النسيج", "العضو", "الجهاز الحيوي"],
            correctOptionIndex: 0,
            points: 2,
          },
          {
            id: "q-seed-2",
            type: "trueFalse",
            text: "تتحرك الصفائح التكتونية في القشرة الأرضية بفعل تيارات الحمل الحراري في طبقة الوشاح.",
            options: ["صح", "خطأ"],
            correctOptionIndex: 0,
            points: 1,
          },
        ]),
        2,
        3,
        "١٠ أكتوبر ٢٠٢٦",
        Date.now()
      );
    }

    const filesCount = db.prepare("SELECT count(*) as count FROM uploaded_files").get() as { count: number };
    if (filesCount && filesCount.count === 0) {
      const insertFile = db.prepare(`
        INSERT INTO uploaded_files (id, name, type, size, date, filepath, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertFile.run(
        "f-1",
        "كتاب الأحياء والبيئة - الفصل الثالث.pdf",
        "pdf",
        "١٤.٢ ميجابايت",
        "١٠ أكتوبر ٢٠٢٦",
        "/sample-textbook.svg",
        Date.now()
      );
    }
  } catch {
    // Ignore seed race conditions
  }
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

  // Initial seed
  const initial: JsonStore = {
    exams: [
      {
        id: "exam-1",
        title: "اختبار العلوم والبيئة - الدور الأول",
        paper_title: "اختبار العلوم والبيئة - الدور الأول",
        exam_code: "X7K2",
        subject: "العلوم والبيئة",
        grade: "الصف الثالث الثانوي",
        duration: "ساعتان",
        questions: JSON.stringify([
          {
            id: "q-seed-1",
            type: "choice",
            text: "أي من الخيارات التالية يُعد الوحدة الأساسية لبناء الكائنات الحية وتكاثرها؟",
            options: ["الخلية", "النسيج", "العضو", "الجهاز الحيوي"],
            correctOptionIndex: 0,
            points: 2,
          },
          {
            id: "q-seed-2",
            type: "trueFalse",
            text: "تتحرك الصفائح التكتونية في القشرة الأرضية بفعل تيارات الحمل الحراري في طبقة الوشاح.",
            options: ["صح", "خطأ"],
            correctOptionIndex: 0,
            points: 1,
          },
        ]),
        questions_count: 2,
        total_points: 3,
        date_created: "١٠ أكتوبر ٢٠٢٦",
        created_at: Date.now(),
      },
    ],
    uploaded_files: [
      {
        id: "f-1",
        name: "كتاب الأحياء والبيئة - الفصل الثالث.pdf",
        type: "pdf",
        size: "١٤.٢ ميجابايت",
        date: "١٠ أكتوبر ٢٠٢٦",
        filepath: "/sample-textbook.svg",
        created_at: Date.now(),
      },
    ],
  };

  saveJsonStore(initial);
  return initial;
}

function saveJsonStore(store: JsonStore) {
  try {
    fs.writeFileSync(jsonStorePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving json store:", err);
  }
}

// ==========================================
// DB Helper Exports (Cross-Compatible)
// ==========================================

export function getLocalExams() {
  const db = getDb();
  if (db) {
    return db.prepare("SELECT * FROM exams ORDER BY created_at DESC").all();
  }
  const store = getJsonStore();
  return store.exams.sort((a, b) => b.created_at - a.created_at);
}

export function getLocalExamById(id: string) {
  const db = getDb();
  if (db) {
    return db.prepare("SELECT * FROM exams WHERE id = ?").get(id);
  }
  const store = getJsonStore();
  return store.exams.find((e) => e.id === id) || null;
}

export function saveLocalExam(exam: {
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
}) {
  const db = getDb();
  if (db) {
    const existing = getLocalExamById(exam.id);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE exams 
        SET title = ?, paper_title = ?, exam_code = ?, subject = ?, grade = ?, duration = ?, questions = ?, questions_count = ?, total_points = ?, date_created = ?, models = ?
        WHERE id = ?
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
        exam.id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO exams (id, title, paper_title, exam_code, subject, grade, duration, questions, questions_count, total_points, date_created, models, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        exam.id,
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
        Date.now()
      );
    }
    return;
  }

  // Fallback
  const store = getJsonStore();
  const index = store.exams.findIndex((e) => e.id === exam.id);
  const record = {
    ...exam,
    paper_title: exam.paper_title || exam.title,
    exam_code: exam.exam_code || "X7K2",
    duration: exam.duration || "ساعتان",
    models: exam.models || null,
    created_at: index >= 0 ? store.exams[index].created_at : Date.now(),
  };

  if (index >= 0) {
    store.exams[index] = record;
  } else {
    store.exams.push(record);
  }
  saveJsonStore(store);
}

export function deleteLocalExam(id: string) {
  const db = getDb();
  if (db) {
    db.prepare("DELETE FROM exams WHERE id = ?").run(id);
    return;
  }
  const store = getJsonStore();
  store.exams = store.exams.filter((e) => e.id !== id);
  saveJsonStore(store);
}

export function getLocalUploadedFiles() {
  const db = getDb();
  if (db) {
    return db.prepare("SELECT * FROM uploaded_files ORDER BY created_at DESC").all();
  }
  const store = getJsonStore();
  return store.uploaded_files.sort((a, b) => b.created_at - a.created_at);
}

export function addLocalUploadedFile(file: {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  filepath?: string;
}) {
  const db = getDb();
  if (db) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO uploaded_files (id, name, type, size, date, filepath, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(file.id, file.name, file.type, file.size, file.date, file.filepath || "", Date.now());
    return;
  }
  const store = getJsonStore();
  const index = store.uploaded_files.findIndex((f) => f.id === file.id);
  const record = {
    ...file,
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

export function deleteLocalUploadedFile(id: string) {
  const db = getDb();
  if (db) {
    db.prepare("DELETE FROM uploaded_files WHERE id = ?").run(id);
    return;
  }
  const store = getJsonStore();
  store.uploaded_files = store.uploaded_files.filter((f) => f.id !== id);
  saveJsonStore(store);
}
