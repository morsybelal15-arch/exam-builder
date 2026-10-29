/**
 * Foolproof Excel (.xlsx / .xls / .csv / .tsv) Engine
 * - Generates genuine native OpenXML (.xlsx) workbooks with RTL layout, styled headers,
 *   auto-fitted column widths, and explicit text cells so leading zeros in phone numbers (010...) are never lost.
 * - Parses .xlsx (ZIP + XML with cell-coordinate awareness), .xls (HTML/XML), .csv, and .tsv
 *   across UTF-8, UTF-16LE, and Windows-1256 Arabic encodings.
 * - Sanitizes human input errors: stripped leading zeros, scientific notation phones,
 *   Arabic-Indic numerals (٠-٩), messy currency strings, shorthand academic years, and duplicate rows.
 */

export const CANONICAL_ACADEMIC_YEARS = [
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي",
  "الصف الثالث الإعدادي",
  "الصف الثاني الإعدادي",
  "الصف الأول الإعدادي",
  "المرحلة الابتدائية",
  "جامعي / عام",
] as const;

// ============================================================================
// 1. HUMAN INPUT SANITIZERS & NORMALIZERS
// ============================================================================

/**
 * Converts Eastern Arabic (٠-٩) and Persian (۰-۹) digits to standard ASCII (0-9).
 */
