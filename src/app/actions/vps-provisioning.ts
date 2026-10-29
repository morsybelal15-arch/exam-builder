"use server";

import fs from "fs";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import {
  HOSTINGER_VPS_CONFIG,
  TENANT_APP_PORT,
  ADMIN_APP_PORT,
  DEFAULT_ADMIN_HOST,
  CERTBOT_EMAIL,
  generateTenantWildcardNginx,
  generateAdminNginx,
} from "@/lib/vps-service";
import { updateTenantRecord, getTenantsList } from "@/lib/tenants-repository";
import {
  runOnVps,
  isLocalExec,
  syncTenantsToVps,
  provisionTenantDomain,
  checkTenantDomainOnVps,
  SSH_KEY_PATH,
  VPS_APP_DIR,
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
const DEPLOY_LOG = "/var/log/exam-builder-deploy.log";

function b64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

/**
 * Builds the full deployment script:
 * pull → env files → install/build → PM2 (tenant :3015 + admin :3016) → Nginx (tenant wildcard
 * + dedicated admin vhost) → Let's Encrypt for the admin domain → health checks.
 */
function buildDeployScript(): string {
  const rawAdminHost = (process.env.ADMIN_HOST || DEFAULT_ADMIN_HOST).trim().toLowerCase();
  const adminHost = rawAdminHost.replace(/[^a-z0-9.-]/g, "") || DEFAULT_ADMIN_HOST;
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const geminiKeys = process.env.GEMINI_API_KEYS || "";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Shared, non-secret runtime config. Mode / port / secrets come from ecosystem.config.js + .env.tenant/.env.admin.
  const envLocalLines = [
    `GEMINI_API_KEY="${geminiKey}"`,
    ...(geminiKeys ? [`GEMINI_API_KEYS="${geminiKeys}"`] : []),
    `GEMINI_MODEL="${geminiModel}"`,
  ];
  const envLocal = envLocalLines.join("\n") + "\n";

  // Admin credentials are pushed from the deploying admin's own environment (never from git).
  const adminPhone = (process.env.ADMIN_PHONE || "").replace(/[\r\n]/g, "");
  const adminHash = (process.env.ADMIN_PASSWORD_HASH || "").replace(/[\r\n]/g, "");
  const adminName = (process.env.ADMIN_NAME || "").replace(/[\r\n]/g, "");
  const adminCreds =
    adminPhone && adminHash
      ? `ADMIN_PHONE=${adminPhone}\nADMIN_PASSWORD_HASH=${adminHash}\nADMIN_HOST=${adminHost}\n${adminName ? `ADMIN_NAME=${adminName}\n` : ""}`
      : "";

  return `
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
APP_DIR=${VPS_APP_DIR}
ADMIN_HOST=${adminHost}
CERT=/etc/letsencrypt/live/$ADMIN_HOST/fullchain.pem

mkdir -p $APP_DIR
cd $APP_DIR

if [ ! -d ".git" ]; then
  echo "[1/6] Cloning repository..."
  git clone ${REPO_URL} .
else
  echo "[1/6] Pulling latest updates..."
  git fetch origin main
  git reset --hard origin/main
fi

echo "[2/6] Writing environment files..."
rm -f .env
if [ ! -f .env.local ]; then
  echo '${b64(envLocal)}' | base64 -d > .env.local
fi
mkdir -p data/tenants

# Tenant app secret (generated once, kept across deploys)
if ! grep -qs '^SESSION_SECRET=' .env.tenant; then
  echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env.tenant
fi

# Admin app: credentials + its own secret (secret generated once, kept across deploys)
ADMIN_SECRET=$(grep -s '^SESSION_SECRET=' .env.admin | head -1 | cut -d= -f2- || true)
[ -z "$ADMIN_SECRET" ] && ADMIN_SECRET=$(openssl rand -hex 32)
ADMIN_CREDS_B64='${b64(adminCreds)}'
if [ -n "$ADMIN_CREDS_B64" ]; then
  echo "$ADMIN_CREDS_B64" | base64 -d > .env.admin.tmp
else
  (grep -sv '^SESSION_SECRET=' .env.admin || true) > .env.admin.tmp
fi
echo "SESSION_SECRET=$ADMIN_SECRET" >> .env.admin.tmp
mv .env.admin.tmp .env.admin
chmod 600 .env.admin .env.tenant
grep -qs '^ADMIN_PASSWORD_HASH=' .env.admin || echo "[warn] ADMIN_PHONE / ADMIN_PASSWORD_HASH not configured — admin login disabled"

echo "[3/6] Installing & building..."
npm install --include=dev --no-audit --no-fund
npx prisma generate
npm run build

echo "[4/6] (Re)starting PM2 apps (tenant :${TENANT_APP_PORT}, admin :${ADMIN_APP_PORT})..."
if [ ! -f .pm2-ecosystem ]; then
  # one-time migration from the legacy single "npm start" process
  pm2 delete exam-builder >/dev/null 2>&1 || true
  touch .pm2-ecosystem
fi
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "[5/6] Configuring Nginx (tenant wildcard + admin domain)..."
echo '${b64(generateTenantWildcardNginx())}' | base64 -d > /etc/nginx/sites-available/exam-builder
ln -sf /etc/nginx/sites-available/exam-builder /etc/nginx/sites-enabled/exam-builder
mkdir -p /var/www/html
if [ -f "$CERT" ]; then
  echo '${b64(generateAdminNginx(adminHost, true))}' | base64 -d > /etc/nginx/sites-available/exam-admin
else
  echo '${b64(generateAdminNginx(adminHost, false))}' | base64 -d > /etc/nginx/sites-available/exam-admin
fi
ln -sf /etc/nginx/sites-available/exam-admin /etc/nginx/sites-enabled/exam-admin
nginx -t
systemctl reload nginx

if [ ! -f "$CERT" ]; then
  if command -v certbot >/dev/null 2>&1; then
    if certbot certonly --webroot -w /var/www/html -d $ADMIN_HOST --non-interactive --agree-tos -m ${CERTBOT_EMAIL}; then
      echo '${b64(generateAdminNginx(adminHost, true))}' | base64 -d > /etc/nginx/sites-available/exam-admin
      nginx -t && systemctl reload nginx
      echo "[ssl] HTTPS enabled for $ADMIN_HOST"
    else
      echo "[ssl] certbot failed for $ADMIN_HOST (check that DNS points to this server) — admin stays on HTTP for now"
    fi
  else
    echo "[ssl] certbot not installed — run: apt install -y certbot"
  fi
fi

echo "[6/6] Health checks..."
sleep 6
T=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${TENANT_APP_PORT}/login || echo 000)
A=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $ADMIN_HOST" http://127.0.0.1:${ADMIN_APP_PORT}/login || echo 000)
X=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${TENANT_APP_PORT}/admin || echo 000)
echo "[health] tenant=$T admin=$A tenant_admin_path=$X"
echo DEPLOY_COMPLETE_SUCCESS
`;
}

/**
 * One-click full deployment of Exam Builder (tenant + admin apps) to the VPS.
 *
 * - From a dev machine: runs synchronously over SSH and reports health.
 * - From the admin app on the VPS itself: runs detached in the background, because the
 *   script reloads this very process (results go to /var/log/exam-builder-deploy.log).
 */
export async function deployExamBuilderToVpsAction(): Promise<VpsDeployResult> {
  await requireSuperAdmin();

  const local = isLocalExec();
  if (!local && !fs.existsSync(SSH_KEY_PATH)) {
    return {
      success: false,
      message: "مفتاح SSH للاتصال بالسيرفر غير موجود.",
      error: "لم يتم العثور على .vps_ssh/vps_key",
    };
  }

  const script = buildDeployScript();

  if (local) {
    try {
      await runOnVps(
        `cat > /tmp/exam-builder-deploy.sh <<'EB_DEPLOY_EOF'\n${script}\nEB_DEPLOY_EOF\n` +
          `setsid nohup bash /tmp/exam-builder-deploy.sh > ${DEPLOY_LOG} 2>&1 < /dev/null &\necho STARTED`,
        20_000
      );
      return {
        success: true,
        message: "بدأ النشر في الخلفية. ستُعاد تشغيل لوحة الإدارة خلال 2-4 دقائق — حدّث الصفحة بعدها.",
        logs: [`سجل النشر على الخادم: ${DEPLOY_LOG}`],
      };
    } catch (err: any) {
      return { success: false, message: "تعذر بدء النشر على الخادم.", error: err.message };
    }
  }

  const logs: string[] = [`الاتصال بخادم Hostinger VPS (${HOSTINGER_VPS_CONFIG.ip})...`];
  try {
    const { stdout } = await runOnVps(script, 15 * 60 * 1000);
    logs.push(...stdout.split("\n").filter((l) => l.startsWith("[") || l.includes("DEPLOY")));

    if (!stdout.includes("DEPLOY_COMPLETE_SUCCESS")) {
      return { success: false, message: "لم يكتمل النشر على خادم VPS.", logs };
    }

    // First-time migration only: pushes local tenants.json when the VPS has none yet.
    const sync = await syncTenantsToVps({ force: true });
    logs.push(sync.message);

    const health = stdout.match(/\[health\] tenant=(\d+) admin=(\d+) tenant_admin_path=(\d+)/);
    const ok = health ? health[1] === "200" && health[2] === "200" : false;
    return {
      success: ok,
      message: ok
        ? "تم نشر منصة المعلمين ولوحة الإدارة المركزية على خادم VPS بنجاح!"
        : "اكتمل النشر لكن أحد التطبيقين لم يستجب بعد. أعد الفحص بعد قليل.",
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
  await requireSuperAdmin();

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

    const sync = await syncTenantsToVps({ force: true });
    logs.push(sync.message);

    const health = await checkTenantDomainOnVps(cleanDomain);
    logs.push(health.message);

    revalidatePath("/admin");
    return {
      success: health.online,
      message: health.online
        ? `تم تفعيل (${cleanDomain}) ومزامنة بيانات الدخول — المنصة تعمل الآن`
        : `تم إعداد النطاق لكن ${health.message}. استخدم زر "نشر المنصة على VPS" أولاً.`,
      domainUrl: `https://${cleanDomain}`,
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
 * Manually force-push the local tenant store to the VPS (overwrites the server copy).
 * Only meaningful from a dev machine; on the VPS the store is already shared.
 */
export async function syncAllTenantsToVpsAction(): Promise<VpsDeployResult> {
  await requireSuperAdmin();
  const res = await syncTenantsToVps({ force: true });
  const tenants = await getTenantsList();
  let domainsProvisioned = 0;
  for (const t of tenants) {
    if (t.domain && t.domain.trim()) {
      const domRes = await provisionTenantDomain(t.domain);
      if (domRes.synced) domainsProvisioned++;
    }
  }
  return {
    success: res.synced,
    message:
      domainsProvisioned > 0
        ? `${res.message} (وتم تأمين وتفعيل ${domainsProvisioned} دومين بـ HTTPS ✓)`
        : res.message,
  };
}

/**
 * Checks that the tenant domain is served by Exam Builder (checked from inside the VPS).
 */
export async function checkDomainStatusAction(domain: string): Promise<{
  isOnline: boolean;
  statusCode?: number;
  message: string;
}> {
  await requireSuperAdmin();
  const res = await checkTenantDomainOnVps(domain);
  return { isOnline: res.online, message: res.message };
}
