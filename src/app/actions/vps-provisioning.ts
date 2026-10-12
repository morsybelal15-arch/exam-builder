"use server";

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { getSessionUser } from "@/lib/auth";
import { HOSTINGER_VPS_CONFIG } from "@/lib/vps-service";
import { updateTenantRecord } from "@/lib/tenants-repository";

const execAsync = promisify(exec);

export interface VpsDeployResult {
  success: boolean;
  message: string;
  step?: string;
  domainUrl?: string;
  error?: string;
  logs?: string[];
}

const SSH_KEY_PATH = path.join(process.cwd(), ".vps_ssh", "vps_key");
const VPS_PORT = 3015; // Dedicated port for Exam Builder (3000 is used by cerrah-website)

/**
 * Asserts SUPER_ADMIN session
 */
async function assertSuperAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("غير مصرح لك بتنفيذ هذه العملية. يتطلب صلاحية مدير النظام.");
  }
}

/**
 * Automatically provisions and deploys Exam Builder on the VPS on port 3015
 * and sets up the Nginx reverse proxy for tenant domains.
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

  const logs: string[] = [];

  try {
    logs.push("بدء الاتصال بخادم Hostinger VPS (" + HOSTINGER_VPS_CONFIG.ip + ")...");

    // Script to run on the VPS:
    // 1. Pull / Clone repo to /var/www/exam-builder
    // 2. npm install & build
    // 3. Start PM2 on port 3015
    // 4. Configure Nginx virtual host proxying to 127.0.0.1:3015
    const remoteScript = `
set -e
mkdir -p /var/www/exam-builder
cd /var/www/exam-builder

if [ ! -d ".git" ]; then
    echo "[1/4] Cloning repository..."
    git clone https://github.com/morsybelal15-arch/exam-builder.git .
else
    echo "[1/4] Pulling latest updates..."
    git pull origin main
fi

cat << ENV_EOF > .env.local
DATABASE_URL="postgresql://exam_builder:ExamBuilder2026!@127.0.0.1:5432/exam_builder_db?schema=public"
GEMINI_API_KEY="${process.env.GEMINI_API_KEY || ''}"
GEMINI_MODEL="gemini-3.5-flash-lite"
PORT=${VPS_PORT}
ENV_EOF

echo "[2/4] Generating Prisma client & pushing schema..."
npm install --production=false
npx prisma generate
npx prisma db push --skip-generate
npm run build

echo "[3/4] Starting PM2 process on port ${VPS_PORT}..."
pm2 delete exam-builder 2>/dev/null || true
PORT=${VPS_PORT} pm2 start npm --name "exam-builder" -- start
pm2 save

echo "[4/4] Updating Nginx reverse proxy configuration..."
cat << 'NGINX_EOF' > /etc/nginx/sites-available/exam-builder
server {
    listen 80;
    listen [::]:80;
    server_name *.oqabagency.com *.alasima-erp.com hossam.oqabagency.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${VPS_PORT};
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
NGINX_EOF

ln -sf /etc/nginx/sites-available/exam-builder /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
echo "DEPLOY_COMPLETE_SUCCESS"
`;

    const b64 = Buffer.from(remoteScript).toString("base64");
    const sshCmd = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@${HOSTINGER_VPS_CONFIG.ip} "echo '${b64}' | base64 -d | bash"`;

    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 120000 });
    logs.push(stdout || stderr);

    return {
      success: true,
      message: "تم تثبيت وتشغيل المنصة على خادم VPS وتفعيل Nginx بنجاح!",
      logs,
    };
  } catch (err: any) {
    logs.push("خطأ: " + err.message);
    return {
      success: false,
      message: "فشل تنفيذ أمر التثبيت التلقائي على خادم VPS.",
      error: err.message,
      logs,
    };
  }
}

/**
 * Automates domain setup for a specific tenant:
 * 1. Configures Nginx virtual host for this specific domain pointing to port 3015.
 * 2. Reloads Nginx.
 * 3. Tests reachability.
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
    logs.push(`إعداد Nginx للنطاق: ${cleanDomain}...`);

    const nginxBlock = `server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${VPS_PORT};
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

    const b64 = Buffer.from(nginxBlock).toString("base64");
    const remoteCmd = `echo '${b64}' | base64 -d > /etc/nginx/sites-available/${cleanDomain} && ln -sf /etc/nginx/sites-available/${cleanDomain} /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx && echo 'SUCCESS'`;

    const sshCmd = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@${HOSTINGER_VPS_CONFIG.ip} "${remoteCmd}"`;

    if (fs.existsSync(SSH_KEY_PATH)) {
      const { stdout } = await execAsync(sshCmd, { timeout: 30000 });
      logs.push(stdout);
    }

    // Update tenant record with domain
    await updateTenantRecord(tenantId, { domain: cleanDomain });

    return {
      success: true,
      message: `تم تفعيل وإطلاق الدومين (${cleanDomain}) على خادم VPS بنجاح!`,
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
 * Checks if a domain is live and returns HTTP status
 */
export async function checkDomainStatusAction(domain: string): Promise<{
  isOnline: boolean;
  statusCode?: number;
  message: string;
}> {
  try {
    const clean = domain.trim().toLowerCase();
    const url = clean.startsWith("http") ? clean : `http://${clean}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    return {
      isOnline: res.status < 400,
      statusCode: res.status,
      message: res.status < 400 ? "النطاق نشط ويعمل بنجاح" : `رمز الاستجابة: ${res.status}`,
    };
  } catch (err: any) {
    return {
      isOnline: false,
      message: "تعذر الاتصال بالنطاق حالياً: " + (err.message || "Timeout"),
    };
  }
}
