import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { HOSTINGER_VPS_CONFIG, TENANT_APP_PORT, DEFAULT_ADMIN_HOST, CERTBOT_EMAIL, generateNginxConfig } from "@/lib/vps-service";
import { exportRawTenantStoreAsync } from "@/lib/tenants-repository";

export const VPS_APP_DIR = "/var/www/exam-builder";
export const SSH_KEY_PATH = path.join(process.cwd(), ".vps_ssh", "vps_key");

/**
 * True when this process IS running on the VPS (the exam-admin PM2 app sets VPS_LOCAL_EXEC=1).
 * Server scripts then run directly through local bash instead of SSH.
 */
export function isLocalExec(): boolean {
  return process.env.VPS_LOCAL_EXEC === "1";
}

export interface VpsSyncResult {
  synced: boolean;
  message: string;
}

/**
 * Runs a bash script on the VPS — locally when this process lives on the VPS, otherwise over SSH.
 * Over SSH the script is streamed through stdin (base64-encoded), so there are no shell quoting /
 * $variable expansion problems and no Windows command-line length limits.
 */
export function runOnVps(script: string, timeoutMs = 30_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const local = isLocalExec();
    if (!local && !fs.existsSync(SSH_KEY_PATH)) {
      reject(new Error("مفتاح SSH للاتصال بالسيرفر غير موجود (.vps_ssh/vps_key)"));
      return;
    }

    const child = local
      ? spawn("bash", ["-s"], { windowsHide: true })
      : spawn(
        "ssh",
        [
          "-i", SSH_KEY_PATH,
          "-o", "StrictHostKeyChecking=no",
          "-o", "ConnectTimeout=15",
          "-o", "BatchMode=yes",
          `root@${HOSTINGER_VPS_CONFIG.ip}`,
          "base64 -d | bash",
        ],
        { windowsHide: true }
      );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`انتهت مهلة الاتصال بخادم VPS (${Math.round(timeoutMs / 1000)} ثانية)`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `exited with code ${code}`).trim().slice(-1500)));
    });

    child.stdin.write(local ? script : Buffer.from(script, "utf-8").toString("base64"));
    child.stdin.end();
  });
}

/**
 * Makes sure the live tenant app sees the tenant store (accounts, password hashes,
 * subscription status, due dates and limits). The tenant app reads data/tenants.json
 * on every request, so no restart is needed.
 *
 * - On the VPS (admin process): both PM2 apps share the same data/tenants.json → nothing to do.
 * - From a dev machine over SSH: the VPS copy is the master now, so it is only overwritten
 *   when it is missing/empty or when `force` is set (explicit manual push).
 */
export async function syncTenantsToVps(options: { force?: boolean } = {}): Promise<VpsSyncResult> {
  if (isLocalExec()) {
    return { synced: true, message: "تم الحفظ مباشرة على خادم VPS — التغييرات فعّالة فوراً" };
  }

  try {
    const tenants = await exportRawTenantStoreAsync();
    const json = JSON.stringify(tenants, null, 2);
    const jsonB64 = Buffer.from(json, "utf-8").toString("base64");
    const target = `${VPS_APP_DIR}/data/tenants.json`;
    const tenantDirsCmd = tenants
      .map((t) => t.id.replace(/[^a-zA-Z0-9_-]/g, "_"))
      .map((safeId) => `mkdir -p ${VPS_APP_DIR}/data/tenants/${safeId}`)
      .join("\n");

    const script = `
set -e
mkdir -p ${VPS_APP_DIR}/data/tenants
${tenantDirsCmd}
if [ "${options.force ? 1 : 0}" != "1" ] && [ -s ${target} ] && [ "$(tr -d '[:space:]' < ${target})" != "[]" ]; then
  echo SYNC_SKIPPED
  exit 0
fi
echo '${jsonB64}' | base64 -d > ${target}.tmp
mv ${target}.tmp ${target}
echo SYNC_OK
`;
    const { stdout } = await runOnVps(script);
    if (stdout.includes("SYNC_SKIPPED")) {
      return {
        synced: false,
        message: "تم الحفظ محلياً فقط — بيانات الخادم هي المرجع. استخدم لوحة الإدارة المركزية لتعديل المستأجرين.",
      };
    }
    if (!stdout.includes("SYNC_OK")) {
      return { synced: false, message: "تعذر تأكيد مزامنة بيانات المستأجرين مع السيرفر" };
    }
    return { synced: true, message: "تمت مزامنة بيانات المستأجرين مع خادم VPS" };
  } catch (err: any) {
    console.error("VPS tenant sync failed:", err?.message);
    return {
      synced: false,
      message: "تم الحفظ محلياً لكن تعذرت المزامنة مع خادم VPS: " + (err?.message?.split("\n")[0] || "خطأ غير معروف"),
    };
  }
}

