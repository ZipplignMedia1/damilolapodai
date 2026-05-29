import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE_URL = "https://api.bluesminds.com/v1";
const MODEL = "grok-imagine-video";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  imageDataUrl: z.string().min(1).max(15_000_000).optional(),
});

const StatusInputSchema = z.object({
  requestId: z.string().min(1).max(200),
});

function getKey() {
  const key = process.env.BLUESMINDS_API_KEY;
  if (!key) throw new Error("BLUESMINDS_API_KEY is not configured");
  return key;
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();

    const body: Record<string, unknown> = {
      model: MODEL,
      prompt: data.prompt,
      aspect_ratio: data.aspectRatio,
      duration: data.duration,
    };
    if (data.imageDataUrl) body.image = data.imageDataUrl;

    const res = await fetch(`${BASE_URL}/videos/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video submit failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as { request_id?: string; id?: string };
    const requestId = json.request_id ?? json.id;
    if (!requestId) {
      throw new Error(`No request id in response: ${JSON.stringify(json).slice(0, 300)}`);
    }
    return { requestId };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();
    const id = encodeURIComponent(data.requestId);

    const res = await fetch(`${BASE_URL}/videos/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video status failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const result = (await res.json()) as {
      status?: string;
      url?: string;
      video_url?: string;
      output?: { url?: string } | string;
      error?: { message?: string } | string;
    };

    const status = (result.status ?? "").toLowerCase();

    if (status === "done" || status === "completed" || status === "success") {
      const videoUrl =
        result.url ??
        result.video_url ??
        (typeof result.output === "string" ? result.output : result.output?.url);
      if (!videoUrl) {
        return { status: "failed" as const, error: "No video URL in response" };
      }
      return { status: "done" as const, videoUrl };
    }

    if (status === "failed" || status === "error") {
      const msg =
        typeof result.error === "string" ? result.error : result.error?.message ?? "Video generation failed";
      return { status: "failed" as const, error: msg };
    }

    return { status: "processing" as const };
  });
