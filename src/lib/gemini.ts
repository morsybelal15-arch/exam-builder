import { GoogleGenAI } from "@google/genai";

export const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
].filter(Boolean) as string[];

export type QuestionType = "choice" | "trueFalse" | "essay" | "fillBlank";

export interface ExtractedQuestion {
  type: QuestionType;
  number: string;
  text: string;
  options: string[];
  correctOptionIndex: number | null;
  points: number;
  table: { headers: string[]; rows: string[][] } | null;
  confidence: number;
  notes: string;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  rawText: string;
  engine: "gemini" | "local";
}

/** Resolves the API key: request-supplied key (from the settings dialog or header) wins, then env. */
export function resolveApiKey(requestKey?: string | null): string | null {
  const key = (requestKey || "").trim() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  return key ? key : null;
}

function getClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

function stripDataUrl(b64: string): { data: string; mimeType: string } {
  const match = b64.match(/^data:(image\/[\w+.-]+);base64,([\s\S]*)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/png", data: b64 };
}

function parseJson<T>(text: string | null | undefined): T {
  if (!text) throw new Error("لم يُرجع النموذج أي نص.");
  let cleaned = text.trim();
  
  // Strip markdown ```json ... ``` codeblocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  
  // Extract JSON payload bounded by outermost brackets if extra text exists
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = 0;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) cleaned = cleaned.slice(startIdx, lastBrace + 1);
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket !== -1) cleaned = cleaned.slice(startIdx, lastBracket + 1);
  }
  
  return JSON.parse(cleaned) as T;
}

function cleanOptionText(raw: string): string {
  let s = String(raw || "").trim();
  // Strip letter markers like (أ), أ), أ-, أ., (a), a), a-
  s = s.replace(/^[\(\[\{]([أ-دa-dA-D])[\)\]\}]\s*[-–.:]?\s*/, "");
  s = s.replace(/^([أ-دa-dA-D])[\)\]\}]\s*[-–.:]?\s*/, "");
  s = s.replace(/^([أ-دa-dA-D])\s*[-–.:]\s*/, "");
  // Strip numbering ONLY when enclosed in paren (1) or with dash 1-
  // NEVER strip '0.' or '.' to prevent breaking decimals like 0.315
  s = s.replace(/^[\(\[\{](\d{1,2})[\)\]\}]\s*[-–.:]?\s*/, "");
  s = s.replace(/^([1-9]\d?)[-–:]\s+/, "");
  return s.trim();
}

