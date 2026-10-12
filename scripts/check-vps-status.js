const { execSync } = require('child_process');

try {
  const cmd = `ssh -i .vps_ssh/vps_key -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@72.60.44.106 "pm2 list; echo '--- NGINX SITES ---'; ls -la /etc/nginx/sites-enabled/; echo '--- NGINX TEST ---'; nginx -t; echo '--- PORTS ---'; netstat -tlpn 2>/dev/null || ss -tlpn"`;
  const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  console.log(out);
} catch (e) {
  console.error('Error executing SSH:', e.message);
  if (e.stdout) console.log('Stdout:', e.stdout);
  if (e.stderr) console.error('Stderr:', e.stderr);
}
