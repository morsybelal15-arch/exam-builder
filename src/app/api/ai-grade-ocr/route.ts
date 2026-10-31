import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { resolveApiKeyPool, CANDIDATE_MODELS } from "@/lib/gemini";
import { getStudents, saveStudentGrade } from "@/lib/management-db";
import { requireApiSession } from "@/lib/auth";
import { setCurrentTenantId } from "@/lib/tenant-context";

function stripDataUrl(b64: string): { data: string; mimeType: string } {
  const match = b64.match(/^data:(image\/[\w+.-]+);base64,([\s\S]*)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/jpeg", data: b64 };
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }
    setCurrentTenantId(session.id);
    const body = await req.json();
    setCurrentTenantId(session.id);
    const { imageBase64, groupId, examRecordId, apiKey: requestApiKey, autoSave } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "الصورة الملتقطة مطلوبة" }, { status: 400 });
    }

    const keyPool = resolveApiKeyPool(requestApiKey);
    if (keyPool.length === 0) {
      return NextResponse.json(
        { error: "مفتاح القراءة التلقائية غير متوفر. يرجى ضبطه في الإعدادات." },
        { status: 400 }
      );
    }

    // Get group students list to pass to Gemini for precise name matching
    const groupStudents = groupId ? getStudents(groupId) : [];
    const studentsContext = groupStudents
      .map((s) => `- ${s.name} (الكود: ${s.code}, المعرف: ${s.id})`)
      .join("\n");

    const systemInstruction = `أنت خبير فاحص أوراق الامتحانات المدرسية (AI Exam Grading OCR).
مهمتك: قراءة صورة ورقة الامتحان بدقة شديدة واستخراج:
1. اسم الطالب (أو كود الطالب المكتوب).
2. الدرجة أو الدرجة المستحقة (Score / Degree) والدرجة الكلية إن وجدت (مثل: 18.5 من 20 أو 28/30 أو مجرد رقم الدرجة).
3. مطابقة اسم الطالب بدقة شديدة مع قائمة الطلاب المسجلين في المجموعة إن كان ذلك ممكناً.

قائمة الطلاب المسجلين في هذه المجموعة للمطابقة الذكية:
${studentsContext || "لا توجد قائمة مسبقة، استخرج الاسم المكتوب فقط"}

أرجع النتيجة حصراً بتنسيق JSON:
{
  "detectedStudentName": "الاسم الظاهر في الورقة",
  "matchedStudentId": "معرف الطالب إذا وجد تطابق قوي وإلا null",
  "matchedStudentName": "اسم الطالب المطابق في النظام أو null",
  "score": 18.5,
  "totalScore": 20,
  "confidence": 0.95,
  "notes": "ملاحظات إضافية حول القراءة إن وجدت"
}`;

    const { mimeType, data } = stripDataUrl(imageBase64);

    let parsedResult: any = null;
    let lastError: any = null;

    keyLoop: for (const apiKey of keyPool) {
      const client = new GoogleGenAI({ apiKey });
      for (const model of CANDIDATE_MODELS) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: [
              {
                inlineData: {
                  mimeType,
                  data,
                },
              },
              "استخرج اسم الطالب والدرجة من هذه الورقة بناءً على التعليمات السابقة.",
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.1,
              abortSignal: AbortSignal.timeout(12000),
            },
          });

          const text = response.text;
          if (text) {
            let cleaned = text.trim();
            if (cleaned.startsWith("```")) {
              cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
            }
            parsedResult = JSON.parse(cleaned);
            break keyLoop;
          }
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || err);
          console.warn(`Model ${model} OCR failed:`, msg);
          if (/api[_ ]?key|API_KEY_INVALID|401|403|429|quota|RESOURCE_EXHAUSTED/i.test(msg) && keyPool.length > 1) {
            break; // switch to next API key in pool
          }
        }
      }
    }

    if (!parsedResult) {
      throw lastError || new Error("تعذر قراءة الورقة تلقائياً");
    }

    // Safe fallback match on student name/code if model didn't provide matchedStudentId
    // Requires either exact code match or at least 2 name tokens with a unique student match
    if (!parsedResult.matchedStudentId && parsedResult.detectedStudentName && groupStudents.length > 0) {
      const detected = parsedResult.detectedStudentName.trim().toLowerCase().replace(/\s+/g, " ");
      const detectedParts = detected.split(" ").filter(Boolean);
      const candidates = groupStudents.filter((s) => {
        const name = s.name.trim().toLowerCase().replace(/\s+/g, " ");
        const code = (s.code || "").trim().toLowerCase();
        if (code && detected === code) return true;
        if (name === detected) return true;
        if (detectedParts.length >= 2 && (name.startsWith(detected) || detected.startsWith(name))) {
          return true;
        }
        return false;
      });
      if (candidates.length === 1) {
        parsedResult.matchedStudentId = candidates[0].id;
        parsedResult.matchedStudentName = candidates[0].name;
      }
    }

    // Auto save if requested and student matched
    let savedGrade = null;
    if (autoSave && examRecordId && parsedResult.matchedStudentId && parsedResult.score !== undefined) {
      savedGrade = saveStudentGrade(
        examRecordId,
        parsedResult.matchedStudentId,
        parsedResult.score,
        parsedResult.notes || "تم الرصد تلقائياً عبر الكاميرا",
        "camera_ai"
      );
    }

    return NextResponse.json({
      success: true,
      data: parsedResult,
      savedGrade,
    });
  } catch (error: any) {
    console.error("AI Grade OCR Error:", error);
    return NextResponse.json(
      { error: error?.message || "حدث خطأ أثناء قراءة ورقة الامتحان" },
      { status: 500 }
    );
  }
}
