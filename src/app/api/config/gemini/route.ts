import { NextRequest, NextResponse } from "next/server";
import { testGeminiKey, resolveApiKeyPool } from "@/lib/gemini";
import { requireApiSession } from "@/lib/auth";
import fs from "node:fs";
import path from "node:path";

export async function GET(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const headerKey = (req.headers.get("x-gemini-key") || "").trim();
  const serverPool = resolveApiKeyPool();
  const hasEnvKey = serverPool.length > 0;
  const activeKey = headerKey || serverPool[0] || "";
  const isSuperAdmin = session.role === "SUPER_ADMIN";

  return NextResponse.json({
    configured: Boolean(activeKey && activeKey.length > 10),
    hasEnvKey,
    ...(isSuperAdmin ? { poolSize: serverPool.length } : {}),
    keyMasked: hasEnvKey ? "مفعل ومؤمن على السيرفر" : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
  }
  let body: { apiKey?: string; saveToEnv?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير صالح." }, { status: 400 });
  }

  const apiKey = (body.apiKey || "").replace(/[\r\n"'`$\\]/g, "").trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "يرجى إدخال مفتاح الربط." },
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

  // Only persist to global .env.local when Super Admin
  const canWriteServerEnv = session.role === "SUPER_ADMIN";
  if (body.saveToEnv !== false && canWriteServerEnv) {
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
    message: "تم التحقق من المفتاح بنجاح وتفعيله!",
    model: testRes.model,
  });
}
