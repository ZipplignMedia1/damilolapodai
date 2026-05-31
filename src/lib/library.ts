// Lightweight local library for images and storyboards (videos stay in history.ts)

export type ImageItem = {
  id: string;
  createdAt: number;
  kind: "image";
  prompt: string;
  dataUrl: string;
  source: "text" | "transform";
};

export type StoryboardScene = {
  scene_number: number;
  title: string;
  description: string;
  visual_prompt: string;
  location?: string;
  wardrobe?: string;
  camera: { angle: string; movement: string };
  lighting: string;
  emotion: string;
};

export type StoryboardItem = {
  id: string;
  createdAt: number;
  kind: "storyboard";
  story_title: string;
  scenes: StoryboardScene[];
};

const IMG_KEY = "damilolapod-images";
const SB_KEY = "damilolapod-storyboards";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, 50)));
  } catch {
    // quota exceeded — drop oldest and retry once
    try {
      localStorage.setItem(key, JSON.stringify(items.slice(0, 20)));
    } catch {
      /* ignore */
    }
  }
}

export function getImages(): ImageItem[] {
  return read<ImageItem>(IMG_KEY);
}
export function addImage(item: ImageItem) {
  write(IMG_KEY, [item, ...getImages()]);
}
export function removeImage(id: string) {
  write(IMG_KEY, getImages().filter((i) => i.id !== id));
}

export function getStoryboards(): StoryboardItem[] {
  return read<StoryboardItem>(SB_KEY);
}
export function addStoryboard(item: StoryboardItem) {
  write(SB_KEY, [item, ...getStoryboards()]);
}
export function removeStoryboard(id: string) {
  write(SB_KEY, getStoryboards().filter((i) => i.id !== id));
}
