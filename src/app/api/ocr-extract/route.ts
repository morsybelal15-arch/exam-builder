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
import { requireApiSession } from "@/lib/auth";
import {
  findTenantById,
  findTenantByPhone,
  incrementTenantExtractedQuestions,
} from "@/lib/tenants-repository";
import { syncTenantsToVps } from "@/lib/vps-sync";

// Passage extraction (long text + several questions) can take 30s+.
export const maxDuration = 120;



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
            notes: "مستخرج بالمحرك المحلي — راجع النص يدوياً.",
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
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "غير مصرح لك بالوصول." }, { status: 401 });
  }
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

  // Enforce server-side question extraction quota for Free Trial / capped tenants
  const tenant =
    session.role !== "SUPER_ADMIN"
      ? (await findTenantById(session.id)) || (await findTenantByPhone(session.phone))
      : null;
  const isTrial = Boolean(tenant?.isTrial || tenant?.subscriptionType === "تجربة مجانية");
  const maxExtractedQuestions = Number(
    tenant?.maxExtractedQuestions || (isTrial ? 30 : 0)
  );
  const currentQuestionsUsed = Number(tenant?.extractedQuestionsUsed || 0);
  const remainingQuestions =
    maxExtractedQuestions > 0
      ? Math.max(0, maxExtractedQuestions - currentQuestionsUsed)
      : Infinity;

  if (maxExtractedQuestions > 0 && remainingQuestions <= 0) {
    return NextResponse.json(
      {
        success: false,
        limitReached: true,
        error: `لقد استهلكت الحد الأقصى لاستخراج الأسئلة في النسخة المجانية (${maxExtractedQuestions} سؤال). يرجى ترقية اشتراكك للاستمرار في استخراج الأسئلة بلا حدود.`,
        trialQuota: {
          used: currentQuestionsUsed,
          max: maxExtractedQuestions,
          remaining: 0,
        },
      },
      { status: 403 }
    );
  }

  const apiKey = resolveApiKey(body.apiKey ?? req.headers.get("x-gemini-key"));

  // 1) Primary: Vision extraction (reads + structures in one pass)
  if (apiKey) {
    try {
      const result = await extractQuestionsFromImage(imageBase64, apiKey);
      const hasPassage = Boolean(result.passageText || (result.rawText && result.rawText.trim().length > 30));
      if (result.questions.length === 0 && !hasPassage) {
        return NextResponse.json(
          {
            success: false,
            error: "لم يتم العثور على أسئلة أو نصوص في المنطقة المحددة. جرّب تحديد منطقة أوضح تشمل السؤال أو القطعة كاملة.",
            rawText: result.rawText,
          },
          { status: 422 }
        );
      }

      let finalQuestions = result.questions;
      let cappedByTrial = false;
      if (maxExtractedQuestions > 0 && finalQuestions.length > remainingQuestions) {
        finalQuestions = finalQuestions.slice(0, remainingQuestions);
        cappedByTrial = true;
      }

      let trialQuota: { used: number; max: number; remaining: number } | undefined = undefined;
      if (tenant && maxExtractedQuestions > 0) {
        const addedCount = Math.max(1, finalQuestions.length);
        const updatedTenant = await incrementTenantExtractedQuestions(tenant.id, addedCount);
        const newUsed = Number(
          updatedTenant?.extractedQuestionsUsed ?? currentQuestionsUsed + addedCount
        );
        trialQuota = {
          used: newUsed,
          max: maxExtractedQuestions,
          remaining: Math.max(0, maxExtractedQuestions - newUsed),
        };
        syncTenantsToVps({ force: false }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        ...result,
        questions: finalQuestions,
        parsedQuestion: finalQuestions[0] || null,
        cappedByTrial,
        ...(trialQuota ? { trialQuota } : {}),
      });
    } catch (err) {
      const { message, status } = friendlyGeminiError(err);
      console.error("[ocr-extract] extraction failed:", err);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  // 2) Offline fallback: local Arabic_OCR engine
  const local = await runLocalArabicOcr(imageBase64);
  if (local) {
    let trialQuota: { used: number; max: number; remaining: number } | undefined = undefined;
    if (tenant && maxExtractedQuestions > 0) {
      const updatedTenant = await incrementTenantExtractedQuestions(tenant.id, 1);
      const newUsed = Number(
        updatedTenant?.extractedQuestionsUsed ?? currentQuestionsUsed + 1
      );
      trialQuota = {
        used: newUsed,
        max: maxExtractedQuestions,
        remaining: Math.max(0, maxExtractedQuestions - newUsed),
      };
      syncTenantsToVps({ force: false }).catch(() => {});
    }
    return NextResponse.json({
      success: true,
      engine: "local",
      questions: [local.question],
      rawText: local.rawText,
      ...(trialQuota ? { trialQuota } : {}),
    });
  }

  return NextResponse.json(
    {
      success: false,
      needsApiKey: true,
      error:
        "لا يوجد محرك قراءة متاح حالياً. أضف مفتاح الربط من زر الإعدادات، أو ثبّت المحرك المحلي.",
    },
    { status: 503 }
  );
}
