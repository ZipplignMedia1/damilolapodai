import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const KIE_BASE = "https://api.kie.ai/api/v1";
const KIE_UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
const MODEL = "veo3_fast"; // Veo 3.1 Fast — native audio, image-to-video

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

    // Veo only supports 16:9 and 9:16 natively. Map 1:1 → 9:16 as the safest fallback.
    const aspect = data.aspectRatio === "1:1" ? "9:16" : data.aspectRatio;

    const res = await fetch(`${KIE_BASE}/veo/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: data.prompt,
        imageUrls: [imageUrl],
        model: MODEL,
        aspect_ratio: aspect,
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video submit failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: { taskId?: string };
    };
    if (json.code !== 200 || !json.data?.taskId) {
      throw new Error(`Submit error: ${json.msg ?? JSON.stringify(json).slice(0, 200)}`);
    }
    return { requestId: json.data.taskId };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getKey();
    const url = `${KIE_BASE}/veo/record-info?taskId=${encodeURIComponent(data.requestId)}`;

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
        successFlag?: number;
        errorMessage?: string | null;
        errorCode?: number | null;
        response?: {
          resultUrls?: string[];
          fullResultUrls?: string[];
        };
      };
    };

    const flag = json.data?.successFlag;

    if (flag === 1) {
      const videoUrl =
        json.data?.response?.resultUrls?.[0] ?? json.data?.response?.fullResultUrls?.[0];
      if (!videoUrl) return { status: "failed" as const, error: "No video URL in result" };
      return { status: "done" as const, videoUrl };
    }

    if (flag === 2 || flag === 3) {
      return {
        status: "failed" as const,
        error:
          json.data?.errorMessage || (json.data?.errorCode ? `Error ${json.data.errorCode}` : "Generation failed"),
      };
    }

    return { status: "processing" as const };
  });