export function toEnglishDigits(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Removes invisible RTL/LTR markers, zero-width spaces, and collapses whitespace.
 */
export function cleanInvisibleAndSpaces(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes Arabic text for fuzzy matching (headers, duplicate student names, group names).
 */
export function normalizeArabicKey(input: unknown): string {
  return toEnglishDigits(cleanInvisibleAndSpaces(input))
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0640]/g, "") // strip tashkeel & tatweel
    .replace(/[^a-z0-9\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IGNORED_ROW_NAMES = new Set([
  "الاسم",
  "اسم الطالب",
  "اسم الطالبه",
  "الطالب",
  "الاجمالي",
  "المجموع",
  "اجمالي",
  "مجموع",
  "عدد الطلاب",
  "ملاحظات",
  "مسلسل",
  "م",
  "name",
  "student name",
  "total",
]);

/**
 * Cleans and validates a student's name, stripping accidental leading row numbers like "1- أحمد".
 */
export function sanitizeStudentName(raw: unknown): {
  name: string;
  isValid: boolean;
  isHeaderOrSummary: boolean;
  error?: string;
} {
  let cleaned = cleanInvisibleAndSpaces(raw);
  if (!cleaned) {
    return { name: "", isValid: false, isHeaderOrSummary: false, error: "اسم الطالب فارغ" };
  }

  // Strip leading serial numbering e.g. "1 - أحمد مصطفى" or "١٢) سارة محمود"
  cleaned = toEnglishDigits(cleaned)
    .replace(/^\d+\s*[-.)/\\:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  const norm = normalizeArabicKey(cleaned);
  if (!norm || IGNORED_ROW_NAMES.has(norm)) {
    return { name: cleaned, isValid: false, isHeaderOrSummary: true, error: "صف عنوان أو إجمالي" };
  }

  // Must contain at least 2 letters (Arabic or English), not just numbers/symbols
  const lettersMatch = cleaned.match(/[a-zA-Z\u0621-\u064A]/g);
  if (!lettersMatch || lettersMatch.length < 2) {
    return {
      name: cleaned,
      isValid: false,
      isHeaderOrSummary: false,
      error: "الاسم غير صالح (يحتوي على أرقام أو رموز فقط)",
    };
  }

  return { name: cleaned, isValid: true, isHeaderOrSummary: false };
}

/**
 * Normalizes Egyptian & international phone numbers, fixing Excel's stripped leading zero (1012345678 -> 01012345678),
 * scientific notation (1.01234E+9), Arabic numerals, and +20 / 0020 prefixes.
 */
export function sanitizePhoneNumber(raw: unknown): {
  phone: string;
  isValid: boolean;
  wasRepaired: boolean;
  warning?: string;
} {
  if (raw === null || raw === undefined) {
    return { phone: "", isValid: true, wasRepaired: false };
  }

  let str = cleanInvisibleAndSpaces(toEnglishDigits(raw));
  if (!str || str === "-" || str === "لا يوجد" || str.toLowerCase() === "none" || str.toLowerCase() === "n/a") {
    return { phone: "", isValid: true, wasRepaired: false };
  }

  let wasRepaired = false;

  // Handle Excel scientific notation e.g. "1.012345678E+9" or "2.01012345678E+11"
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num) && num > 0) {
      str = Math.round(num).toString();
      wasRepaired = true;
    }
  }

  // If multiple phones are written in one cell (e.g. "01012345678 / 01123456789"), take the first valid token
  const parts = str.split(/[\/\\|,،;]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    str = parts[0];
    wasRepaired = true;
  }

  // Strip spaces, dashes, dots, parentheses, plus signs, and Excel leading apostrophe
  let digits = str.replace(/^'+/, "").replace(/[^\d]/g, "");

  if (!digits) {
    return { phone: "", isValid: true, wasRepaired: false };
  }

  // Strip 0020 or 20 country code for Egyptian mobile numbers
  if (digits.startsWith("0020") && digits.length === 14) {
    digits = "0" + digits.slice(4);
    wasRepaired = true;
  } else if (digits.startsWith("20") && digits.length === 12 && /^201[0125]\d{8}$/.test(digits)) {
    digits = "0" + digits.slice(2);
    wasRepaired = true;
  } else if (digits.startsWith("002") && digits.length === 13 && /^0021[0125]\d{8}$/.test(digits)) {
    digits = "0" + digits.slice(3);
    wasRepaired = true;
  }

  // Fix Excel stripped leading zero: 10 digits starting with 10, 11, 12, or 15
  if (digits.length === 10 && /^1[0125]\d{8}$/.test(digits)) {
    digits = "0" + digits;
    wasRepaired = true;
  }

  // Validate Egyptian mobile (11 digits starting with 010, 011, 012, 015)
  if (/^01[0125]\d{8}$/.test(digits)) {
    return { phone: digits, isValid: true, wasRepaired };
  }

  // Allow landlines or international numbers (8–15 digits) with a gentle notice
  if (digits.length >= 8 && digits.length <= 15) {
    return {
      phone: digits,
      isValid: true,
      wasRepaired,
      warning: digits.length !== 11 ? `رقم غير قياسي (${digits.length} أرقام)` : undefined,
    };
  }

  return {
    phone: digits,
    isValid: false,
    wasRepaired,
    warning: `رقم قصير أو غير مكتمل (${digits})`,
  };
}

/**
 * Sanitizes monthly fee values ("300 ج.م", "٣٠٠", "مجاني", blank, etc.).
 */
export function sanitizeMonthlyFee(raw: unknown, defaultFee: number = 250): {
  fee: number;
  usedDefault: boolean;
} {
  const safeDefault = Number.isFinite(defaultFee) && defaultFee >= 0 ? Math.round(defaultFee) : 250;
  if (raw === null || raw === undefined) {
    return { fee: safeDefault, usedDefault: true };
  }

  const str = cleanInvisibleAndSpaces(toEnglishDigits(raw));
  if (!str) {
    return { fee: safeDefault, usedDefault: true };
  }

  const norm = normalizeArabicKey(str);
  if (
    norm.includes("مجان") ||
    norm.includes("اعفاء") ||
    norm.includes("معفي") ||
    norm === "free" ||
    str === "0"
  ) {
    return { fee: 0, usedDefault: false };
  }

  // Extract first number (supports decimals or comma thousands like 1,200)
  const cleanedNumStr = str.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!cleanedNumStr) {
    return { fee: safeDefault, usedDefault: true };
  }

  const parsed = Math.round(Math.abs(Number(cleanedNumStr[0])));
  if (!Number.isFinite(parsed) || parsed > 100000) {
    return { fee: safeDefault, usedDefault: true };
  }

  return { fee: parsed, usedDefault: false };
}

/**
 * Maps human shorthand for academic years (e.g. "اولى ثانوي", "3ث", "تالتة ثانوي")
 * to canonical app academic years.
 */
export function normalizeAcademicYear(raw: unknown, fallbackYear: string): string {
  const str = normalizeArabicKey(raw);
  if (!str) return fallbackYear;

  // Check exact match first
  for (const year of CANONICAL_ACADEMIC_YEARS) {
    if (normalizeArabicKey(year) === str) return year;
  }

  const isSecondary = str.includes("ثانوي") || str.includes("ث") || str.includes("sec");
  const isPrep = str.includes("اعدادي") || str.includes("ع") || str.includes("prep");

  const isFirst = str.includes("اول") || str.includes("1");
  const isSecond = str.includes("ثاني") || str.includes("تاني") || str.includes("2");
  const isThird = str.includes("ثالث") || str.includes("تالت") || str.includes("3");

  if (isSecondary) {
    if (isFirst) return "الصف الأول الثانوي";
    if (isSecond) return "الصف الثاني الثانوي";
    if (isThird) return "الصف الثالث الثانوي";
  }

  if (isPrep) {
    if (isFirst) return "الصف الأول الإعدادي";
    if (isSecond) return "الصف الثاني الإعدادي";
    if (isThird) return "الصف الثالث الإعدادي";
  }

  if (str.includes("ابتدائي") || str.includes("primary")) {
    return "المرحلة الابتدائية";
  }
  if (str.includes("جامع") || str.includes("كليه") || str.includes("عام")) {
    return "جامعي / عام";
  }

  return fallbackYear;
}

// ============================================================================
// 2. SMART COLUMN AUTO-MAPPER
// ============================================================================

export type ImportFieldKey =
  | "name"
  | "parentPhone"
  | "studentPhone"
  | "monthlyFee"
  | "academicYear"
  | "groupName"
  | "code"
  | "notes"
  | "ignore";

export interface ColumnMappingResult {
  headerRowIndex: number;
  headers: string[];
  mapping: Record<number, ImportFieldKey>;
}

const HEADER_PATTERNS: { field: ImportFieldKey; keywords: string[] }[] = [
  {
    field: "name",
    keywords: [
      "اسم الطالب",
      "الاسم الثلاثي",
      "الاسم الرباعي",
      "الاسم بالكامل",
      "الاسم",
      "الطالب",
      "اسم",
      "student name",
      "full name",
      "name",
    ],
  },
  {
    field: "parentPhone",
    keywords: [
      "رقم هاتف ولي الامر",
      "رقم ولي الامر",
      "هاتف ولي الامر",
      "تليفون ولي الامر",
      "موبايل ولي الامر",
      "ولي الامر",
      "واتساب ولي الامر",
      "رقم الاب",
      "رقم الام",
      "هاتف الاب",
      "واتساب",
      "parent phone",
      "guardian phone",
      "father phone",
      "whatsapp",
    ],
  },
  {
    field: "studentPhone",
    keywords: [
      "رقم هاتف الطالب",
      "رقم الطالب",
      "هاتف الطالب",
      "تليفون الطالب",
      "موبايل الطالب",
      "رقم التليفون",
      "رقم الهاتف",
      "رقم الموبايل",
      "التليفون",
      "الهاتف",
      "الموبايل",
      "student phone",
      "mobile",
      "phone",
    ],
  },
  {
    field: "monthlyFee",
    keywords: [
      "قيمه الاشتراك الشهري",
      "قيمه الاشتراك",
      "الاشتراك الشهري",
      "الاشتراك",
      "المبلغ الشهري",
      "المبلغ",
      "المصروفات",
      "الرسوم",
      "السعر",
      "التكلفه",
      "monthly fee",
      "fee",
      "amount",
      "price",
    ],
  },
  {
    field: "academicYear",
    keywords: [
      "السنه الدراسيه",
      "الصف الدراسي",
      "المرحله الدراسيه",
      "السنه",
      "الصف",
      "المرحله",
      "academic year",
      "grade",
      "year",
    ],
  },
  {
    field: "groupName",
    keywords: [
      "المجموعه الدراسيه",
      "اسم المجموعه",
      "المجموعه",
      "مجموعه",
      "السنتر",
      "الموعد",
      "group name",
      "group",
    ],
  },
  {
    field: "code",
    keywords: [
      "كود الطالب",
      "الكود",
      "رمز الطالب",
      "كود",
      "student code",
      "code",
      "id",
    ],
  },
  {
    field: "notes",
    keywords: ["ملاحظات اضافيه", "ملاحظات", "ملحوظه", "بيان", "notes", "note", "comment"],
  },
];

/**
 * Automatically detects the header row in a 2D sheet array and maps each column index to an ImportFieldKey.
 */
export function detectHeaderAndColumns(rows: string[][]): ColumnMappingResult {
  if (!rows || rows.length === 0) {
    return { headerRowIndex: 0, headers: [], mapping: {} };
  }

  let bestRowIdx = 0;
  let bestScore = -1;

  const maxScan = Math.min(rows.length, 15);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let score = 0;
    for (const cell of row) {
      const norm = normalizeArabicKey(cell);
      if (!norm) continue;
      for (const pat of HEADER_PATTERNS) {
        if (pat.keywords.some((kw) => norm === kw || norm.includes(kw))) {
          score += 2;
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = r;
    }
  }

  // If no header keywords matched at all, check if row 0 looks like data (e.g. contains an 11-digit phone)
  const hasRealHeader = bestScore >= 2;
  const headerRowIndex = hasRealHeader ? bestRowIdx : -1;
  const sampleWidth = Math.max(...rows.slice(0, 10).map((r) => r.length), 1);

  const headers: string[] = [];
  const mapping: Record<number, ImportFieldKey> = {};
  const usedFields = new Set<ImportFieldKey>();

  if (hasRealHeader) {
    const rawHeaderRow = rows[headerRowIndex] || [];
    for (let c = 0; c < sampleWidth; c++) {
      const label = cleanInvisibleAndSpaces(rawHeaderRow[c]) || `عمود ${c + 1}`;
      headers.push(label);
      const norm = normalizeArabicKey(label);

      // Ignore serial number column ("م", "مسلسل", "#")
      if (norm === "م" || norm === "مسلسل" || norm === "ت" || norm === "no" || norm === "num") {
        mapping[c] = "ignore";
        continue;
      }

      let matchedField: ImportFieldKey = "ignore";
      // Pass 1: exact keyword match
      for (const pat of HEADER_PATTERNS) {
        if (usedFields.has(pat.field)) continue;
        if (pat.keywords.some((kw) => norm === kw)) {
          matchedField = pat.field;
          break;
        }
      }
      // Pass 2: substring match
      if (matchedField === "ignore") {
        for (const pat of HEADER_PATTERNS) {
          if (usedFields.has(pat.field)) continue;
          if (pat.keywords.some((kw) => kw.length >= 3 && norm.includes(kw))) {
            matchedField = pat.field;
            break;
          }
        }
      }

      if (matchedField !== "ignore") {
        usedFields.add(matchedField);
      }
      mapping[c] = matchedField;
    }
  } else {
    // Heuristic column detection when user uploads a headerless sheet
    for (let c = 0; c < sampleWidth; c++) {
      headers.push(`عمود ${c + 1}`);
      mapping[c] = "ignore";
    }
  }

  // Fallback heuristics for unmapped columns by inspecting first 5 data rows
  const dataStart = headerRowIndex + 1;
  const sampleRows = rows.slice(dataStart, dataStart + 8).filter((r) => r && r.some((cell) => cleanInvisibleAndSpaces(cell)));

  if (!usedFields.has("name") && sampleRows.length > 0) {
    for (let c = 0; c < sampleWidth; c++) {
      if (mapping[c] !== "ignore") continue;
      const validNames = sampleRows.filter((r) => {
        const res = sanitizeStudentName(r[c]);
        return res.isValid && r[c] && r[c].trim().split(/\s+/).length >= 2;
      });
      if (validNames.length >= Math.ceil(sampleRows.length * 0.5)) {
        mapping[c] = "name";
        usedFields.add("name");
        break;
      }
    }
  }

  // Detect phone columns if not mapped by header
  if (sampleRows.length > 0) {
    for (let c = 0; c < sampleWidth; c++) {
      if (mapping[c] !== "ignore") continue;
      const phoneMatches = sampleRows.filter((r) => {
        const p = sanitizePhoneNumber(r[c]);
        return p.phone.length >= 10 && p.isValid;
      });
      if (phoneMatches.length >= Math.ceil(sampleRows.length * 0.4)) {
        if (!usedFields.has("parentPhone")) {
          mapping[c] = "parentPhone";
          usedFields.add("parentPhone");
        } else if (!usedFields.has("studentPhone")) {
          mapping[c] = "studentPhone";
          usedFields.add("studentPhone");
        }
      }
    }
  }

  return { headerRowIndex, headers, mapping };
}

// ============================================================================
// 3. NATIVE OPENXML (.XLSX) GENERATOR (Zero Dependencies, RTL, Styled, Auto-Fit)
// ============================================================================

export interface ExcelColumnSpec {
  header: string;
  key: string;
  width?: number;
  type?: "string" | "number";
}

function escapeXml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Strip invalid XML 1.0 control chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function colIndexToLetter(colIdx: number): string {
  let temp = colIdx + 1;
  let letter = "";
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

// Precomputed CRC32 table for ZIP archive creation
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipStoreArchive(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = file.data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // compression method: 0 (STORE)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5421, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // compression: STORE
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
}

/**
 * Generates a native Microsoft Excel (.xlsx) binary Uint8Array with RTL layout,
 * styled blue header bar, borders, auto-fitted columns, and preserved leading zeros.
 */
export function generateXlsxWorkbook(options: {
  sheetName?: string;
  columns: ExcelColumnSpec[];
  rows: Record<string, unknown>[];
}): Uint8Array {
  const sheetTitle = (options.sheetName || "بيانات السنتر").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
  const cols = options.columns;
  const rows = options.rows;

  // Calculate optimal width for each column
  const colWidths = cols.map((col) => {
    let maxLen = col.header.length + 5;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const val = String(rows[i][col.key] ?? "");
      if (val.length + 4 > maxLen) {
        maxLen = val.length + 4;
      }
    }
    return Math.min(48, Math.max(col.width || 16, maxLen));
  });

  const colsXml =
    "<cols>" +
    colWidths
      .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
      .join("") +
    "</cols>";

  // Build rows XML
  const sheetRowsXml: string[] = [];

  // Row 1: Styled Header Row (style s="1")
  const headerCells = cols
    .map((col, cIdx) => {
      const ref = `${colIndexToLetter(cIdx)}1`;
      return `<c r="${ref}" s="1" t="inlineStr"><is><t>${escapeXml(col.header)}</t></is></c>`;
    })
    .join("");
  sheetRowsXml.push(`<row r="1" ht="26" customHeight="1">${headerCells}</row>`);

  // Data Rows (style s="2" for text, s="3" for numbers)
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const rowNum = rIdx + 2;
    const rowObj = rows[rIdx];
    const cellsXml = cols
      .map((col, cIdx) => {
        const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
        const rawVal = rowObj[col.key];
        if (col.type === "number" && rawVal !== "" && rawVal !== null && rawVal !== undefined && Number.isFinite(Number(rawVal))) {
          return `<c r="${ref}" s="3" t="n"><v>${Number(rawVal)}</v></c>`;
        }
        const textVal = String(rawVal ?? "");
        return `<c r="${ref}" s="2" t="inlineStr"><is><t>${escapeXml(textVal)}</t></is></c>`;
      })
      .join("");
    sheetRowsXml.push(`<row r="${rowNum}" ht="21" customHeight="1">${cellsXml}</row>`);
  }

  const lastColLetter = colIndexToLetter(Math.max(0, cols.length - 1));
  const lastRowNum = rows.length + 1;

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastColLetter}${lastRowNum}"/>
  <sheetViews>
    <sheetView rightToLeft="1" tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  ${colsXml}
  <sheetData>
    ${sheetRowsXml.join("\n    ")}
  </sheetData>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Cairo"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Cairo"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1B64F2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" readingOrder="2" wrapText="1"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" readingOrder="2"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetTitle)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const enc = new TextEncoder();
  return buildZipStoreArchive([
    { name: "[Content_Types].xml", data: enc.encode(contentTypesXml) },
    { name: "_rels/.rels", data: enc.encode(rootRelsXml) },
    { name: "xl/workbook.xml", data: enc.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRelsXml) },
    { name: "xl/styles.xml", data: enc.encode(stylesXml) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(worksheetXml) },
  ]);
}

