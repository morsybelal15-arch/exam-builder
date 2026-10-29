import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getLocalUploadedFiles, addLocalUploadedFile, deleteLocalUploadedFile, getUploadsDir } from "@/lib/db";
import { requireApiSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for heavy 200MB+ uploads

function resolveUniqueDiskName(dir: string, baseName: string): string {
  const safeBase = path.basename(baseName);
  const candidate = path.join(dir, safeBase);
  if (!fs.existsSync(candidate)) {
    return safeBase;
  }
  const ext = path.extname(safeBase);
  const stem = path.basename(safeBase, ext);
  return `${stem}_${Date.now()}${ext}`;
}

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const rawFiles = getLocalUploadedFiles(session.id);
    const uploadsDir = getUploadsDir(session.id);
    const defaultUploadsDir = getUploadsDir("default");

    const files = rawFiles.map((f: any) => {
      let fp = f.filepath;
      if (!fp || fp.trim() === "") {
        fp = `/api/files/content?name=${encodeURIComponent(f.name)}`;
      }
      let realSize = f.size;
      try {
        const diskName = fp.includes("?name=")
          ? decodeURIComponent(fp.split("?name=").pop() || f.name)
          : path.basename(f.name);
        const diskPath = fs.existsSync(path.join(uploadsDir, diskName))
          ? path.join(uploadsDir, diskName)
          : path.join(defaultUploadsDir, diskName);
        if (fs.existsSync(diskPath)) {
          const stats = fs.statSync(diskPath);
          realSize = (stats.size / (1024 * 1024)).toFixed(1) + " ميجابايت";
        }
      } catch { }
      return { ...f, size: realSize, filepath: fp };
    });
    return NextResponse.json({ success: true, files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const tenantUploadsDir = getUploadsDir(session.id);
    const contentType = req.headers.get("content-type") || "";
    const uploadMode = req.headers.get("x-upload-mode") || "";
    const rawHeaderFileName = req.headers.get("x-file-name");
    const rawHeaderFileSize = req.headers.get("x-file-size");

    // 0) Direct Binary Streaming Upload (Best for huge 200MB+ files)
    if (uploadMode === "stream" || contentType === "application/octet-stream" || rawHeaderFileName) {
      const decodedName = rawHeaderFileName ? decodeURIComponent(rawHeaderFileName) : "مستند_مرفوع.pdf";
      const safeName = path.basename(decodedName);
      const diskName = resolveUniqueDiskName(tenantUploadsDir, safeName);
      const targetPath = path.join(tenantUploadsDir, diskName);

      if (!req.body) {
        return NextResponse.json({ error: "لا يوجد محتوى في تدفق الملف." }, { status: 400 });
      }

      const nodeStream = Readable.fromWeb(req.body as any);
      const writeStream = fs.createWriteStream(targetPath);
      await pipeline(nodeStream, writeStream);

      const stats = fs.statSync(targetPath);
      let bytes = stats.size;
      if (rawHeaderFileSize && !isNaN(Number(rawHeaderFileSize))) {
        bytes = Math.max(bytes, Number(rawHeaderFileSize));
      }
      const sizeMb = (bytes / (1024 * 1024)).toFixed(1) + " ميجابايت";
      const isPdf = safeName.toLowerCase().endsWith(".pdf");
      const isWord = safeName.toLowerCase().endsWith(".docx") || safeName.toLowerCase().endsWith(".doc");
      const fileType = isPdf ? "pdf" : isWord ? "word" : "image";

      const fileRecord = {
        id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: safeName,
        type: fileType,
        size: sizeMb,
        size_bytes: bytes,
        date: "اليوم",
        filepath: `/api/files/content?name=${encodeURIComponent(diskName)}`,
      };

      addLocalUploadedFile(fileRecord, session.id);

      return NextResponse.json({
        success: true,
        message: "تم حفظ الملف بنجاح عبر التدفق المباشر.",
        file: fileRecord,
      });
    }

    // 1) Multipart Form Data Upload (Stream-piped to disk without buffering all MBs in memory)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "لم يتم إرسال أي ملف." }, { status: 400 });
      }

      const fileName = file.name || "مستند_جديد.png";
      const safeName = path.basename(fileName);
      const diskName = resolveUniqueDiskName(tenantUploadsDir, safeName);
      const targetPath = path.join(tenantUploadsDir, diskName);

      // Stream file directly to write stream to prevent node heap overflow on 200MB+ files
      const nodeStream = Readable.fromWeb(file.stream() as any);
      const writeStream = fs.createWriteStream(targetPath);
      await pipeline(nodeStream, writeStream);

      const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + " ميجابايت";
      const isPdf = safeName.toLowerCase().endsWith(".pdf");
      const isWord = safeName.toLowerCase().endsWith(".docx") || safeName.toLowerCase().endsWith(".doc");
      const fileType = isPdf ? "pdf" : isWord ? "word" : "image";

      const fileRecord = {
        id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: safeName,
        type: fileType,
        size: sizeMb,
        size_bytes: file.size,
        date: "اليوم",
        filepath: `/api/files/content?name=${encodeURIComponent(diskName)}`,
      };

      addLocalUploadedFile(fileRecord, session.id);

      return NextResponse.json({
        success: true,
        message: "تم حفظ الملف بنجاح.",
        file: fileRecord,
      });
    }

    // 2) JSON Upload (with base64 or filepath)
    const body = await req.json();
    const { id, name, type, size, date, filepath } = body;
    const safeName = path.basename(name || "ملف_جديد.png");

    let finalFilepath = filepath || "";
    let sizeBytes = 0;

    // If base64 payload is provided, save to disk to keep database light & fast
    if (filepath && typeof filepath === "string" && filepath.startsWith("data:")) {
      try {
        const matches = filepath.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const buffer = Buffer.from(matches[2], "base64");
          sizeBytes = buffer.length;
          const diskName = resolveUniqueDiskName(tenantUploadsDir, safeName);
          const targetPath = path.join(tenantUploadsDir, diskName);
          fs.writeFileSync(targetPath, buffer);
          finalFilepath = `/api/files/content?name=${encodeURIComponent(diskName)}`;
        }
      } catch (err) {
        console.warn("Could not save base64 to uploads folder, keeping original:", err);
      }
    } else if (!finalFilepath) {
      finalFilepath = `/api/files/content?name=${encodeURIComponent(safeName)}`;
    }

    const fileRecord = {
      id: id || `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: safeName,
      type: type || (safeName.endsWith(".pdf") ? "pdf" : "image"),
      size: size || (sizeBytes > 0 ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} ميجابايت` : "1.0 ميجابايت"),
      size_bytes: sizeBytes,
      date: date || "اليوم",
      filepath: finalFilepath,
    };

    addLocalUploadedFile(fileRecord, session.id);

    return NextResponse.json({
      success: true,
      message: "تم تسجيل الملف في قاعدة البيانات المحلية.",
      file: fileRecord,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");
    if (!id && !name) {
      return NextResponse.json({ error: "Missing file ID or name" }, { status: 400 });
    }

    let deletedRecord: any = null;
    if (id) {
      deletedRecord = deleteLocalUploadedFile(id, session.id);
    }

    const candidateNames = new Set<string>();
    if (name) {
      candidateNames.add(path.basename(name));
    }
    if (deletedRecord?.filepath && typeof deletedRecord.filepath === "string" && deletedRecord.filepath.includes("?name=")) {
      const fromUrl = decodeURIComponent(deletedRecord.filepath.split("?name=").pop() || "");
      if (fromUrl) candidateNames.add(path.basename(fromUrl));
    }
    if (deletedRecord?.name) {
      candidateNames.add(path.basename(deletedRecord.name));
    }

    const tenantUploadsDir = getUploadsDir(session.id);
    const defaultUploadsDir = getUploadsDir("default");

    for (const safeName of candidateNames) {
      for (const dir of [tenantUploadsDir, defaultUploadsDir]) {
        const filePath = path.join(dir, safeName);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch { }
        }
      }
    }

    return NextResponse.json({ success: true, message: "تم حذف الملف بنجاح." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
