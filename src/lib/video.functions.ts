import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL_ID = "fal-ai/kling-video/v2.1/standard/image-to-video";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  imageDataUrl: z.string().min(1).max(15_000_000),
  negativePrompt: z.string().max(2000).optional(),
});

const StatusInputSchema = z.object({
  requestId: z.string().min(1).max(200),
});

function getFalKey() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");
  return key;
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getFalKey();

    const body = {
      prompt: data.prompt,
      image_url: data.imageDataUrl,
      duration: String(data.duration),
      aspect_ratio: data.aspectRatio,
      negative_prompt: data.negativePrompt || "blur, distort, and low quality",
    };

    const res = await fetch(`https://queue.fal.run/${MODEL_ID}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fal.ai submit failed [${res.status}]: ${text.slice(0, 400)}`);
    }
    const submitted = (await res.json()) as { request_id?: string };
    if (!submitted.request_id) {
      throw new Error(`fal.ai submit error: ${JSON.stringify(submitted).slice(0, 300)}`);
    }
    return { requestId: submitted.request_id };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getFalKey();
    const id = encodeURIComponent(data.requestId);

    const statusRes = await fetch(
      `https://queue.fal.run/${MODEL_ID}/requests/${id}/status`,
      { headers: { Authorization: `Key ${key}` } },
    );
    if (!statusRes.ok) {
      const text = await statusRes.text();
      throw new Error(`fal.ai status failed [${statusRes.status}]: ${text.slice(0, 400)}`);
    }
    const status = (await statusRes.json()) as { status?: string };

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(
        `https://queue.fal.run/${MODEL_ID}/requests/${id}`,
        { headers: { Authorization: `Key ${key}` } },
      );
      if (!resultRes.ok) {
        const text = await resultRes.text();
        throw new Error(`fal.ai result failed [${resultRes.status}]: ${text.slice(0, 400)}`);
      }
      const result = (await resultRes.json()) as { video?: { url?: string } };
      if (!result.video?.url) {
        return { status: "failed" as const, error: "No video URL in response" };
      }
      return { status: "done" as const, videoUrl: result.video.url };
    }

    if (status.status === "FAILED" || status.status === "ERROR") {
      return { status: "failed" as const, error: "Video generation failed" };
    }

    return { status: "processing" as const };
  });
