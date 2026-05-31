// Supabase-backed library for images, videos and storyboards.
import { supabase } from "@/integrations/supabase/client";

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

export type VideoItem = {
  id: string;
  createdAt: number;
  kind: "video";
  prompt: string;
  videoUrl: string;
  thumbnail?: string;
  aspectRatio?: string;
  duration?: number;
  mode?: "text" | "image";
};

type Row = {
  id: string;
  kind: "image" | "video" | "storyboard";
  title: string | null;
  prompt: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchKind<T>(kind: Row["kind"], map: (r: Row) => T): Promise<T[]> {
  const uid = await userId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("library_items")
    .select("*")
    .eq("user_id", uid)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map(map);
}

// ---------- Images ----------
export async function getImages(): Promise<ImageItem[]> {
  return fetchKind<ImageItem>("image", (r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    kind: "image",
    prompt: r.prompt ?? "",
    dataUrl: r.media_url ?? "",
    source: ((r.payload?.source as ImageItem["source"]) ?? "text"),
  }));
}

export async function addImage(item: Omit<ImageItem, "id" | "createdAt">): Promise<ImageItem | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("library_items")
    .insert({
      user_id: uid,
      kind: "image",
      prompt: item.prompt,
      media_url: item.dataUrl,
      payload: { source: item.source },
    })
    .select()
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    createdAt: new Date(data.created_at).getTime(),
    kind: "image",
    prompt: data.prompt ?? "",
    dataUrl: data.media_url ?? "",
    source: item.source,
  };
}

export async function removeImage(id: string): Promise<void> {
  await supabase.from("library_items").delete().eq("id", id);
}

// ---------- Storyboards ----------
export async function getStoryboards(): Promise<StoryboardItem[]> {
  return fetchKind<StoryboardItem>("storyboard", (r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    kind: "storyboard",
    story_title: r.title ?? "Untitled",
    scenes: ((r.payload?.scenes as StoryboardScene[]) ?? []),
  }));
}

export async function addStoryboard(item: Omit<StoryboardItem, "id" | "createdAt">): Promise<StoryboardItem | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("library_items")
    .insert({
      user_id: uid,
      kind: "storyboard",
      title: item.story_title,
      payload: { scenes: item.scenes },
    })
    .select()
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    createdAt: new Date(data.created_at).getTime(),
    kind: "storyboard",
    story_title: item.story_title,
    scenes: item.scenes,
  };
}

export async function removeStoryboard(id: string): Promise<void> {
  await supabase.from("library_items").delete().eq("id", id);
}

// ---------- Videos ----------
export async function getVideos(): Promise<VideoItem[]> {
  return fetchKind<VideoItem>("video", (r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    kind: "video",
    prompt: r.prompt ?? "",
    videoUrl: r.media_url ?? "",
    thumbnail: r.thumbnail_url ?? undefined,
    aspectRatio: r.payload?.aspectRatio as string | undefined,
    duration: r.payload?.duration as number | undefined,
    mode: r.payload?.mode as VideoItem["mode"],
  }));
}

export async function addVideo(item: Omit<VideoItem, "id" | "createdAt">): Promise<VideoItem | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("library_items")
    .insert({
      user_id: uid,
      kind: "video",
      prompt: item.prompt,
      media_url: item.videoUrl,
      thumbnail_url: item.thumbnail ?? null,
      payload: { aspectRatio: item.aspectRatio, duration: item.duration, mode: item.mode },
    })
    .select()
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    createdAt: new Date(data.created_at).getTime(),
    kind: "video",
    prompt: item.prompt,
    videoUrl: item.videoUrl,
    thumbnail: item.thumbnail,
    aspectRatio: item.aspectRatio,
    duration: item.duration,
    mode: item.mode,
  };
}

export async function removeVideo(id: string): Promise<void> {
  await supabase.from("library_items").delete().eq("id", id);
}
