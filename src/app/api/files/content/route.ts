import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { getUploadsDir } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) {
      return new NextResponse("File name required", { status: 400 });
    }

    const safeName = path.basename(name);
    const filePath = path.join(getUploadsDir(), safeName);

    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
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
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Fallback: check public directory (e.g. sample-textbook.svg)
    const publicPath = path.join(process.cwd(), "public", safeName);
    if (fs.existsSync(publicPath)) {
      const buffer = fs.readFileSync(publicPath);
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
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return new NextResponse("File not found", { status: 404 });
  } catch (err: any) {
    return new NextResponse(`Error reading file: ${err.message}`, { status: 500 });
  }
}
