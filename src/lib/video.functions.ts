import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Pollinations.ai — free-tier video gen using LTX-2 (the only non-paid_only model
// that supports both text- and image-to-video).
// Docs: https://enter.pollinations.ai/api/docs/llm.txt
const GEN_BASE = "https://gen.pollinations.ai";
const MEDIA_BASE = "https://media.pollinations.ai";
const VIDEO_MODEL = "ltx-2";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  imageDataUrl: z.string().min(1).max(15_000_000).optional(),
});

const StatusInputSchema = z.object({
  requestId: z.string().min(1).max(4000),
});

function getKey() {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) throw new Error("POLLINATIONS_API_KEY is not configured");
  return key;
}

// Parse a data URL like "data:image/png;base64,AAAA..." into bytes + mime.
function dataUrlToBlob(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const mime = match[1];
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function uploadToMedia(bytes: Uint8Array, mime: string, filename: string, key: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  const res = await fetch(`${MEDIA_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Media upload failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  // The upload endpoint typically returns { url, hash } or a plain URL string.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await res.json()) as { url?: string; hash?: string };
    if (json.url) return json.url;
    if (json.hash) return `${MEDIA_BASE}/${json.hash}`;
    throw new Error("Media upload returned no URL");
  }
  const text = (await res.text()).trim();
  if (text.startsWith("http")) return text;
  return `${MEDIA_BASE}/${text}`;
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();

    // 1. If image input, upload to Pollinations media so we can reference by URL.
    let imageUrl: string | undefined;
    if (data.imageDataUrl) {
      const { bytes, mime } = dataUrlToBlob(data.imageDataUrl);
      const ext = mime.split("/")[1] ?? "png";
      imageUrl = await uploadToMedia(bytes, mime, `frame.${ext}`, key);
    }

    // 2. Call Pollinations video endpoint. This is a synchronous request that
    // streams the MP4 back once generation completes.
    const params = new URLSearchParams({
      model: VIDEO_MODEL,
      duration: String(data.duration),
      aspect_ratio: data.aspectRatio,
    });
    if (imageUrl) params.set("image", imageUrl);

    const url = `${GEN_BASE}/video/${encodeURIComponent(data.prompt)}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video generation failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const contentType = res.headers.get("content-type") ?? "video/mp4";
    const buf = new Uint8Array(await res.arrayBuffer());

    // 3. Re-upload the MP4 to Pollinations media to get a stable public URL.
    const finalUrl = await uploadToMedia(buf, contentType, "video.mp4", key);

    // Encode the final URL into the requestId so the existing polling UI works.
    return { requestId: `done|${finalUrl}` };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.requestId.startsWith("done|")) {
      const videoUrl = data.requestId.slice("done|".length);
      return { status: "done" as const, videoUrl };
    }
    return { status: "failed" as const, error: "Unknown request state" };
  });
