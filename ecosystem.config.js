/**
 * PM2 process file â€” ONE build, TWO processes:
 *
 *   exam-builder  APP_MODE=tenant  127.0.0.1:3015  â†’ every teacher domain (Nginx wildcard + tenant vhosts)
 *   exam-admin    APP_MODE=admin   127.0.0.1:3016  â†’ only exambuilderadmin.oqabagency.com
 *
 * Secrets are NOT stored in git. They are read from server-only files next to this one
 * (both are created/updated by the "deploy to VPS" action and ignored by .gitignore):
 *   .env.tenant  â†’ SESSION_SECRET
 *   .env.admin   â†’ SESSION_SECRET, ADMIN_PHONE, ADMIN_PASSWORD_HASH, ADMIN_HOST, ADMIN_NAME
 *
 * Usage on the VPS:  pm2 startOrReload ecosystem.config.js --update-env && pm2 save
 */
const fs = require("fs");
const path = require("path");

function readEnvFile(name) {
  const out = {};
  try {
    const raw = fs.readFileSync(path.join(__dirname, name), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[m[1]] = value;
    }
  } catch {
    // file missing â†’ defaults only
  }
  return out;
}

const NEXT_BIN = "node_modules/next/dist/bin/next";

module.exports = {
  apps: [
    {
      name: "exam-builder",
      cwd: __dirname,
      script: NEXT_BIN,
      interpreter: "node",
      args: "start -p 3015 -H 127.0.0.1",
      env: {
        NODE_ENV: "production",
        APP_MODE: "tenant",
        PORT: "3015",
        ...readEnvFile(".env.tenant"),
      },
    },
    {
      name: "exam-admin",
      cwd: __dirname,
      script: NEXT_BIN,
      interpreter: "node",
      args: "start -p 3016 -H 127.0.0.1",
      env: {
        NODE_ENV: "production",
        APP_MODE: "admin",
        PORT: "3016",
        ADMIN_HOST: "exambuilderadmin.oqabagency.com",
        // The admin lives on the VPS â†’ run provisioning scripts locally instead of over SSH.
        VPS_LOCAL_EXEC: "1",
        ...readEnvFile(".env.admin"),
      },
    },
  ],
};
