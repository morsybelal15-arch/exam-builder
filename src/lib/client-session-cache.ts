"use client";

const SESSION_STORAGE_KEY = "eb_tenant_session_cache_v1";
const PAGE_CACHE_PREFIX = "eb_page_cache_v1:";

let memorySessionCache: { host: string; data: any; updatedAt: number } | null = null;
const memoryPageCache = new Map<string, { data: any; updatedAt: number }>();

function getHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.host.toLowerCase();
}

export function getCachedSession(): any | null {
  if (typeof window === "undefined") return null;
  const host = getHost();
  if (memorySessionCache && memorySessionCache.host === host) {
    return memorySessionCache.data;
  }
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.host === host && parsed.data && parsed.data.authenticated) {
      memorySessionCache = {
        host,
        data: parsed.data,
        updatedAt: parsed.updatedAt || 0,
      };
      return parsed.data;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function getLastSessionFetchTime(): number {
  if (memorySessionCache && memorySessionCache.host === getHost()) {
    return memorySessionCache.updatedAt;
  }
  return 0;
}

export function setCachedSession(data: any): void {
  if (typeof window === "undefined" || !data || !data.authenticated) return;
  const host = getHost();
  const prevId = memorySessionCache?.data?.id;
  if (prevId && data.id && prevId !== data.id) {
    memoryPageCache.clear();
  }
  const now = Date.now();
  memorySessionCache = { host, data, updatedAt: now };
  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ host, data, updatedAt: now })
    );
  } catch {
    // ignore storage errors
  }
}

function getTenantScope(): string {
  const session = getCachedSession();
  const tid = session?.id || "default";
  return `${getHost()}:${tid}`;
}

export function clearCachedSession(): void {
  memorySessionCache = null;
  memoryPageCache.clear();
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PAGE_CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function getCachedPageData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const scopedKey = `${PAGE_CACHE_PREFIX}${getTenantScope()}:${key}`;
  const mem = memoryPageCache.get(scopedKey);
  if (mem) return mem.data as T;

  try {
    const raw = sessionStorage.getItem(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data !== undefined) {
      memoryPageCache.set(scopedKey, { data: parsed.data, updatedAt: parsed.updatedAt || Date.now() });
      return parsed.data as T;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setCachedPageData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  const scopedKey = `${PAGE_CACHE_PREFIX}${getTenantScope()}:${key}`;
  const now = Date.now();
  memoryPageCache.set(scopedKey, { data, updatedAt: now });
  try {
    sessionStorage.setItem(scopedKey, JSON.stringify({ data, updatedAt: now }));
  } catch {
    // ignore quota errors
  }
}

export function invalidateCachedPageData(keyPrefix?: string): void {
  if (typeof window === "undefined") return;
  const hostPrefix = `${PAGE_CACHE_PREFIX}${getTenantScope()}:${keyPrefix || ""}`;
  for (const k of Array.from(memoryPageCache.keys())) {
    if (k.startsWith(hostPrefix)) {
      memoryPageCache.delete(k);
    }
  }
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(hostPrefix)) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