/**
 * Generates an Excel-friendly CSV string with UTF-8 BOM (\uFEFF) and formula-safe phone numbers.
 */
export function generateUtf8BomCsv(options: {
  columns: ExcelColumnSpec[];
  rows: Record<string, unknown>[];
}): string {
  const escapeCsvCell = (val: unknown, isPhoneOrCode: boolean): string => {
    const s = String(val ?? "").replace(/"/g, '""');
    // For phone numbers starting with 0, wrap as ="010..." or quote cleanly
    if (isPhoneOrCode && /^0\d+$/.test(s)) {
      return `"\t${s}"`;
    }
    return `"${s}"`;
  };

  const headerLine = options.columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const dataLines = options.rows.map((row) =>
    options.columns
      .map((col) => {
        const isPhoneOrCode = col.key.toLowerCase().includes("phone") || col.key === "code";
        return escapeCsvCell(row[col.key], isPhoneOrCode);
      })
      .join(",")
  );

  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

// ============================================================================
// 4. UNIVERSAL SHEET PARSER (.XLSX, .XLS, .CSV, .TSV)
// ============================================================================

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    // Decode Excel _x000D_ escaped carriage returns
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function colLettersToIndex(colLetters: string): number {
  let idx = 0;
  for (let i = 0; i < colLetters.length; i++) {
    const ch = colLetters.charCodeAt(i);
    if (ch >= 65 && ch <= 90) {
      idx = idx * 26 + (ch - 64);
    } else if (ch >= 97 && ch <= 122) {
      idx = idx * 26 + (ch - 96);
    }
  }
  return Math.max(0, idx - 1);
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  // Use Web Streams DecompressionStream("deflate-raw") available in all modern browsers and Node 18+
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compressed as unknown as BufferSource);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLen += value.length;
      }
    }
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
  throw new Error("DecompressionStream is not supported in this environment");
}

