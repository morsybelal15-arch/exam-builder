/**
 * Multi-Model Exam Generator (توليد نماذج الاختبارات أ - ب - ج)
 * Prevents classroom cheating via 1-Click Fisher-Yates question shuffling.
 */

export interface SingleExamModel<T = any> {
  key: "A" | "B" | "C";
  name: string; // "نموذج (أ)" | "نموذج (ب)" | "نموذج (ج)"
  questions: T[];
}

export interface ExamModelsData<T = any> {
  modelCount: number; // 2 or 3
  activeModelKey: "A" | "B" | "C" | "ALL";
  models: {
    A: SingleExamModel<T>;
    B?: SingleExamModel<T>;
    C?: SingleExamModel<T>;
  };
}

/**
 * Modern Fisher-Yates unbiased shuffle algorithm
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Dynamically updates question numbering prefixes (س1:, س2:, 1-, 2-, Q1:, [1], (1))
 * to match the new vertical order in shuffled models while keeping question content intact.
 */
export function updateQuestionNumberPrefix(text: string, newIndex: number): string {
  if (!text || typeof text !== "string") return text || "";
  const n = newIndex + 1;

  // 1. Bracketed numbers: (1) or [1] or (1)- or [1]:
  if (/^(\s*[\(\[])\s*\d+\s*([\)\]]\s*[:.-]?\s*)/.test(text)) {
    return text.replace(/^(\s*[\(\[])\s*\d+\s*([\)\]]\s*[:.-]?\s*)/, `$1${n}$2`);
  }

  // 2. Arabic س prefix: س1:, س 1 -, س1. س1/
  if (/^(\s*س\s*)\d+(\s*[:./\-]\s*)/.test(text)) {
    return text.replace(/^(\s*س\s*)\d+(\s*[:./\-]\s*)/, `$1${n}$2`);
  }

  // 3. English Q prefix: Q1:, Q 1 -, Q.1
  if (/^(\s*Q\s*\.?\s*)\d+(\s*[:./\-]\s*)/i.test(text)) {
    return text.replace(/^(\s*Q\s*\.?\s*)\d+(\s*[:./\-]\s*)/i, `$1${n}$2`);
  }

  // 4. Number followed by separator: 1-, 1., 1) , 1:, 1 -
  if (/^(\s*)\d+(\s*[-.:/)]\s*)/.test(text)) {
    return text.replace(/^(\s*)\d+(\s*[-.:/)]\s*)/, `$1${n}$2`);
  }

  // Question content without prefix stays completely intact
  return text;
}

/**
 * Deep clones a question item, assigning a fresh ID and updated prefix
 */
export function cloneQuestion<T extends { options?: any[]; id?: string; text?: string }>(
  q: T,
  newIndex?: number,
  modelKey?: string
): T {
  const cloned: any = {
    ...q,
    id: `q-${modelKey || "m"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    options: Array.isArray(q.options) ? [...q.options] : [],
  };

  if (typeof q.text === "string" && newIndex !== undefined && (q as any).type !== "passage" && q.text.trim()) {
    cloned.text = updateQuestionNumberPrefix(q.text, newIndex);
  }

  return cloned as T;
}

/**
 * Creates a deep-cloned, randomly shuffled version of questions for Model B or C
 */
export function createShuffledModel<T extends { options?: any[]; id?: string; text?: string }>(
  baseQuestions: T[],
  key: "B" | "C",
  name: string
): SingleExamModel<T> {
  if (!baseQuestions || baseQuestions.length === 0) {
    return { key, name, questions: [] };
  }

  if (baseQuestions.length === 1) {
    return {
      key,
      name,
      questions: [cloneQuestion(baseQuestions[0], 0, key)],
    };
  }

  let shuffled = fisherYatesShuffle(baseQuestions);

  // Guarantee that shuffled order is not 100% identical to base if length >= 2
  let attempts = 0;
  while (
    attempts < 8 &&
    shuffled.every((item, idx) => item.text === baseQuestions[idx].text)
  ) {
    shuffled = fisherYatesShuffle(baseQuestions);
    attempts++;
  }

  if (shuffled.every((item, idx) => item.text === baseQuestions[idx].text)) {
    const temp = shuffled[0];
    shuffled[0] = shuffled[1];
    shuffled[1] = temp;
  }

  return {
    key,
    name,
    questions: shuffled.map((q, idx) => cloneQuestion(q, idx, key)),
  };
}

/**
 * Generates 2 models (أ - ب) or 3 models (أ - ب - ج) from base questions
 */
export function generateExamModels<T extends { options?: any[]; id?: string; text?: string }>(
  baseQuestions: T[],
  count: 2 | 3
): ExamModelsData<T> {
  const modelA: SingleExamModel<T> = {
    key: "A",
    name: "نموذج (أ)",
    questions: baseQuestions.map((q, idx) => ({
      ...cloneQuestion(q, idx, "A"),
      // Preserve original text for Model A
      text: q.text,
    })),
  };

  const modelB = createShuffledModel(baseQuestions, "B", "نموذج (ب)");
  const modelC = count === 3 ? createShuffledModel(baseQuestions, "C", "نموذج (ج)") : undefined;

  return {
    modelCount: count,
    activeModelKey: "A",
    models: {
      A: modelA,
      B: modelB,
      C: modelC,
    },
  };
}

/**
 * Reshuffles Model B and Model C while preserving Model A intact
 */
export function reshuffleExamModels<T extends { options?: any[]; id?: string; text?: string }>(
  currentModels: ExamModelsData<T>
): ExamModelsData<T> {
  const baseQuestions = currentModels.models.A.questions;
  const modelB = createShuffledModel(baseQuestions, "B", "نموذج (ب)");
  const modelC =
    currentModels.modelCount === 3
      ? createShuffledModel(baseQuestions, "C", "نموذج (ج)")
      : undefined;

  return {
    ...currentModels,
    models: {
      A: currentModels.models.A,
      B: modelB,
      C: modelC,
    },
  };
}
