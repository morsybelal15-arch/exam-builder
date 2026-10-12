"use server";

import fs from "fs";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import { updateTenantRecord } from "@/lib/tenants-repository";
import {
  runOnVps,
  syncTenantsToVps,
  provisionTenantDomain,
  checkTenantDomainOnVps,
  SSH_KEY_PATH,
  VPS_APP_DIR,
  VPS_APP_PORT,
} from "@/lib/vps-sync";

export interface VpsDeployResult {
  success: boolean;
  message: string;
  step?: string;
  domainUrl?: string;
  error?: string;
  logs?: string[];
}

const REPO_URL = "https://github.com/morsybelal15-arch/exam-builder.git";

async function assertSuperAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("غير مصرح لك بتنفيذ هذه العملية. يتطلب صلاحية مدير النظام.");
  }
}

/**
 * One-click full deployment of Exam Builder to the VPS:
 * pull code → install → build → (re)start PM2 on port 3015 → wildcard Nginx →
 * push tenant accounts → health check.
 */
export async function deployExamBuilderToVpsAction(): Promise<VpsDeployResult> {
  await assertSuperAdmin();

  if (!fs.existsSync(SSH_KEY_PATH)) {
    return {
      success: false,
      message: "مفتاح SSH للاتصال بالسيرفر غير موجود.",
      error: "لم يتم العثور على .vps_ssh/vps_key",
    };
  }

  const logs: string[] = [`الاتصال بخادم Hostinger VPS (${HOSTINGER_VPS_CONFIG.ip})...`];
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  // Tenant accounts live in data/tenants.json (synced from this admin panel),
  // so DATABASE_URL is intentionally NOT set on the VPS.
  const envFile = `GEMINI_API_KEY="${geminiKey}"\nGEMINI_MODEL="${geminiModel}"\nPORT=${VPS_APP_PORT}\n`;
  const envB64 = Buffer.from(envFile, "utf-8").toString("base64");

  const nginxWildcard = `server {
    listen 80;
    listen [::]:80;
    server_name *.oqabagency.com *.alasima-erp.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${VPS_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
  const nginxB64 = Buffer.from(nginxWildcard, "utf-8").toString("base64");

  const remoteScript = `
set -e
mkdir -p ${VPS_APP_DIR}
cd ${VPS_APP_DIR}

if [ ! -d ".git" ]; then
  echo "[1/5] Cloning repository..."
  git clone ${REPO_URL} .
else
  echo "[1/5] Pulling latest updates..."
  git fetch origin main
  git reset --hard origin/main
fi

echo "[2/5] Writing environment..."
rm -f .env
echo '${envB64}' | base64 -d > .env.local
mkdir -p data

echo "[3/5] Installing & building..."
npm install --no-audit --no-fund
npx prisma generate
npm run build

echo "[4/5] (Re)starting PM2 on port ${VPS_APP_PORT}..."
pm2 delete exam-builder >/dev/null 2>&1 || true
PORT=${VPS_APP_PORT} pm2 start npm --name exam-builder -- start
pm2 save

echo "[5/5] Configuring Nginx wildcard proxy..."
echo '${nginxB64}' | base64 -d > /etc/nginx/sites-available/exam-builder
ln -sf /etc/nginx/sites-available/exam-builder /etc/nginx/sites-enabled/exam-builder
nginx -t
systemctl reload nginx
echo DEPLOY_COMPLETE_SUCCESS
`;

  try {
    const { stdout } = await runOnVps(remoteScript, 15 * 60 * 1000);
    logs.push(...stdout.split("\n").filter((l) => l.startsWith("[") || l.includes("DEPLOY")));

    if (!stdout.includes("DEPLOY_COMPLETE_SUCCESS")) {
      return { success: false, message: "لم يكتمل النشر على خادم VPS.", logs };
    }

    // Push tenant accounts so logins work right after deployment
    const sync = await syncTenantsToVps();
    logs.push(sync.message);

    // Give Next.js a few seconds to boot before checking health
    await new Promise((r) => setTimeout(r, 6000));
    const health = await runOnVps(
      `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${VPS_APP_PORT}/login || echo 000`,
      20_000
    );
    const code = health.stdout.trim();
    logs.push(`فحص صحة التطبيق على المنفذ ${VPS_APP_PORT}: HTTP ${code}`);

    return {
      success: code === "200",
      message:
        code === "200"
          ? "تم نشر المنصة على خادم VPS ومزامنة حسابات المستأجرين بنجاح!"
          : `اكتمل النشر لكن التطبيق لم يستجب بعد (HTTP ${code}). أعد الفحص بعد قليل.`,
      logs,
    };
  } catch (err: any) {
    logs.push("خطأ: " + err.message);
    return {
      success: false,
      message: "فشل تنفيذ النشر التلقائي على خادم VPS.",
      error: err.message,
      logs,
    };
  }
}

/**
 * One-click tenant activation: saves the domain, routes it in Nginx, pushes the tenant
 * accounts to the VPS and verifies the app answers on that domain.
 */
export async function autoDeployTenantVpsAction(
  tenantId: string,
  domain: string
): Promise<VpsDeployResult> {
  await assertSuperAdmin();

  const cleanDomain = domain.trim().toLowerCase();
  if (!cleanDomain) {
    return { success: false, message: "يرجى تحديد الدومين المطلوب تفعيله" };
  }

  const logs: string[] = [];
  try {
    await updateTenantRecord(tenantId, { domain: cleanDomain });

    const domainRes = await provisionTenantDomain(cleanDomain);
    logs.push(domainRes.message);
    if (!domainRes.synced) {
      return { success: false, message: domainRes.message, logs };
    }

    const sync = await syncTenantsToVps();
    logs.push(sync.message);
    if (!sync.synced) {
      return { success: false, message: sync.message, logs };
    }

    const health = await checkTenantDomainOnVps(cleanDomain);
    logs.push(health.message);

    revalidatePath("/admin");
    return {
      success: health.online,
      message: health.online
        ? `تم تفعيل (${cleanDomain}) ومزامنة بيانات الدخول — المنصة تعمل الآن`
        : `تم إعداد النطاق لكن ${health.message}. استخدم زر "نشر المنصة على VPS" أولاً.`,
      domainUrl: `http://${cleanDomain}`,
      logs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `حدث خطأ أثناء ربط الدومين (${cleanDomain}) على خادم VPS`,
      error: err.message,
      logs,
    };
  }
}

/**
 * Manually re-push all tenant accounts / subscriptions to the VPS.
 */
export async function syncAllTenantsToVpsAction(): Promise<VpsDeployResult> {
  await assertSuperAdmin();
  const res = await syncTenantsToVps();
  return { success: res.synced, message: res.message };
}

/**
 * Checks that the tenant domain is served by Exam Builder (checked from inside the VPS).
 */
export async function checkDomainStatusAction(domain: string): Promise<{
  isOnline: boolean;
  statusCode?: number;
  message: string;
}> {
  await assertSuperAdmin();
  const res = await checkTenantDomainOnVps(domain);
  return { isOnline: res.online, message: res.message };
}
