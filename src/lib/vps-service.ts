/**
 * Hostinger VPS & DNS Integration Service
 * Target VPS: 72.60.44.106 (srv1792816.hstgr.cloud - KVM 2, Ubuntu 24.04)
 *
 * NOTE: imported by client components too — keep this file free of Node-only APIs.
 */

export interface VpsInfo {
  id: number;
  ip: string;
  hostname: string;
  plan: string;
  os: string;
  status: string;
}

export const HOSTINGER_VPS_CONFIG: VpsInfo = {
  id: 1792816,
  ip: "72.60.44.106",
  hostname: "srv1792816.hstgr.cloud",
  plan: "KVM 2 (2 vCPU, 8GB RAM, 100GB NVMe)",
  os: "Ubuntu 24.04 LTS",
  status: "running",
};

/** PM2 process "exam-builder" (APP_MODE=tenant) — serves every teacher domain. */
export const TENANT_APP_PORT = 3015;
/** PM2 process "exam-admin" (APP_MODE=admin) — serves only the admin domain. */
export const ADMIN_APP_PORT = 3016;
/** The one and only Super Admin domain. */
export const DEFAULT_ADMIN_HOST = "examsappadmin.oqabagency.com";
/** Wildcard tenant domains routed to the tenant app. */
export const TENANT_WILDCARD_SERVER_NAMES = "*.oqabagency.com *.alasima-erp.com";
export const CERTBOT_EMAIL = "admin@alasima-erp.com";

function proxyLocation(port: number): string {
  return `    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }`;
}

/**
 * Generates an Nginx Reverse Proxy block for a tenant's domain pointing to the tenant app.
 */
export function generateNginxConfig(domain: string): string {
  const cleanDomain = domain.trim().toLowerCase();
  return `# Nginx Virtual Host for Tenant: ${cleanDomain}
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};

    client_max_body_size 50M;

${proxyLocation(TENANT_APP_PORT)}
}
# SSL Command: certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos -m ${CERTBOT_EMAIL}
`;
}

/** Catch-all vhost for every wildcard tenant subdomain. */
export function generateTenantWildcardNginx(): string {
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${TENANT_WILDCARD_SERVER_NAMES};

    client_max_body_size 50M;

${proxyLocation(TENANT_APP_PORT)}
}
`;
}

/**
 * Vhost for the dedicated admin domain. An exact server_name always wins over the
 * *.oqabagency.com wildcard, so this never collides with tenant routing.
 *  - withSsl=false: HTTP only + ACME webroot (used until the certificate exists)
 *  - withSsl=true : HTTP→HTTPS redirect + TLS vhost
 */
export function generateAdminNginx(host: string, withSsl: boolean): string {
  const acme = `    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }`;

  if (!withSsl) {
    return `# Exam Builder — Super Admin domain (HTTP, awaiting certificate)
server {
    listen 80;
    listen [::]:80;
    server_name ${host};

    client_max_body_size 50M;
    add_header X-Robots-Tag "noindex, nofollow" always;

${acme}

${proxyLocation(ADMIN_APP_PORT)}
}
`;
  }

  return `# Exam Builder — Super Admin domain (HTTPS only)
server {
    listen 80;
    listen [::]:80;
    server_name ${host};

${acme}

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${host};

    ssl_certificate /etc/letsencrypt/live/${host}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${host}/privkey.pem;

    if ($host != "${host}") {
        return 444;
    }

    client_max_body_size 50M;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Robots-Tag "noindex, nofollow" always;

${proxyLocation(ADMIN_APP_PORT)}
}
`;
}

/**
 * Generates the manual setup commands for a tenant domain (shown in the admin UI).
 */
export function generateDockerConfig(domain: string, tenantId: string): string {
  return `# VPS Deployment Configuration for ${domain}
# Run on VPS: ssh root@${HOSTINGER_VPS_CONFIG.ip}
mkdir -p /var/www/tenants/${tenantId}
cat << 'EOF' > /etc/nginx/sites-available/${domain}
${generateNginxConfig(domain)}
EOF
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d ${domain} --non-interactive --agree-tos -m ${CERTBOT_EMAIL} --redirect
`;
}
