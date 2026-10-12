#!/usr/bin/env bash
set -e

echo "=== [1/5] Setting up Exam Builder Directory ==="
mkdir -p /var/www/exam-builder
cd /var/www/exam-builder

if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/morsybelal15-arch/exam-builder.git .
else
    echo "Pulling latest changes..."
    git pull origin main
fi

echo "=== [2/5] Installing Dependencies & Building ==="
npm install --production=false
npx prisma generate
npm run build

echo "=== [3/5] Starting Application with PM2 on Port 3000 ==="
pm2 delete exam-builder 2>/dev/null || true
pm2 start npm --name "exam-builder" -- start
pm2 save

echo "=== [4/5] Configuring Nginx Reverse Proxy for All Tenant Domains ==="
cat << 'EOF' > /etc/nginx/sites-available/exam-builder
server {
    listen 80;
    listen [::]:80;
    server_name *.oqabagency.com *.alasima-erp.com hossam.oqabagency.com;

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
EOF

ln -sf /etc/nginx/sites-available/exam-builder /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "=== [5/5] Deployment Finished Successfully! ==="
echo "Tenant domains *.oqabagency.com and *.alasima-erp.com are now live on VPS!"
