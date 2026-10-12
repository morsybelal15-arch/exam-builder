export type QuestionType = "choice" | "trueFalse" | "essay" | "fillBlank";

export interface QuestionTable {
  headers: string[];
  rows: string[][];
}

export interface QuestionStyle {
  fontSize: number;
  isBold: boolean;
  textAlign: "right" | "center" | "left";
}

export interface ExamQuestionItem {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctOptionIndex: number | null;
  points: number;
  table: QuestionTable | null;
  /** Reader notes (unclear words, cut-off parts). Shown to the teacher, not printed. */
  notes?: string;
  /** 0..1 reading confidence; below 0.7 the block is flagged for review. */
  confidence?: number;
  fromScan?: boolean;
  /** Cropped source image kept in memory so the question can be re-checked against it. Not saved to DB. */
  sourceImage?: string;
}

export const DEFAULT_STYLE: QuestionStyle = { fontSize: 14, isBold: false, textAlign: "right" };

export const ARABIC_OPTION_LABELS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: "اختيار من متعدد",
  trueFalse: "صح وخطأ",
  essay: "سؤال مقالي",
  fillBlank: "أكمل الفراغ",
};

export function newId(prefix = "q") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Maps an API question payload into an editor item. */
export function fromApiQuestion(q: any, extra: Partial<ExamQuestionItem> = {}): ExamQuestionItem {
  const type: QuestionType = ["choice", "trueFalse", "essay", "fillBlank"].includes(q?.type) ? q.type : "essay";
  return {
    id: newId(),
    type,
    text: String(q?.text ?? ""),
    options: Array.isArray(q?.options) ? q.options.map(String) : [],
    correctOptionIndex: typeof q?.correctOptionIndex === "number" ? q.correctOptionIndex : null,
    points: Math.max(1, Number(q?.points) || 1),
    table: q?.table && Array.isArray(q.table.headers) ? q.table : null,
    notes: q?.notes || "",
    confidence: typeof q?.confidence === "number" ? q.confidence : undefined,
    ...extra,
  };
}