async function extractZipEntries(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  const entries = new Map<string, string>();

  // Locate End of Central Directory (EOCD) signature 0x06054b50 from the end
  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    let cdOffset = view.getUint32(eocdOffset + 16, true);

    for (let e = 0; e < totalEntries && cdOffset + 46 <= bytes.length; e++) {
      if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
      const compressionMethod = view.getUint16(cdOffset + 10, true);
      const compressedSize = view.getUint32(cdOffset + 20, true);
      const fileNameLen = view.getUint16(cdOffset + 28, true);
      const extraLen = view.getUint16(cdOffset + 30, true);
      const commentLen = view.getUint16(cdOffset + 32, true);
      const localHeaderOffset = view.getUint32(cdOffset + 42, true);

      const fileName = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + fileNameLen));
      cdOffset += 46 + fileNameLen + extraLen + commentLen;

      if (
        fileName.endsWith(".xml") ||
        fileName.endsWith(".rels")
      ) {
        if (localHeaderOffset + 30 > bytes.length) continue;
        const localNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compSlice = bytes.subarray(dataStart, dataStart + compressedSize);

        if (compressionMethod === 0) {
          entries.set(fileName, decoder.decode(compSlice));
        } else if (compressionMethod === 8) {
          const decompressed = await inflateRawBytes(compSlice);
          entries.set(fileName, decoder.decode(decompressed));
        }
      }
    }
  }

  return entries;
}

