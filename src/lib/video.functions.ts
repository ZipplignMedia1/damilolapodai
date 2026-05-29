import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const KIE_BASE = "https://api.kie.ai/api/v1";
const KIE_UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
const MODEL = "kling/v2-1-standard";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  imageDataUrl: z.string().min(1).max(15_000_000),
});

const StatusInputSchema = z.object({
  requestId: z.string().min(1).max(200),
});

function getKey() {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not configured");
  return key;
}

async function uploadImage(dataUrl: string, key: string): Promise<string> {
  const res = await fetch(KIE_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data: dataUrl,
      uploadPath: "images/user-uploads",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image upload failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { downloadUrl?: string }; msg?: string };
  const url = json.data?.downloadUrl;
  if (!url) throw new Error(`No downloadUrl from upload: ${JSON.stringify(json).slice(0, 200)}`);
  return url;
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();

    const imageUrl = await uploadImage(data.imageDataUrl, key);

    const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: {
          prompt: data.prompt,
          image_url: imageUrl,
          duration: String(data.duration),
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video submit failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
    if (json.code !== 200 || !json.data?.taskId) {
      throw new Error(`Submit error: ${json.msg ?? JSON.stringify(json).slice(0, 200)}`);
    }
    return { requestId: json.data.taskId };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();
    const url = `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(data.requestId)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video status failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
      code?: number;
      data?: {
        state?: string;
        resultJson?: string;
        failMsg?: string;
        failCode?: string;
      };
    };

    const state = json.data?.state ?? "";

    if (state === "success") {
      try {
        const parsed = JSON.parse(json.data?.resultJson ?? "{}") as { resultUrls?: string[] };
        const videoUrl = parsed.resultUrls?.[0];
        if (!videoUrl) return { status: "failed" as const, error: "No video URL in result" };
        return { status: "done" as const, videoUrl };
      } catch {
        return { status: "failed" as const, error: "Could not parse result" };
      }
    }

    if (state === "fail") {
      return {
        status: "failed" as const,
        error: json.data?.failMsg || json.data?.failCode || "Generation failed",
      };
    }

    return { status: "processing" as const };
  });
