export type HistoryItem = {
  id: string;
  createdAt: number;
  mode: "text" | "image";
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  duration: number;
  videoUrl: string;
  thumbnail?: string;
};

const KEY = "damilolapod-history";

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: HistoryItem) {
  const items = [item, ...getHistory()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function removeFromHistory(id: string) {
  const items = getHistory().filter(i => i.id !== id);
  localStorage.setItem(KEY, JSON.stringify(items));
}
