// Usage: node scripts/hash-admin-password.mjs "YourNewStrongPassword"
// Prints a value for ADMIN_PASSWORD_HASH (scrypt, no "$" characters → safe in .env files).
import { scryptSync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Usage: node scripts/hash-admin-password.mjs "<password of at least 10 chars>"');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
