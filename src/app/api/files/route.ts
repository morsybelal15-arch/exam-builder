import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getLocalUploadedFiles, addLocalUploadedFile, deleteLocalUploadedFile, getUploadsDir } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for heavy 200MB+ uploads

export async function GET() {
  try {
    const rawFiles = getLocalUploadedFiles();
    const uploadsDir = getUploadsDir();
    // Ensure every file has a valid filepath that can be loaded in the viewer and accurate size
    const files = rawFiles.map((f: any) => {
      let fp = f.filepath;
      if (!fp || fp.trim() === "") {
        fp = `/api/files/content?name=${encodeURIComponent(f.name)}`;
      }
      let realSize = f.size;
      try {
        const diskPath = path.join(uploadsDir, path.basename(f.name));
        if (fs.existsSync(diskPath)) {
          const stats = fs.statSync(diskPath);
          realSize = (stats.size / (1024 * 1024)).toFixed(1) + " ميجابايت";
        }
      } catch {}
      return { ...f, size: realSize, filepath: fp };
    });
    return NextResponse.json({ success: true, files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const uploadMode = req.headers.get("x-upload-mode") || "";
    const rawHeaderFileName = req.headers.get("x-file-name");
    const rawHeaderFileSize = req.headers.get("x-file-size");

    // 0) Direct Binary Streaming Upload (Best for huge 200MB+ files)
    if (uploadMode === "stream" || contentType === "application/octet-stream" || rawHeaderFileName) {
      const decodedName = rawHeaderFileName ? decodeURIComponent(rawHeaderFileName) : "مستند_مرفوع.pdf";
      const safeName = path.basename(decodedName);
      const targetPath = path.join(getUploadsDir(), safeName);

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
        id: `f-${Date.now()}`,
        name: safeName,
        type: fileType,
        size: sizeMb,
        date: "اليوم",
        filepath: `/api/files/content?name=${encodeURIComponent(safeName)}`,
      };

      addLocalUploadedFile(fileRecord);

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
      const targetPath = path.join(getUploadsDir(), safeName);

      // Stream file directly to write stream to prevent node heap overflow on 200MB+ files
      const nodeStream = Readable.fromWeb(file.stream() as any);
      const writeStream = fs.createWriteStream(targetPath);
      await pipeline(nodeStream, writeStream);

      const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + " ميجابايت";
      const isPdf = safeName.toLowerCase().endsWith(".pdf");
      const isWord = safeName.toLowerCase().endsWith(".docx") || safeName.toLowerCase().endsWith(".doc");
      const fileType = isPdf ? "pdf" : isWord ? "word" : "image";

      const fileRecord = {
        id: `f-${Date.now()}`,
        name: safeName,
        type: fileType,
        size: sizeMb,
        date: "اليوم",
        filepath: `/api/files/content?name=${encodeURIComponent(safeName)}`,
      };

      addLocalUploadedFile(fileRecord);

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

    // If base64 payload is provided, save to disk to keep database light & fast
    if (filepath && typeof filepath === "string" && filepath.startsWith("data:")) {
      try {
        const matches = filepath.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const buffer = Buffer.from(matches[2], "base64");
          const targetPath = path.join(getUploadsDir(), safeName);
          fs.writeFileSync(targetPath, buffer);
          finalFilepath = `/api/files/content?name=${encodeURIComponent(safeName)}`;
        }
      } catch (err) {
        console.warn("Could not save base64 to uploads folder, keeping original:", err);
      }
    } else if (!finalFilepath) {
      finalFilepath = `/api/files/content?name=${encodeURIComponent(safeName)}`;
    }

    const fileRecord = {
      id: id || `f-${Date.now()}`,
      name: safeName,
      type: type || (safeName.endsWith(".pdf") ? "pdf" : "image"),
      size: size || "1.0 ميجابايت",
      date: date || "اليوم",
      filepath: finalFilepath,
    };

    addLocalUploadedFile(fileRecord);

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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");
    if (!id && !name) {
      return NextResponse.json({ error: "Missing file ID or name" }, { status: 400 });
    }

    if (id) {
      deleteLocalUploadedFile(id);
    }

    if (name) {
      const safeName = path.basename(name);
      const filePath = path.join(getUploadsDir(), safeName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }

    return NextResponse.json({ success: true, message: "تم حذف الملف بنجاح." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