function parseSharedStringsXml(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const inner = siMatch[1];
    const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi;
    let tMatch: RegExpExecArray | null;
    let combined = "";
    while ((tMatch = tRegex.exec(inner)) !== null) {
      combined += decodeXmlEntities(tMatch[1]);
    }
    strings.push(combined);
  }
  return strings;
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowInner = rowMatch[1];
    const rowCells: string[] = [];
    // Match both self-closing <c .../> and <c ...>...</c>
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch: RegExpExecArray | null;
    let nextFallbackCol = 0;

    while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
      const attrs = cellMatch[1] || "";
      const cellContent = cellMatch[2] || "";

      // Extract coordinate r="B2" so empty skipped columns never shift subsequent columns!
      const rAttr = attrs.match(/\br\s*=\s*["']([A-Za-z]+)\d+["']/);
      const colIdx = rAttr ? colLettersToIndex(rAttr[1]) : nextFallbackCol;
      nextFallbackCol = colIdx + 1;

      const tAttr = attrs.match(/\bt\s*=\s*["']([^"']+)["']/);
      const cellType = tAttr ? tAttr[1] : "n";

      let value = "";
      if (cellType === "inlineStr") {
        const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi;
        let tm: RegExpExecArray | null;
        while ((tm = tRegex.exec(cellContent)) !== null) {
          value += decodeXmlEntities(tm[1]);
        }
      } else {
        const vMatch = cellContent.match(/<v(?:\s+[^>]*)?>([\s\S]*?)<\/v>/i);
        const rawV = vMatch ? decodeXmlEntities(vMatch[1].trim()) : "";
        if (cellType === "s") {
          const sIdx = parseInt(rawV, 10);
          value = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawV;
        } else {
          value = rawV;
        }
      }

      while (rowCells.length <= colIdx) {
        rowCells.push("");
      }
      rowCells[colIdx] = value;
    }

    if (rowCells.some((c) => cleanInvisibleAndSpaces(c) !== "")) {
      rows.push(rowCells);
    }
  }

  return rows;
}

