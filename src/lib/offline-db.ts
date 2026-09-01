const DB_NAME = "weddingsquirrels-offline";
const STORE = "packs";
const KEY = "current";
export const OFFLINE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Shape of the snapshot produced by GET /api/offline. */
export type OfflinePack = {
  fetchedAt: string;
  weddingDate: string | null;
  coupleNames: string | null;
  timezone: string | null;
  tasks: unknown[];
  people: unknown[];
  timeline: unknown[];
  contacts: unknown[];
  assignments: unknown[];
  guests: unknown[];
  budgetItems: unknown[];
  requests: unknown[];
  shopping: unknown[];
  stay: unknown[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflinePack(pack: OfflinePack): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(pack, KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadOfflinePack(): Promise<OfflinePack | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as OfflinePack | undefined) ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function clearOfflinePack(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function shouldRefreshOfflinePack(
  fetchedAt: string | null | undefined,
  now = new Date(),
  intervalMs = OFFLINE_SYNC_INTERVAL_MS,
): boolean {
  if (!fetchedAt) return true;
  const savedAt = new Date(fetchedAt).getTime();
  if (!Number.isFinite(savedAt)) return true;
  return now.getTime() - savedAt >= intervalMs;
}

export function formatFetchedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