function detectQuestionType(text: string, options: string[], rawType?: string): QuestionType {
  const cleanText = text.trim();

  // 1. True / False signals
  const isTfText = /صح\s*أو\s*خطأ|صواب\s*أو\s*خطأ|ضع\s*علامة\s*\(?[✓✔]/i.test(cleanText);
  const isTfOptions =
    options.length === 2 &&
    options.some((o) => /^(صح|صواب|نعم|صحيحة|true)$/i.test(o.trim())) &&
    options.some((o) => /^(خطأ|لا|خاطئة|false)$/i.test(o.trim()));

  if (isTfText || isTfOptions || rawType === "trueFalse") {
    return "trueFalse";
  }

  // 2. Essay keywords
  const isEssayKeyword = /^(علل|فسر|وضح|اشرح|قارن|اذكر|ما\s*المقصود|ما\s*دور|ما\s*أهمية|ما\s*وظيفة|ماذا\s*يحدث|ما\s*النتائج|اكتب\s*المصطلح|أثبت\s*أن|احسب|مسألة)/.test(
    cleanText
  );
  if ((options.length < 2 && isEssayKeyword) || (options.length === 0 && rawType !== "choice") || rawType === "essay") {
    return "essay";
  }

  // 3. Multiple Choice
  if (options.length >= 2 || rawType === "choice") {
    return "choice";
  }

  return "essay";
}

function normalizeQuestion(q: Partial<ExtractedQuestion>): ExtractedQuestion {
  const rawText = String(q.text || "").trim();
  let options = Array.isArray(q.options)
    ? q.options.map(cleanOptionText).filter(Boolean)
    : [];

  const type = detectQuestionType(rawText, options, q.type);

  if (type === "trueFalse") {
    if (options.length === 0) options = ["صح", "خطأ"];
  } else if (type === "essay" || type === "fillBlank") {
    options = [];
  }

  const idx =
    typeof q.correctOptionIndex === "number" && q.correctOptionIndex >= 0 && q.correctOptionIndex < options.length
      ? q.correctOptionIndex
      : null;

  return {
    type,
    number: String(q.number || "").trim(),
    text: rawText,
    options,
    correctOptionIndex: idx,
    points: Math.max(1, Number(q.points) || (type === "choice" ? 2 : type === "trueFalse" ? 1 : 5)),
    table:
      q.table && Array.isArray(q.table.headers) && Array.isArray(q.table.rows) && q.table.headers.length
        ? q.table
        : null,
    confidence: typeof q.confidence === "number" ? q.confidence : 0.95,
    notes: String(q.notes || "").trim(),
  };
}

const EXTRACTION_INSTRUCTION = `أنت خبير محترف ومتقدم جداً في التعرف البصري على النصوص (Vision OCR) للامتحانات والمناهج التعليمية المكتوبة باللغة العربية (خاصة مناهج الكيمياء والفيزياء والرياضيات).
مهمتك: قراءة الصورة المحددة بدقة 100% وتحويلها إلى أسئلة منظمة بنظام JSON مع إدراك ذكي ودقيق لنوع كل سؤال.

أنواع الأسئلة (الحقل "type"):
- "choice": سؤال اختيار من متعدد (يحتوي على اختيارات مثل أ، ب، ج، د أو A, B, C, D).
- "trueFalse": سؤال صح أو خطأ أو ضع علامة (✓) أو (✗)، أو السؤال الذي يحتمل فقط إجابتين (صح/خطأ أو صواب/خطأ).
- "essay": سؤال مقالي (مثل: علل لما يأتي، وضح، اذكر، اشرح، قارن بين، ما المقصود، احسب، اكتب المعادلة، أو أي سؤال لا يتضمن اختيارات).

قواعد الاستخراج الصارمة جداً:
1. نص السؤال الكامل والمعادلات:
   - اقرأ نص السؤال كاملاً من اليمين لليسار.
   - في الامتحانات العربية، غالباً ما تبدأ العبارة على اليمين والمعادلة الكيميائية أو الرياضية تكون على يسار نفس السطر (مثل: عند ترسيب 10 جرام من العنصر A تبعاً للمعادلة (A=63.5) A⁺² + 2e⁻ ────> A). المعادلة جزء أساسي من نص السؤال ويجب كتابتها بالكامل دون أي بتر!
   - إذا كان هناك تكملة للسؤال في السطر التالي (مثل: "يلزم كمية كهربية قدرها") قبل الاختيارات، فضمها فوراً لنهاية نص السؤال في الحقل "text".
2. الحفاظ التام على الأرقام العشرية والفواصل:
   - إياك أن تحذف الصفر أو الفاصلة العشرية من الأرقام! (مثال: اكتب 0.315 بدقة وليس 315، واكتب 0.675 وليس 675).
   - اكتب الرقم أولاً ثم الوحدة كما في الأصل بالضبط (مثال: 0.315 F، 30393 F، 0.675 C، 15196 C).
3. فصل الاختيارات:
   - ضع الخيارات في مصفوفة "options" مرتبة كما هي.
   - احذف حرف الترقيم (أ، ب، ج، د) من بداية نص الخيار واحتفظ بالقيمة الكاملة والوحدة.
   - إذا كان السؤال مقالياً ("essay")، فاجعل "options" مصفوفة فارغة [].
4. المعادلات والرموز العلمية:
   - حافظ على الأسس والشحنات والأسهم بدقة: (A⁺² + 2e⁻ → A).
5. أرجع النتيجة حصراً ككائن JSON بالصيغة التالية:
{
  "rawText": "النص الكامل الظاهر في الصورة",
  "questions": [
    {
      "number": "65",
      "type": "choice",
      "text": "عند ترسيب 10 جرام من العنصر A تبعاً للمعادلة (A=63.5) A⁺² + 2e⁻ ────> A يلزم كمية كهربية قدرها",
      "options": ["0.315 F", "30393 F", "0.675 C", "15196 C"],
      "correctOptionIndex": 0,
      "points": 2,
      "notes": "..."
    }
  ]
}`;

/** Call Gemini models.generateContent with candidate model fallback */
async function callGeminiGenerate(
  client: GoogleGenAI,
  params: {
    systemInstruction: string;
    prompt: string;
    inlineImage?: { mimeType: string; data: string };
  }
) {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const contents: any[] = [];
      if (params.inlineImage) {
        contents.push({
          inlineData: {
            mimeType: params.inlineImage.mimeType,
            data: params.inlineImage.data,
          },
        });
      }
      contents.push(params.prompt);

      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1,
          abortSignal: AbortSignal.timeout(8500),
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error(`أرجع النموذج ${model} نصاً فارغاً.`);
      }
      return text;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err);
      // If error is about model not found or temporary high demand (503), try the next candidate model
      if (/not found|404|unsupported model|503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
        console.warn(`[gemini] Model ${model} unavailable (${msg.slice(0, 60)}), trying next candidate...`);
        continue;
      }
      // For auth errors, stop
      if (/api[_ ]?key|API_KEY_INVALID|401|403/i.test(msg)) {
        throw err;
      }
      continue;
    }
  }

  throw lastError || new Error("فشلت جميع محاولات الاتصال بالنماذج.");
}