/**
 * Parses HTML-table .xls or XML Spreadsheet 2003 .xls files.
 */
function parseXmlOrHtmlTable(text: string): string[][] {
  const rows: string[][] = [];

  // 1. Check SpreadsheetML <Row> / <Cell> / <Data>
  if (/<Row\b/i.test(text) && /<Data\b/i.test(text)) {
    const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rowRegex.exec(text)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRegex.exec(rm[1])) !== null) {
        const attrs = cm[1] || "";
        const idxMatch = attrs.match(/ss:Index\s*=\s*["'](\d+)["']/i);
        if (idxMatch) {
          const targetIdx = Math.max(0, parseInt(idxMatch[1], 10) - 1);
          while (cells.length < targetIdx) cells.push("");
        }
        const dm = cm[2].match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/i);
        cells.push(dm ? decodeXmlEntities(dm[1].replace(/<[^>]+>/g, "").trim()) : "");
      }
      if (cells.some((c) => cleanInvisibleAndSpaces(c) !== "")) {
        rows.push(cells);
      }
    }
    if (rows.length > 0) return rows;
  }

  // 2. Check HTML <tr> / <td> or <th>
  if (/<tr\b/i.test(text)) {
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trm: RegExpExecArray | null;
    while ((trm = trRegex.exec(text)) !== null) {
      const cells: string[] = [];
      const tdRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let tdm: RegExpExecArray | null;
      while ((tdm = tdRegex.exec(trm[1])) !== null) {
        const stripped = decodeXmlEntities(tdm[1].replace(/<[^>]+>/g, " ").trim());
        cells.push(stripped);
      }
      if (cells.some((c) => cleanInvisibleAndSpaces(c) !== "")) {
        rows.push(cells);
      }
    }
  }

  return rows;
}

