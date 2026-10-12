const { execSync } = require('child_process');

const remoteCmd = process.argv.slice(2).join(' ') || 'ls -la /var/www';

try {
  console.log(`Executing on VPS: ${remoteCmd}`);
  const b64 = Buffer.from(remoteCmd, 'utf-8').toString('base64');
  const sshCmd = `ssh -i .vps_ssh/vps_key -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@72.60.44.106 "echo '${b64}' | base64 -d | bash"`;
  const out = execSync(sshCmd, { encoding: 'utf8', stdio: 'pipe' });
  console.log(out);
} catch (err) {
  console.error('SSH Error:', err.message);
  if (err.stdout) console.log('Stdout:', err.stdout);
  if (err.stderr) console.error('Stderr:', err.stderr);
}
