import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]),
  duration: z.union([z.literal(5), z.literal(8)]),
  imageDataUrl: z.string().min(1).max(15_000_000),
});

const StatusInputSchema = z.object({
  projectId: z.string().min(1).max(200),
});

function mapDimensions(r: string): { width: number; height: number } {
  switch (r) {
    case "9:16": return { width: 1080, height: 1920 };
    case "1:1":  return { width: 1080, height: 1080 };
    case "4:3":  return { width: 1440, height: 1080 };
    case "3:4":  return { width: 1080, height: 1440 };
    case "16:9":
    default:     return { width: 1920, height: 1080 };
  }
}

function getJson2VideoKey() {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) throw new Error("JSON2VIDEO_API_KEY is not configured");
  return key;
}

function parseDataUrl(dataUrl: string): { contentType: string; bytes: Uint8Array; ext: string } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data");
  const contentType = match[1] || "image/png";
  const isBase64 = !!match[2];
  const payload = match[3];
  const bytes = isBase64
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  const ext =
    contentType === "image/jpeg" ? "jpg"
    : contentType === "image/png" ? "png"
    : contentType === "image/webp" ? "webp"
    : "img";
  return { contentType, bytes, ext };
}

async function uploadImageToJson2Video(key: string, dataUrl: string): Promise<string> {
  const { contentType, bytes, ext } = parseDataUrl(dataUrl);
  const name = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const presignRes = await fetch("https://api.json2video.com/v2/media/file", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ name, contentType, size: bytes.byteLength, folder: "temp" }),
  });
  if (!presignRes.ok) {
    const t = await presignRes.text();
    throw new Error(`Media presign failed [${presignRes.status}]: ${t.slice(0, 300)}`);
  }
  const presigned = (await presignRes.json()) as { uploadUrl?: string; fileUrl?: string };
  if (!presigned.uploadUrl || !presigned.fileUrl) {
    throw new Error("Media presign response missing uploadUrl/fileUrl");
  }

  const putRes = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes as BodyInit,
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`Image upload failed [${putRes.status}]: ${t.slice(0, 300)}`);
  }
  return presigned.fileUrl;
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getJson2VideoKey();
    const { width, height } = mapDimensions(data.aspectRatio);

    const imageUrl = await uploadImageToJson2Video(key, data.imageDataUrl);

    const movie = {
      resolution: "custom",
      width,
      height,
      quality: "high",
      scenes: [
        {
          duration: data.duration,
          elements: [
            {
              type: "image",
              src: imageUrl,
              duration: data.duration,
              zoom: 2,
              "pan-distance": 0.1,
              resize: "cover",
            },
          ],
        },
      ],
    };

    const submitRes = await fetch("https://api.json2video.com/v2/movies", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(movie),
    });
    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`JSON2Video submit failed [${submitRes.status}]: ${text.slice(0, 400)}`);
    }
    const submitted = (await submitRes.json()) as Record<string, any>;
    const projectId: string | undefined =
      submitted.project ?? submitted.project_id ?? submitted.projectId ?? submitted.id;
    if (!projectId) {
      throw new Error(
        `JSON2Video submit error: ${submitted.message ?? JSON.stringify(submitted).slice(0, 300)}`,
      );
    }
    return { projectId };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getJson2VideoKey();
    const statusRes = await fetch(
      `https://api.json2video.com/v2/movies?project=${encodeURIComponent(data.projectId)}`,
      { headers: { "x-api-key": key } },
    );
    if (!statusRes.ok) {
      const text = await statusRes.text();
      throw new Error(`JSON2Video status failed [${statusRes.status}]: ${text.slice(0, 400)}`);
    }
    const status = (await statusRes.json()) as {
      success?: boolean;
      movie?: { status?: string; url?: string; message?: string };
      message?: string;
    };
    const movie = status.movie;
    if (!status.success || !movie) return { status: "processing" as const };
    if (movie.status === "error") {
      return { status: "failed" as const, error: movie.message ?? "Video generation failed" };
    }
    if (movie.status === "done" && movie.url) {
      return { status: "done" as const, videoUrl: movie.url };
    }
    return { status: "processing" as const };
  });
