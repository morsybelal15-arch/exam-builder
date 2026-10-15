#!/usr/bin/env bash
# Manual fallback for the in-app "Ù†Ø´Ø± Ø§Ù„Ù…Ù†ØµØ© Ø¹Ù„Ù‰ VPS" button.
# Builds ONE release and runs TWO PM2 apps (see ecosystem.config.js):
#   exam-builder (tenant, :3015) â†’ all teacher domains
#   exam-admin   (admin,  :3016) â†’ exambuilderadmin.oqabagency.com only
set -e

ADMIN_HOST="${ADMIN_HOST:-exambuilderadmin.oqabagency.com}"
APP_DIR=/var/www/exam-builder

echo "=== [1/5] Setting up Exam Builder Directory ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/morsybelal15-arch/exam-builder.git .
else
    echo "Pulling latest changes..."
    git fetch origin main
    git reset --hard origin/main
fi

grep -qs '^SESSION_SECRET=' .env.tenant || echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env.tenant
grep -qs '^SESSION_SECRET=' .env.admin  || echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env.admin
grep -qs '^ADMIN_PASSWORD_HASH=' .env.admin || echo "WARNING: add ADMIN_PHONE and ADMIN_PASSWORD_HASH to $APP_DIR/.env.admin"
chmod 600 .env.tenant .env.admin

echo "=== [2/5] Installing Dependencies & Building ==="
npm install --production=false
npx prisma generate
npm run build

echo "=== [3/5] Starting tenant + admin apps with PM2 ==="
if [ ! -f .pm2-ecosystem ]; then
    pm2 delete exam-builder 2>/dev/null || true
    touch .pm2-ecosystem
fi
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "=== [4/5] Configuring Nginx ==="
cat << 'EOF' > /etc/nginx/sites-available/exam-builder
server {
    listen 80;
    listen [::]:80;
    server_name *.oqabagency.com *.alasima-erp.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3015;
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

# Admin domain: exact server_name beats the *.oqabagency.com wildcard.
mkdir -p /var/www/html
if [ -f "/etc/letsencrypt/live/${ADMIN_HOST}/fullchain.pem" ]; then
cat << EOF > /etc/nginx/sites-available/exam-admin
server {
    listen 80;
    listen [::]:80;
    server_name ${ADMIN_HOST};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${ADMIN_HOST};

    ssl_certificate /etc/letsencrypt/live/${ADMIN_HOST}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${ADMIN_HOST}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        proxy_pass http://127.0.0.1:3016;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
else
cat << EOF > /etc/nginx/sites-available/exam-admin
server {
    listen 80;
    listen [::]:80;
    server_name ${ADMIN_HOST};

    client_max_body_size 50M;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3016;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
fi
ln -sf /etc/nginx/sites-available/exam-admin /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "=== [5/5] Deployment Finished ==="
echo "Tenant domains â†’ :3015 | Admin â†’ http://${ADMIN_HOST} (:3016)"
echo "For HTTPS on the admin domain use the in-app deploy button, or: certbot --nginx -d ${ADMIN_HOST} --redirect"