/** Vision OCR + structuring in one pass: cropped image → structured exam questions */
export async function extractQuestionsFromImage(
  imageBase64: string,
  apiKey: string,
  ocrHint?: string
): Promise<ExtractionResult> {
  const client = getClient(apiKey);
  const { data, mimeType } = stripDataUrl(imageBase64);

  const prompt = ocrHint
    ? `اقرأ الصورة واستخرج الأسئلة الموجودة فيها بدقة تامة. هذا نص مساعد من قارئ أولي:\n${ocrHint}\n\nأعد الأسئلة بصيغة JSON.`
    : "اقرأ الصورة المرفقة واستخرج جميع الأسئلة والخيارات والمعادلات الظاهرة فيها بتنسيق JSON المطلوب.";

  const rawJson = await callGeminiGenerate(client, {
    systemInstruction: EXTRACTION_INSTRUCTION,
    prompt,
    inlineImage: { mimeType, data },
  });

  const parsed = parseJson<{ rawText?: string; questions?: Partial<ExtractedQuestion>[] }>(rawJson);

  let rawQuestions: Partial<ExtractedQuestion>[] = [];
  if (Array.isArray(parsed.questions)) {
    rawQuestions = parsed.questions;
  } else if (Array.isArray(parsed)) {
    rawQuestions = parsed as Partial<ExtractedQuestion>[];
  } else if (parsed && typeof (parsed as any).text === "string") {
    rawQuestions = [parsed as Partial<ExtractedQuestion>];
  }

  const questions = rawQuestions
    .map(normalizeQuestion)
    .filter((q) => q.text.length > 0 || q.options.length > 0);

  return {
    questions,
    rawText: parsed.rawText || "",
    engine: "gemini",
  };
}

const REFINE_AGENT_INSTRUCTION = `أنت وكيل ذكي ومساعد تعليمي خبير (Gemini Exam Agent).
مهمتك: معالجة وتدقيق وتحسين سؤال الامتحان المحدد، وفصل الاختيارات، وتنسيق المعادلات والأرقام.

المهام التي يمكنك القيام بها بحسب الطلب:
1. تنظيم الاختيارات: إذا كانت الاختيارات مدمجة في نص السؤال، أو كانت غير مرتبة أو تحتوي على أحرف الترقيم (أ، ب، ج، د)، قم بفصلها تماماً ونظف نص السؤال.
2. تصحيح الأخطاء (OCR Fix): تصحيح أي أخطاء لغوية أو إملائية أو حروف مقلوبة أو مسافات خاطئة ناتجة عن الماسح الضوئي، مع الحفاظ الدقيق على المصطلحات العلمية.
3. تنسيق المعادلات: كتابة المعادلات الكيميائية والفيزيائية بصياغة سليمة واضحة (مثل TiCl₄, 2H₂ + O₂ → 2H₂O, X⁺² + 2e⁻).
4. حل السؤال: إذا طُلب الحل، قم بحل السؤال وحدد correctOptionIndex بدقة، واكتب تعليقاً مختصراً في notes.
5. توليد خيارات إضافية: إذا كان السؤال ينقصه خيارات (مثلاً خياران فقط)، ولد خيارات مشتتة ذكية ومناسبة للمنهج.

يجب إرجاع النتيجة حصراً بصيغة JSON لكائن السؤال:
{
  "type": "choice" | "trueFalse" | "essay" | "fillBlank",
  "number": "رقم السؤال",
  "text": "نص السؤال الرئيسي المنقح فقط",
  "options": ["الخيار 1", "الخيار 2", "الخيار 3", "الخيار 4"],
  "correctOptionIndex": 0,
  "points": 2,
  "notes": "شرح الحل أو التعديلات"
}`;

