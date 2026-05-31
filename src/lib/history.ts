export type HistoryItem = {
  id: string;
  createdAt: number;
  mode: "text" | "image";
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  duration: number;
  videoUrl: string;
  videoBlobKey?: string;
  thumbnail?: string;
};

const KEY = "damilolapod-history";
const DB_NAME = "damilolapod-videos";
const STORE_NAME = "videos";

function openVideoDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function saveVideoBlob(id: string, blob: Blob) {
  const db = await openVideoDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

async function getVideoBlob(id: string): Promise<Blob | null> {
  const db = await openVideoDb();
  if (!db) return null;
  const blob = await new Promise<Blob | null>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => resolve(null);
  });
  db.close();
  return blob;
}

async function deleteVideoBlob(id: string) {
  const db = await openVideoDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function getHistoryWithVideos(): Promise<HistoryItem[]> {
  const items = getHistory();
  return Promise.all(items.map(async (item) => {
    if (!item.videoBlobKey) return item;
    const blob = await getVideoBlob(item.videoBlobKey);
    return blob ? { ...item, videoUrl: URL.createObjectURL(blob) } : item;
  }));
}

export async function addToHistory(item: HistoryItem, videoBlob?: Blob) {
  if (videoBlob) await saveVideoBlob(item.id, videoBlob);
  const items = [item, ...getHistory()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(items));
}

export async function removeFromHistory(id: string) {
  await deleteVideoBlob(id);
  const items = getHistory().filter(i => i.id !== id);
  localStorage.setItem(KEY, JSON.stringify(items));
}
