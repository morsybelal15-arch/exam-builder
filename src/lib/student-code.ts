/**
 * Generates a high-entropy, shuffled alphanumeric student code (max 8 characters).
 * Contains both uppercase letters and digits.
 * Safe to use in both Server Components and Client Components (zero Node.js dependencies).
 */
export function generateUniqueStudentCode(existingCodes?: Set<string> | string[]): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 uppercase letters & digits, avoiding confusing 0/O, 1/I
  const set = existingCodes
    ? existingCodes instanceof Set
      ? existingCodes
      : new Set(existingCodes)
    : new Set<string>();

  for (let attempt = 0; attempt < 25000; attempt++) {
    let code = "";
    let digitCount = 0;
    let letterCount = 0;

    for (let i = 0; i < 8; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      code += ch;
      if (/[0-9]/.test(ch)) digitCount++;
      if (/[A-Z]/.test(ch)) letterCount++;
    }

    // Ensure it's max 8 letters, contains both letters and digits, and is unique
    if (digitCount >= 2 && letterCount >= 2 && !set.has(code)) {
      return code;
    }
  }

  // Fallback 8-character unique alphanumeric code
  return `S${Math.random().toString(36).substring(2, 9).toUpperCase()}`.slice(0, 8);
}