export interface RefineOptions {
  task?: "organize" | "fix_typos" | "solve" | "convert_type" | "generate_distractors";
  targetType?: QuestionType;
  solve?: boolean;
  imageBase64?: string;
}

/** "AI Agent" pass: fixes, reorganizes, solves, or polishes a question */
export async function refineQuestion(
  question: Partial<ExtractedQuestion>,
  apiKey: string,
  opts: RefineOptions = {}
): Promise<ExtractedQuestion> {
  const client = getClient(apiKey);

  let taskDesc = "قم بتدقيق وتنظيم هذا السؤال، وفصل الاختيارات وتصحيح أي أخطاء.";
  if (opts.task === "solve" || opts.solve) {
    taskDesc = "قم بحل هذا السؤال علمياً بدقة، وحدد رقم الخيار الصحيح في correctOptionIndex مع توضيح في notes.";
  } else if (opts.task === "organize") {
    taskDesc = "قم بفصل الاختيارات تماماً عن نص السؤال، وإزالة حروف الترقيم (أ/ب/ج/د)، وترتيب الخيارات بشكل احترافي.";
  } else if (opts.task === "fix_typos") {
    taskDesc = "قم بتصحيح كافة أخطاء المسح الضوئي (OCR) والحروف المقلوبة وتنسيق المعادلات والرموز العلمية.";
  } else if (opts.task === "generate_distractors") {
    taskDesc = "السؤال ينقصه خيارات كافية؛ احتفظ بالخيارات الموجودة وأضف خيارات إضافية ذكية ومتوافقة مع المنهج لتصل لـ 4 خيارات.";
  }

  const prompt = `${taskDesc}\n\nبيانات السؤال الحالية:\n${JSON.stringify(question, null, 2)}`;

  let inlineImage: { mimeType: string; data: string } | undefined;
  if (opts.imageBase64) {
    inlineImage = stripDataUrl(opts.imageBase64);
  }

  const rawJson = await callGeminiGenerate(client, {
    systemInstruction: REFINE_AGENT_INSTRUCTION,
    prompt,
    inlineImage,
  });

  const parsed = parseJson<Partial<ExtractedQuestion>>(rawJson);
  return normalizeQuestion(parsed);
}

/** Quick 1-second ping to verify API key validity */
export async function testGeminiKey(apiKey: string): Promise<{ valid: boolean; model: string; error?: string }> {
  try {
    const client = getClient(apiKey);
    const text = await callGeminiGenerate(client, {
      systemInstruction: "أنت نظام فحص المفتاح. أجب حصراً بـ JSON: {\"status\": \"ok\"}",
      prompt: "ping",
    });
    return { valid: true, model: CANDIDATE_MODELS[0] || "gemini-2.5-flash" };
  } catch (err: any) {
    const friendly = friendlyGeminiError(err);
    return { valid: false, model: "", error: friendly.message };
  }
}

/** Turns SDK/HTTP errors into clear, actionable Arabic messages */
export function friendlyGeminiError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/api[_ ]?key|API_KEY_INVALID|401|403|permission/i.test(raw)) {
    return {
      message: "مفتاح Gemini API غير صالح أو غير مفعل. يرجى التأكد من نسخه بدقة من Google AI Studio (يبدأ عادة بـ AIzaSy).",
      status: 401,
    };
  }
  if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(raw)) {
    return {
      message: "تم تجاوز حد الاستخدام المؤقت لمفتاح Gemini المجاني. يرجى الانتظار 30 ثانية أو استخدام مفتاح آخر.",
      status: 429,
    };
  }
  if (/fetch failed|ENOTFOUND|ECONNRESET|network/i.test(raw)) {
    return {
      message: "تعذر الاتصال بخوادم Google Gemini. يرجى التحقق من اتصالك بالإنترنت.",
      status: 503,
    };
  }
  return {
    message: `خطأ من Gemini: ${raw.replace(/https?:\/\/[^\s]+/g, "").slice(0, 200)}`,
    status: 500,
  };
}
