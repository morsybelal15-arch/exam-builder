"use server";

import { exec } from "child_process";
import { promisify } from "util";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";

const execAsync = promisify(exec);

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface AutoUpdateResult {
  success: boolean;
  message: string;
  output?: string;
  error?: string;
  commit?: GitCommitInfo;
  vpsCommand?: string;
}

export async function getLatestCommitInfo(): Promise<GitCommitInfo | null> {
  try {
    const { stdout } = await execAsync('git log -1 --format="%h|%s|%an|%ar"', {
      cwd: process.cwd(),
    });
    const parts = stdout.trim().split("|");
    if (parts.length >= 4) {
      return {
        hash: parts[0],
        message: parts[1],
        author: parts[2],
        date: parts[3],
      };
    }
  } catch (err) {
    console.error("Error fetching git commit info:", err);
  }
  return null;
}

export async function updateAppFromRepoAction(): Promise<AutoUpdateResult> {
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    return {
      success: false,
      message: "غير مصرح لك بتنفيذ هذه العملية.",
      error: "يتطلب صلاحية مدير النظام (SUPER_ADMIN)",
    };
  }

  const vpsCommand = 'ssh root@72.60.44.106 "cd /var/www/exam-builder && git pull origin main && docker compose restart app"';

  try {
    // 1. Pull latest code from GitHub origin main
    const { stdout: pullOutput, stderr: pullErr } = await execAsync(
      "git pull origin main",
      { cwd: process.cwd(), timeout: 30000 }
    );

    // 2. Fetch updated commit info
    const commit = await getLatestCommitInfo();

    // 3. Clear Next.js cache
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/exam-builder");

    return {
      success: true,
      message: "تم تحديث الكود وسحب أحدث التعديلات من المستودع بنجاح!",
      output: pullOutput || pullErr,
      commit: commit || undefined,
      vpsCommand,
    };
  } catch (err: any) {
    console.error("Auto-update failed:", err);
    return {
      success: false,
      message: "حدث خطأ أثناء محاولة التحديث من المستودع.",
      error: err.message || "فشل تنفيذ أمر git pull",
      vpsCommand,
    };
  }
}
