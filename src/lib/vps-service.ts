/**
 * Hostinger VPS & DNS Integration Service
 * Target VPS: 72.60.44.106 (srv1792816.hstgr.cloud - KVM 2, Ubuntu 24.04)
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

/**
 * Generates an Nginx Reverse Proxy block for a tenant's domain pointing to the Next.js app port (3000)
 */
export function generateNginxConfig(domain: string): string {
  const cleanDomain = domain.trim().toLowerCase();
  return `# Nginx Virtual Host for Tenant: ${cleanDomain}
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
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
# SSL Command: certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos -m admin@alasima-erp.com
`;
}

/**
 * Generates Docker Compose snippet for multi-tenant deployment
 */
export function generateDockerConfig(domain: string, tenantId: string): string {
  return `# VPS Deployment Configuration for ${domain}
# Run on VPS: ssh root@72.60.44.106
mkdir -p /var/www/tenants/${tenantId}
cat << 'EOF' > /etc/nginx/sites-available/${domain}
${generateNginxConfig(domain)}
EOF
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d ${domain} --non-interactive --agree-tos -m admin@alasima-erp.com --redirect
`;
}
