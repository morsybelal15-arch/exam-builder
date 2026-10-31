import { NextRequest, NextResponse } from "next/server";
import { friendlyGeminiError, refineQuestion, resolveApiKey, type QuestionType } from "@/lib/gemini";
import { requireApiSession } from "@/lib/auth";

/** AI agent pass on a single question: fix OCR typos, re-split options, solve, or format equations. */
export async function POST(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "غير مصرح لك بالوصول." }, { status: 401 });
  }
  let body: {
    question?: any;
    task?: "organize" | "fix_typos" | "solve" | "convert_type" | "generate_distractors";
    targetType?: QuestionType;
    solve?: boolean;
    imageBase64?: string;
    apiKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير صالح." }, { status: 400 });
  }

  if (!body.question || (!body.question.text && (!body.question.options || body.question.options.length === 0))) {
    return NextResponse.json({ success: false, error: "السؤال فارغ." }, { status: 400 });
  }

  const apiKey = resolveApiKey(body.apiKey ?? req.headers.get("x-gemini-key"));
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        needsApiKey: true,
        error: "أضف مفتاح الربط من زر الإعدادات في الأعلى لاستخدام التنسيق التلقائي.",
      },
      { status: 401 }
    );
  }

  try {
    const question = await refineQuestion(body.question, apiKey, {
      task: body.task,
      targetType: body.targetType,
      solve: !!body.solve,
      imageBase64: body.imageBase64,
    });
    return NextResponse.json({ success: true, question });
  } catch (err) {
    const { message, status } = friendlyGeminiError(err);
    console.error("[refine-question] failed:", err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
