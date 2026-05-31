import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// fal.ai queue API. Free credits on signup, no kie billing.
// Pipeline: Kling (silent video, text- or image-to-video) → MMAudio v2 (synced audio).
const FAL_QUEUE = "https://queue.fal.run";
const KLING_IMG = "fal-ai/kling-video/v1/standard/image-to-video";
const KLING_TXT = "fal-ai/kling-video/v1/standard/text-to-video";
const MMAUDIO_MODEL = "fal-ai/mmaudio-v2";

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
// Format: "<stage>|<model>|<falId>|<duration>|<promptB64>"
type Stage = "kling" | "mmaudio";
function encodeState(stage: Stage, model: string, falId: string, duration: number, prompt: string) {
  const b64 = btoa(unescape(encodeURIComponent(prompt))).replace(/=+$/, "");
  const modelB64 = btoa(model).replace(/=+$/, "");
  return `${stage}|${modelB64}|${falId}|${duration}|${b64}`;
}

function decodeState(s: string) {
  const [stage, modelB64, falId, dur, b64] = s.split("|");
  if (!stage || !modelB64 || !falId) throw new Error("Invalid requestId");
  const model = atob(modelB64 + "==".slice((modelB64.length + 2) % 4));
  const prompt = b64
    ? decodeURIComponent(escape(atob(b64 + "==".slice((b64.length + 2) % 4))))
    : "";
  return { stage: stage as Stage, model, falId, duration: Number(dur) || 5, prompt };
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
    const model = data.imageDataUrl ? KLING_IMG : KLING_TXT;

    const input: Record<string, unknown> = {
      prompt: data.prompt,
      duration: String(data.duration),
      aspect_ratio: data.aspectRatio,
    };
    if (data.imageDataUrl) input.image_url = data.imageDataUrl;

    const klingId = await falSubmit(model, input, key);
    return { requestId: encodeState("kling", model, klingId, data.duration, data.prompt) };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();
    const state = decodeState(data.requestId);

    if (state.stage === "kling") {
      const s = await falStatus(state.model, state.falId, key);
      if (s.status !== "COMPLETED") {
        return { status: "processing" as const, requestId: data.requestId };
      }
      const result = await falResult(state.model, state.falId, key);
      const silentUrl = result.video?.url;
      if (!silentUrl) {
        return { status: "failed" as const, error: "Kling returned no video URL" };
      }
      const audioId = await falSubmit(
        MMAUDIO_MODEL,
        { video_url: silentUrl, prompt: state.prompt, duration: state.duration },
        key,
      );
      return {
        status: "processing" as const,
        requestId: encodeState("mmaudio", MMAUDIO_MODEL, audioId, state.duration, state.prompt),
      };
    }

    const s = await falStatus(state.model, state.falId, key);
    if (s.status !== "COMPLETED") {
      return { status: "processing" as const, requestId: data.requestId };
    }
    const result = await falResult(state.model, state.falId, key);
    const finalUrl = result.video?.url;
    if (!finalUrl) {
      return { status: "failed" as const, error: "MMAudio returned no video URL" };
    }
    return { status: "done" as const, videoUrl: finalUrl };
  });