/**
 * RFC-4180 compliant CSV / TSV parser with automatic delimiter detection (, | ; | \t).
 */
export function parseDelimitedText(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sampleLines = text.split("\n").slice(0, 10).filter((l) => l.trim().length > 0);
  if (sampleLines.length === 0) return [];

  // Auto-detect delimiter between comma, semicolon, and tab
  const delimiters = ["\t", ",", ";"];
  let bestDelim = ",";
  let bestScore = -1;
  for (const d of delimiters) {
    const counts = sampleLines.map((line) => line.split(d).length - 1);
    const minC = Math.min(...counts);
    const maxC = Math.max(...counts);
    if (maxC > 0 && minC === maxC && maxC > bestScore) {
      bestScore = maxC;
      bestDelim = d;
    } else if (maxC > bestScore && bestScore <= 0) {
      bestScore = maxC;
      bestDelim = d;
    }
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === bestDelim) {
        currentRow.push(currentCell.replace(/^\t/, "").trim());
        currentCell = "";
      } else if (ch === "\n") {
        currentRow.push(currentCell.replace(/^\t/, "").trim());
        if (currentRow.some((c) => cleanInvisibleAndSpaces(c) !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.replace(/^\t/, "").trim());
    if (currentRow.some((c) => cleanInvisibleAndSpaces(c) !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Decodes text buffer with automatic detection of UTF-8, UTF-16LE/BE, or Windows-1256 (Arabic ANSI).
 */
function decodeSmartTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(buffer);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(buffer);
    }
  }

  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  // If UTF-8 produced replacement characters (\uFFFD), fallback to Windows-1256 (Arabic Excel CSV)
  if (utf8Text.includes("\uFFFD")) {
    try {
      return new TextDecoder("windows-1256").decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text;
}

/**
 * Parses any uploaded Excel / Sheet file (.xlsx, .xls, .csv, .tsv) into a clean 2D array of strings.
 */
export async function parseUploadedSheetFile(file: File): Promise<{
  rows: string[][];
  sheetFormat: "xlsx" | "xls-xml" | "csv";
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 1. Check ZIP magic bytes PK\x03\x04 (.xlsx)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    const entries = await extractZipEntries(buffer);
    const sharedStringsXml = entries.get("xl/sharedStrings.xml") || "";
    const sharedStrings = sharedStringsXml ? parseSharedStringsXml(sharedStringsXml) : [];

    // Find first non-empty worksheet
    const sheetKeys = Array.from(entries.keys())
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
      .sort();

    for (const key of sheetKeys) {
      const sheetXml = entries.get(key) || "";
      const parsedRows = parseWorksheetXml(sheetXml, sharedStrings);
      if (parsedRows.length > 0) {
        return { rows: parsedRows, sheetFormat: "xlsx" };
      }
    }

    throw new Error("ملف Excel (.xlsx) فارغ أو لا يحتوي على أوراق عمل صالحة");
  }

  // 2. Check legacy binary BIFF8 .xls (D0 CF 11 E0)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    throw new Error(
      "هذا الملف بصيغة Excel 97-2003 القديمة (.xls). يرجى حفظه بصيغة Excel الحديثة (.xlsx) أو (.csv) ثم رفعه مرة أخرى."
    );
  }

  // 3. Decode as text (XML .xls, HTML .xls, .csv, or .tsv)
  const text = decodeSmartTextBuffer(buffer);
  if (/<Row\b/i.test(text) || /<table\b/i.test(text) || /<tr\b/i.test(text)) {
    const xmlRows = parseXmlOrHtmlTable(text);
    if (xmlRows.length > 0) {
      return { rows: xmlRows, sheetFormat: "xls-xml" };
    }
  }

  const csvRows = parseDelimitedText(text);
  if (csvRows.length === 0) {
    throw new Error("الملف المرفوع فارغ ولا يحتوي على أي صفوف بيانات");
  }

  return { rows: csvRows, sheetFormat: "csv" };
}
