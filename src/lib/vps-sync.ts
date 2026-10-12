import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import { exportRawTenantStore } from "@/lib/tenants-repository";

export const VPS_APP_DIR = "/var/www/exam-builder";
export const SSH_KEY_PATH = path.join(process.cwd(), ".vps_ssh", "vps_key");

export interface VpsSyncResult {
  synced: boolean;
  message: string;
}

/**
 * Runs a bash script on the VPS over SSH.
 * The script is streamed through stdin (base64-encoded), so there are no shell quoting /
 * $variable expansion problems and no Windows command-line length limits.
 */
export function runOnVps(script: string, timeoutMs = 30_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SSH_KEY_PATH)) {
      reject(new Error("مفتاح SSH للاتصال بالسيرفر غير موجود (.vps_ssh/vps_key)"));
      return;
    }

    const child = spawn(
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
      else reject(new Error((stderr || stdout || `SSH exited with code ${code}`).trim().slice(-1500)));
    });

    child.stdin.write(Buffer.from(script, "utf-8").toString("base64"));
    child.stdin.end();
  });
}

/**
 * Pushes the full tenant store (accounts, password hashes, subscription status,
 * due dates and limits) to the VPS so the live tenant apps see admin changes immediately.
 * The tenant app reads data/tenants.json on every request, so no restart is needed.
 */
export async function syncTenantsToVps(): Promise<VpsSyncResult> {
  try {
    const tenants = exportRawTenantStore();
    const json = JSON.stringify(tenants, null, 2);
    const jsonB64 = Buffer.from(json, "utf-8").toString("base64");

    const script = `
set -e
mkdir -p ${VPS_APP_DIR}/data
echo '${jsonB64}' | base64 -d > ${VPS_APP_DIR}/data/tenants.json.tmp
mv ${VPS_APP_DIR}/data/tenants.json.tmp ${VPS_APP_DIR}/data/tenants.json
echo SYNC_OK
`;
    const { stdout } = await runOnVps(script);
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

export const VPS_APP_PORT = 3015;

/**
 * Idempotently creates an Nginx virtual host for a tenant domain that proxies to the
 * Exam Builder app on port 3015, validates the config and reloads Nginx.
 */
export async function provisionTenantDomain(domain: string): Promise<VpsSyncResult> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
    return { synced: false, message: `اسم النطاق غير صالح: ${domain}` };
  }

  const nginx = `server {
    listen 80;
    listen [::]:80;
    server_name ${clean};

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
  const nginxB64 = Buffer.from(nginx, "utf-8").toString("base64");
  const conf = `/etc/nginx/sites-available/exam-tenant-${clean}`;

  const script = `
set -e
echo '${nginxB64}' | base64 -d > ${conf}
ln -sf ${conf} /etc/nginx/sites-enabled/
if nginx -t 2>/tmp/nginx_test.log; then
  systemctl reload nginx
  echo DOMAIN_OK
else
  rm -f /etc/nginx/sites-enabled/exam-tenant-${clean}
  cat /tmp/nginx_test.log
  exit 1
fi
`;
  try {
    const { stdout } = await runOnVps(script);
    if (!stdout.includes("DOMAIN_OK")) {
      return { synced: false, message: `تعذر تأكيد تفعيل النطاق ${clean}` };
    }
    return { synced: true, message: `تم تفعيل النطاق ${clean} على خادم VPS` };
  } catch (err: any) {
    return { synced: false, message: `فشل تفعيل النطاق ${clean}: ` + (err?.message?.split("\n")[0] || "") };
  }
}

/**
 * Checks from inside the VPS that the tenant domain is served by the Exam Builder app
 * (bypasses local DNS / ISP caching on the admin machine).
 */
export async function checkTenantDomainOnVps(domain: string): Promise<{ online: boolean; message: string }> {
  const clean = domain.trim().toLowerCase();
  const script = `
code=$(curl -s -o /tmp/eb_check.html -w '%{http_code}' -H 'Host: ${clean}' http://127.0.0.1/login || echo 000)
if grep -q 'منصة إعداد الاختبارات' /tmp/eb_check.html 2>/dev/null; then echo "APP_OK $code"; else echo "APP_MISSING $code"; fi
`;
  try {
    const { stdout } = await runOnVps(script, 20_000);
    if (stdout.includes("APP_OK")) return { online: true, message: "المنصة تعمل على النطاق بنجاح" };
    return { online: false, message: "النطاق لا يعرض منصة الاختبارات بعد (" + stdout.trim() + ")" };
  } catch (err: any) {
    return { online: false, message: "تعذر الفحص: " + (err?.message?.split("\n")[0] || "") };
  }
}
