import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  extractQuestionsFromImage,
  friendlyGeminiError,
  resolveApiKey,
  type ExtractedQuestion,
} from "@/lib/gemini";



/**
 * Offline fallback: maidaly/Arabic_OCR (EasyOCR) via ocr_engine/runner.py.
 * Returns null if the engine is unavailable — never fake text.
 */
function runLocalArabicOcr(imageBase64: string): Promise<{ rawText: string; question: ExtractedQuestion } | null> {
  return new Promise((resolve) => {
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, ".venv", "Scripts", "python.exe"),
      path.join(cwd, ".venv", "bin", "python"),
    ];
    const pythonExec = candidates.find((p) => fs.existsSync(p));
    const runner = path.join(cwd, "ocr_engine", "runner.py");
    if (!pythonExec || !fs.existsSync(runner)) return resolve(null);

    const child = spawn(pythonExec, [runner], { cwd: path.dirname(runner), windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("error", () => resolve(null));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out.trim());
        if (!parsed.success || !parsed.rawText?.trim()) return resolve(null);
        const p = parsed.parsedQuestion;
        resolve({
          rawText: parsed.rawText,
          question: {
            type: p.type,
            number: p.questionNumber || "",
            text: p.text,
            options: p.options || [],
            correctOptionIndex: null,
            points: p.points || 1,
            table: null,
            confidence: 0.4,
            notes: "مستخرج بالمحرك المحلي بدون تدقيق Gemini — راجع النص يدوياً.",
          },
        });
      } catch {
        resolve(null);
      }
    });
    child.stdin.write(imageBase64);
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير صالح." }, { status: 400 });
  }

  const { imageBase64 } = body;
  if (!imageBase64 || imageBase64.length < 200) {
    return NextResponse.json(
      { success: false, error: "لم يتم استلام صورة صالحة للمنطقة المحددة." },
      { status: 400 }
    );
  }

  const apiKey = resolveApiKey(body.apiKey ?? req.headers.get("x-gemini-key"));

  // 1) Primary: Gemini vision (reads + structures in one pass)
  if (apiKey) {
    try {
      const result = await extractQuestionsFromImage(imageBase64, apiKey);
      if (result.questions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "لم يتم العثور على أسئلة في المنطقة المحددة. جرّب تحديد منطقة أوضح تشمل السؤال كاملاً.",
            rawText: result.rawText,
          },
          { status: 422 }
        );
      }
      return NextResponse.json({
        success: true,
        ...result,
        parsedQuestion: result.questions[0] || null,
      });
    } catch (err) {
      const { message, status } = friendlyGeminiError(err);
      console.error("[ocr-extract] Gemini failed:", err);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  // 2) Offline fallback: local Arabic_OCR engine
  const local = await runLocalArabicOcr(imageBase64);
  if (local) {
    return NextResponse.json({
      success: true,
      engine: "local",
      questions: [local.question],
      rawText: local.rawText,
    });
  }

  return NextResponse.json(
    {
      success: false,
      needsApiKey: true,
      error:
        "لا يوجد محرك قراءة متاح. أضف مفتاح Gemini API من زر الإعدادات (الطريقة الموصى بها)، أو ثبّت المحرك المحلي.",
    },
    { status: 503 }
  );
}
