// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Store SQLite database in user's home directory outside project root so Turbopack
// dev file watcher does NOT recompile and cause an infinite Fast Refresh reload loop.
const dataDir = path.join(os.homedir(), ".exam_builder");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "exam_builder.db");

// Migrate existing database from old data/ directory if present
const oldDbPath = path.join(process.cwd(), "data", "exam_builder.db");
if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
  } catch (err) {
    console.error("Migration error:", err);
  }
}

const globalForDb = globalThis as unknown as {
  __exam_builder_db__?: any;
};

export function getDb() {
  if (!globalForDb.__exam_builder_db__) {
    const db = new DatabaseSync(dbPath);
    try {
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA busy_timeout = 5000;");
      initSchema(db);
    } catch (e) {
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
  } catch (err) {
    // Ignore seed race conditions
  }
}

// ==========================================
// DB Helper Exports
// ==========================================

export function getLocalExams() {
  const db = getDb();
  return db.prepare("SELECT * FROM exams ORDER BY created_at DESC").all();
}

export function getLocalExamById(id: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM exams WHERE id = ?").get(id);
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
}) {
  const db = getDb();
  const existing = getLocalExamById(exam.id);
  if (existing) {
    const stmt = db.prepare(`
      UPDATE exams 
      SET title = ?, paper_title = ?, exam_code = ?, subject = ?, grade = ?, duration = ?, questions = ?, questions_count = ?, total_points = ?, date_created = ?
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
      exam.id
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO exams (id, title, paper_title, exam_code, subject, grade, duration, questions, questions_count, total_points, date_created, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      Date.now()
    );
  }
}

export function deleteLocalExam(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM exams WHERE id = ?").run(id);
}

export function getLocalUploadedFiles() {
  const db = getDb();
  return db.prepare("SELECT * FROM uploaded_files ORDER BY created_at DESC").all();
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
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO uploaded_files (id, name, type, size, date, filepath, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(file.id, file.name, file.type, file.size, file.date, file.filepath || "", Date.now());
}

export function deleteLocalUploadedFile(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM uploaded_files WHERE id = ?").run(id);
}