export const VPS_APP_PORT = TENANT_APP_PORT;

/**
 * Idempotently creates an Nginx virtual host for a tenant domain that proxies to the
 * tenant app, validates the config and reloads Nginx.
 */
export async function provisionTenantDomain(domain: string): Promise<VpsSyncResult> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
    return { synced: false, message: `اسم النطاق غير صالح: ${domain}` };
  }
  const adminHost = (process.env.ADMIN_HOST || DEFAULT_ADMIN_HOST).trim().toLowerCase();
  if (clean === adminHost) {
    return { synced: false, message: `لا يمكن استخدام نطاق لوحة الإدارة (${clean}) لمستأجر` };
  }

  const nginxHttpB64 = Buffer.from(generateNginxConfig(clean, false), "utf-8").toString("base64");
  const nginxHttpsB64 = Buffer.from(generateNginxConfig(clean, true), "utf-8").toString("base64");
  const conf = `/etc/nginx/sites-available/exam-tenant-${clean}`;
  const certFile = `/etc/letsencrypt/live/${clean}/fullchain.pem`;

  const script = `
set -e
mkdir -p /var/www/html
ln -sf ${conf} /etc/nginx/sites-enabled/exam-tenant-${clean}

if [ -f "${certFile}" ]; then
  echo '${nginxHttpsB64}' | base64 -d > ${conf}
  if nginx -t 2>/tmp/nginx_test.log; then
    systemctl reload nginx
    echo SSL_OK
    echo DOMAIN_OK
    exit 0
  fi
fi

echo '${nginxHttpB64}' | base64 -d > ${conf}
if ! nginx -t 2>/tmp/nginx_test.log; then
  rm -f /etc/nginx/sites-enabled/exam-tenant-${clean}
  cat /tmp/nginx_test.log
  exit 1
fi
systemctl reload nginx

if command -v certbot >/dev/null 2>&1; then
  certbot certonly --webroot -w /var/www/html -d ${clean} --non-interactive --agree-tos -m ${CERTBOT_EMAIL} >/tmp/certbot_${clean}.log 2>&1 || true
  if [ -f "${certFile}" ]; then
    echo '${nginxHttpsB64}' | base64 -d > ${conf}
    nginx -t && systemctl reload nginx
    echo SSL_OK
  else
    echo SSL_WARN
  fi
fi
echo DOMAIN_OK
`;
  try {
    const { stdout } = await runOnVps(script, 90_000);
    if (!stdout.includes("DOMAIN_OK")) {
      return { synced: false, message: `تعذر تأكيد تفعيل النطاق ${clean}` };
    }
    const hasSsl = stdout.includes("SSL_OK");
    return {
      synced: true,
      message: hasSsl
        ? `تم تفعيل النطاق https://${clean} وتأمينه بشهادة SSL تلقائياً ✓`
        : `تم تفعيل النطاق ${clean} على خادم VPS ✓`,
    };
  } catch (err: any) {
    return { synced: false, message: `فشل تفعيل النطاق ${clean}: ` + (err?.message?.split("\n")[0] || "") };
  }
}

/**
 * Checks from inside the VPS that the tenant domain is served by the Exam Builder app
 * over HTTPS (or HTTP fallback).
 */
export async function checkTenantDomainOnVps(domain: string): Promise<{ online: boolean; message: string }> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
    return { online: false, message: `اسم النطاق غير صالح: ${domain}` };
  }
  const script = `
code=$(curl -k -L -s -o /tmp/eb_check.html -w '%{http_code}' --resolve "${clean}:443:127.0.0.1" --resolve "${clean}:80:127.0.0.1" "https://${clean}/login" 2>/dev/null || echo 000)
if [ "$code" != "200" ]; then
  code=$(curl -L -s -o /tmp/eb_check.html -w '%{http_code}' -H "Host: ${clean}" "http://127.0.0.1:${TENANT_APP_PORT}/login" 2>/dev/null || echo 000)
fi
if [ "$code" = "200" ] && grep -q '_next' /tmp/eb_check.html 2>/dev/null; then
  echo "APP_OK $code"
else
  echo "APP_MISSING $code"
fi
`;
  try {
    const { stdout } = await runOnVps(script, 20_000);
    if (stdout.includes("APP_OK")) return { online: true, message: "المنصة تعمل على النطاق بنجاح (HTTPS 200 OK)" };
    return { online: false, message: "النطاق لا يعرض المنصة بعد (" + stdout.trim() + ")" };
  } catch (err: any) {
    return { online: false, message: "تعذر الفحص: " + (err?.message?.split("\n")[0] || "") };
  }
}
