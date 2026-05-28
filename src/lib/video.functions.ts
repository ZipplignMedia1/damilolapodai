import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  mode: z.enum(["text", "image"]),
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]),
  duration: z.union([z.literal(5), z.literal(8)]),
  imageDataUrl: z.string().max(15_000_000).optional(),
});

// fal.ai supported aspect ratios for veo3 are 16:9, 9:16, 1:1
function mapRatio(r: string): "16:9" | "9:16" | "1:1" {
  if (r === "9:16" || r === "3:4") return "9:16";
  if (r === "1:1") return "1:1";
  return "16:9";
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY is not configured");

    const endpoint = data.mode === "image"
      ? "fal-ai/veo3/image-to-video"
      : "fal-ai/veo3";

    const body: Record<string, unknown> = {
      prompt: data.prompt,
      aspect_ratio: mapRatio(data.aspectRatio),
      duration: `${data.duration}s`,
    };
    if (data.negativePrompt) body.negative_prompt = data.negativePrompt;
    if (data.mode === "image" && data.imageDataUrl) body.image_url = data.imageDataUrl;

    // Submit to fal queue
    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`fal.ai submit failed [${submitRes.status}]: ${text.slice(0, 300)}`);
    }
    const submitted = await submitRes.json() as { request_id: string; status_url?: string; response_url?: string };

    const statusUrl = submitted.status_url ?? `https://queue.fal.run/${endpoint}/requests/${submitted.request_id}/status`;
    const responseUrl = submitted.response_url ?? `https://queue.fal.run/${endpoint}/requests/${submitted.request_id}`;

    // Poll up to ~5 minutes
    const start = Date.now();
    const timeoutMs = 5 * 60 * 1000;
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 5000));
      const stRes = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
      if (!stRes.ok) continue;
      const st = await stRes.json() as { status: string };
      if (st.status === "COMPLETED") {
        const finalRes = await fetch(responseUrl, { headers: { Authorization: `Key ${key}` } });
        if (!finalRes.ok) throw new Error(`fal.ai response fetch failed: ${finalRes.status}`);
        const final = await finalRes.json() as { video?: { url: string } };
        if (!final.video?.url) throw new Error("No video URL in response");
        return { videoUrl: final.video.url };
      }
      if (st.status === "FAILED") {
        throw new Error("Generation failed on fal.ai");
      }
    }
    throw new Error("Generation timed out after 5 minutes");
  });
