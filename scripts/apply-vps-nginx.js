const { execSync } = require('child_process');

const nginxConfig = `server {
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
`;

const b64 = Buffer.from(nginxConfig, 'utf-8').toString('base64');
const remoteScript = `echo '${b64}' | base64 -d > /etc/nginx/sites-available/exam-builder && ln -sf /etc/nginx/sites-available/exam-builder /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx`;

console.log('Deploying Nginx config to VPS 72.60.44.106...');
try {
  const result = execSync(`ssh -i .vps_ssh/vps_key -o StrictHostKeyChecking=no root@72.60.44.106 "${remoteScript}"`, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  console.log('Result:', result);
  console.log('Nginx configuration successfully deployed and reloaded!');
} catch (err) {
  console.error('Error applying Nginx configuration:', err.message);
  if (err.stdout) console.log('Stdout:', err.stdout);
  if (err.stderr) console.error('Stderr:', err.stderr);
  process.exit(1);
}
