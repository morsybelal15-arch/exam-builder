/**
 * Unified storage formatting & quota calculation helpers.
 * - Storage limits are configured in Megabytes (MB).
 * - Actual consumption is measured down to the Kilobyte (KB) so even a single
 *   created exam or student record is accurately reflected on the progress bar.
 */

export const DEFAULT_STORAGE_LIMIT_MB = 100;
export const DEFAULT_STORAGE_LIMIT_BYTES = DEFAULT_STORAGE_LIMIT_MB * 1024 * 1024;

export function toNumberBytes(bytes: bigint | number | string | null | undefined): number {
  if (bytes === null || bytes === undefined) return 0;
  const n = typeof bytes === "bigint" ? Number(bytes) : Number(bytes);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Formats actual used storage in Arabic, showing Kilobytes (كيلوبايت) when < 1 MB,
 * or Megabytes + Kilobytes when >= 1 MB.
 */
export function formatUsedStorageArabic(bytes: bigint | number | null | undefined): string {
  const num = toNumberBytes(bytes);
  if (num <= 0) return "0 كيلوبايت";

  const kb = num / 1024;
  if (kb < 1) {
    return `${Math.max(0.1, Number(kb.toFixed(2)))} كيلوبايت`;
  }
  if (kb < 1024) {
    return `${kb.toFixed(1)} كيلوبايت`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(2)} ميجابايت (${Math.round(kb).toLocaleString("en-US")} كيلوبايت)`;
}

/**
 * Short Arabic format for Sidebar & compact cards (shows KB under 1 MB, MB above 1 MB).
 */
export function formatUsedStorageShortArabic(bytes: bigint | number | null | undefined): string {
  const num = toNumberBytes(bytes);
  if (num <= 0) return "0 كيلوبايت";

  const kb = num / 1024;
  if (kb < 1) {
    return `${Math.max(0.1, Number(kb.toFixed(2)))} كيلوبايت`;
  }
  if (kb < 1024) {
    return `${kb.toFixed(1)} كيلوبايت`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(2)} ميجابايت`;
}

/**
 * Formats the storage limit in Megabytes (ميجابايت).
 */
export function formatStorageLimitMbArabic(limitBytes: bigint | number | null | undefined): string {
  const num = toNumberBytes(limitBytes);
  if (num <= 0) return `${DEFAULT_STORAGE_LIMIT_MB} ميجابايت`;
  const mb = Math.max(1, Math.round(num / (1024 * 1024)));
  return `${mb} ميجابايت`;
}

export function bytesToMb(limitBytes: bigint | number | null | undefined): number {
  const num = toNumberBytes(limitBytes);
  if (num <= 0) return DEFAULT_STORAGE_LIMIT_MB;
  return Math.max(1, Math.round(num / (1024 * 1024)));
}

/**
 * Computes the exact percentage of storage used (0 to 100), preserving decimals for small KB usage.
 */
export function computeStoragePercent(
  usedBytes: bigint | number | null | undefined,
  limitBytes: bigint | number | null | undefined
): {
  exactPercent: number;
  barWidthPercent: number;
  displayPercent: string;
} {
  const used = toNumberBytes(usedBytes);
  const limit = Math.max(1, toNumberBytes(limitBytes) || DEFAULT_STORAGE_LIMIT_BYTES);

  if (used <= 0) {
    return { exactPercent: 0, barWidthPercent: 0, displayPercent: "0%" };
  }

  const rawPct = (used / limit) * 100;
  const clamped = Math.min(100, Math.max(0, rawPct));
  const barWidthPercent = clamped > 0 && clamped < 2 ? 2 : Math.round(clamped * 10) / 10;

  let displayPercent: string;
  if (clamped < 0.1) {
    displayPercent = `${clamped.toFixed(2)}%`;
  } else if (clamped < 10) {
    displayPercent = `${clamped.toFixed(1)}%`;
  } else {
    displayPercent = `${Math.round(clamped)}%`;
  }

  return {
    exactPercent: clamped,
    barWidthPercent,
    displayPercent,
  };
}

