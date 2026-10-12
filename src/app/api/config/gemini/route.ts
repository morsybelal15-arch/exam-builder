import { NextRequest, NextResponse } from "next/server";
import { testGeminiKey, resolveApiKey, friendlyGeminiError } from "@/lib/gemini";
import fs from "node:fs";
import path from "node:path";



export async function GET(req: NextRequest) {
  const headerKey = req.headers.get("x-gemini-key");
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const key = (headerKey || "").trim() || envKey;

  return NextResponse.json({
    configured: Boolean(key && key.length > 10),
    hasEnvKey: Boolean(envKey && envKey.length > 10),
    keyMasked: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
  });
}

export async function POST(req: NextRequest) {
  let body: { apiKey?: string; saveToEnv?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير صالح." }, { status: 400 });
  }

  const apiKey = (body.apiKey || "").trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "يرجى إدخال مفتاح Gemini API." },
      { status: 400 }
    );
  }

  // Verify the key
  const testRes = await testGeminiKey(apiKey);
  if (!testRes.valid) {
    return NextResponse.json(
      { success: false, error: testRes.error || "المفتاح غير صالح." },
      { status: 400 }
    );
  }

  // Optionally persist to .env.local
  if (body.saveToEnv !== false) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = "";
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf-8");
      }
      if (/^GEMINI_API_KEY=/m.test(content)) {
        content = content.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY="${apiKey}"`);
      } else {
        content += (content.endsWith("\n") || !content ? "" : "\n") + `GEMINI_API_KEY="${apiKey}"\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
      process.env.GEMINI_API_KEY = apiKey;
    } catch (e) {
      console.warn("[config/gemini] Unable to write .env.local:", e);
    }
  }

  return NextResponse.json({
    success: true,
    message: "تم التحقق من مفتاح Gemini بنجاح وتفعيله!",
    model: testRes.model,
  });
}
