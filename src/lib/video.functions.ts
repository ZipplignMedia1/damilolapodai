import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// fal.ai queue API. Free credits on signup, no kie billing.
// Pipeline: Kling (silent image-to-video) → MMAudio v2 (synced audio).
const FAL_QUEUE = "https://queue.fal.run";
const KLING_MODEL = "fal-ai/kling-video/v1.6/standard/image-to-video";
const MMAUDIO_MODEL = "fal-ai/mmaudio-v2";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  imageDataUrl: z.string().min(1).max(15_000_000),
});

const StatusInputSchema = z.object({
  requestId: z.string().min(1).max(4000),
});

function getKey() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");
  return key;
}

function authHeaders(key: string) {
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

// Encode pipeline state into the requestId so the client only tracks one string.
// Format: "<stage>|<falId>|<duration>|<promptB64>"
function encodeState(stage: "kling" | "mmaudio", falId: string, duration: number, prompt: string) {
  const b64 = btoa(unescape(encodeURIComponent(prompt))).replace(/=+$/, "");
  return `${stage}|${falId}|${duration}|${b64}`;
}

function decodeState(s: string) {
  const [stage, falId, dur, b64] = s.split("|");
  if (!stage || !falId) throw new Error("Invalid requestId");
  const prompt = b64
    ? decodeURIComponent(escape(atob(b64 + "==".slice((b64.length + 2) % 4))))
    : "";
  return { stage: stage as "kling" | "mmaudio", falId, duration: Number(dur) || 5, prompt };
}

async function falSubmit(model: string, input: unknown, key: string): Promise<string> {
  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed [${res.status}]: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { request_id?: string };
  if (!json.request_id) throw new Error("No request_id from fal");
  return json.request_id;
}

async function falStatus(model: string, requestId: string, key: string) {
  const res = await fetch(
    `${FAL_QUEUE}/${model}/requests/${encodeURIComponent(requestId)}/status`,
    { headers: { Authorization: `Key ${key}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Status failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as { status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | string };
}

async function falResult(model: string, requestId: string, key: string) {
  const res = await fetch(
    `${FAL_QUEUE}/${model}/requests/${encodeURIComponent(requestId)}`,
    { headers: { Authorization: `Key ${key}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Result fetch failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as { video?: { url?: string } };
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();

    // Kling 1.6 standard supports image-to-video with aspect 16:9, 9:16, 1:1
    const klingId = await falSubmit(
      KLING_MODEL,
      {
        prompt: data.prompt,
        image_url: data.imageDataUrl, // fal accepts data URIs
        duration: String(data.duration), // "5" or "10"
        aspect_ratio: data.aspectRatio,
      },
      key,
    );

    return { requestId: encodeState("kling", klingId, data.duration, data.prompt) };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();
    const state = decodeState(data.requestId);

    if (state.stage === "kling") {
      const s = await falStatus(KLING_MODEL, state.falId, key);
      if (s.status !== "COMPLETED") {
        return { status: "processing" as const, requestId: data.requestId };
      }
      const result = await falResult(KLING_MODEL, state.falId, key);
      const silentUrl = result.video?.url;
      if (!silentUrl) {
        return { status: "failed" as const, error: "Kling returned no video URL" };
      }
      // Submit MMAudio with the silent video.
      const audioId = await falSubmit(
        MMAUDIO_MODEL,
        {
          video_url: silentUrl,
          prompt: state.prompt,
          duration: state.duration,
        },
        key,
      );
      return {
        status: "processing" as const,
        requestId: encodeState("mmaudio", audioId, state.duration, state.prompt),
      };
    }

    // mmaudio stage
    const s = await falStatus(MMAUDIO_MODEL, state.falId, key);
    if (s.status !== "COMPLETED") {
      return { status: "processing" as const, requestId: data.requestId };
    }
    const result = await falResult(MMAUDIO_MODEL, state.falId, key);
    const finalUrl = result.video?.url;
    if (!finalUrl) {
      return { status: "failed" as const, error: "MMAudio returned no video URL" };
    }
    return { status: "done" as const, videoUrl: finalUrl };
  });
