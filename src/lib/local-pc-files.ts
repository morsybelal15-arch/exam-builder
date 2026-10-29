"use client";

/**
 * Local PC File Storage (IndexedDB on the Tenant's Browser / PC)
 *
 * Keeps PDFs, Word documents, and images 100% locally on the tenant's computer
 * so heavy files never upload to or burden the VPS server.
 * Only created exams, QR sheets, and Excel sheets are stored online on the server.
 */

export interface LocalPcFileItem {
  id: string;
  name: string;
  type: "pdf" | "word" | "image";
  mimeType: string;
  size: string;
  sizeBytes: number;
  date: string;
  createdAt: number;
}

export interface LocalPcFileRecord extends LocalPcFileItem {
  blob: Blob;
}

const DB_NAME = "exam_builder_local_pc_files_v1";
const STORE_NAME = "pc_files";
const DB_VERSION = 1;

function openLocalPcDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_name", "name", { unique: false });
        store.createIndex("by_created", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

export function detectFileCategory(fileName: string, mimeType?: string): "pdf" | "word" | "image" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "word";
  if (mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(lower)) {
    return "image";
  }
  return "pdf";
}

export function formatLocalFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} ميجابايت`;
  }
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} كيلوبايت`;
}

export function formatLocalArabicDate(date = new Date()): string {
  try {
    return date.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "اليوم";
  }
}

/**
 * Saves or updates a file locally on the tenant's PC (IndexedDB) without uploading to the server.
 */
export async function saveFileToLocalPc(
  file: File | Blob,
  customName?: string
): Promise<LocalPcFileItem> {
  const db = await openLocalPcDb();
  const fileName = (customName || (file as File).name || "مستند_محلي.pdf").trim();
  const mimeType = file.type || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  const fileCategory = detectFileCategory(fileName, mimeType);
  const now = Date.now();

  // Check if a file with the same name already exists so we can replace it cleanly
  const existing = await getLocalPcFileByName(fileName).catch(() => null);
  const id = existing?.id || `local-pc-${now}-${Math.random().toString(36).substring(2, 7)}`;

  const record: LocalPcFileRecord = {
    id,
    name: fileName,
    type: fileCategory,
    mimeType,
    size: formatLocalFileSize(file.size),
    sizeBytes: file.size,
    date: formatLocalArabicDate(new Date(now)),
    createdAt: now,
    blob: file,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => {
      const { blob: _blob, ...meta } = record;
      resolve(meta);
    };
    req.onerror = () => reject(req.error || new Error("Failed to store file on PC"));
  });
}

/**
 * Lists all files stored on the tenant's PC (newest first), excluding heavy Blob payloads.
 */
export async function getLocalPcFilesList(): Promise<LocalPcFileItem[]> {
  try {
    const db = await openLocalPcDb();
    return await new Promise<LocalPcFileItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result || []) as LocalPcFileRecord[];
        const items: LocalPcFileItem[] = all
          .map(({ blob: _b, ...meta }) => meta)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Retrieves a specific local PC file record (with its Blob) by ID.
 */
export async function getLocalPcFileById(id: string): Promise<LocalPcFileRecord | null> {
  try {
    const db = await openLocalPcDb();
    return await new Promise<LocalPcFileRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as LocalPcFileRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves a specific local PC file record (with its Blob) by file name.
 */
export async function getLocalPcFileByName(name: string): Promise<LocalPcFileRecord | null> {
  try {
    const target = name.trim().toLowerCase();
    const db = await openLocalPcDb();
    return await new Promise<LocalPcFileRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result || []) as LocalPcFileRecord[];
        const match =
          all.find((r) => r.name.trim().toLowerCase() === target) || null;
        resolve(match);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Deletes a file from the tenant's local PC store by ID.
 */
export async function deleteLocalPcFile(id: string): Promise<void> {
  try {
    const db = await openLocalPcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete local PC file:", err);
  }
}

/**
 * Clears all files from the tenant's local PC store (used during Factory Reset).
 */
export async function clearAllLocalPcFiles(): Promise<void> {
  try {
    const db = await openLocalPcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to clear local PC files:", err);
  }
}

/**
 * Triggers an immediate browser download of a Blob/File to the tenant's PC.
 */
export function triggerImmediatePcDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, 5000);
}

