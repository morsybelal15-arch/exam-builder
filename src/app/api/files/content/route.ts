import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { getUploadsDir } from "@/lib/db";
import { requireApiSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) {
      return new NextResponse("File name required", { status: 400 });
    }

    const safeName = path.basename(name);
    const candidatePaths = [
      path.join(/*turbopackIgnore: true*/ getUploadsDir(session.id), safeName),
      path.join(/*turbopackIgnore: true*/ getUploadsDir("default"), safeName),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", safeName),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
        const buffer = fs.readFileSync(/*turbopackIgnore: true*/ filePath);
        const ext = path.extname(safeName).toLowerCase();
        const contentType =
          ext === ".svg" ? "image/svg+xml" :
          ext === ".png" ? "image/png" :
          ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
          ext === ".webp" ? "image/webp" :
          ext === ".pdf" ? "application/pdf" : "application/octet-stream";

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    return new NextResponse("File not found", { status: 404 });
  } catch (err: any) {
    return new NextResponse(`Error reading file: ${err.message}`, { status: 500 });
  }
}
