import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: number;
  imageDataUrl?: string | null;
};

// WaveSpeed AI — Wan 2.1 480p (cheapest text/image-to-video on WaveSpeed)
const TEXT_MODEL = "wavespeed-ai/wan-2.1/t2v-480p";
const IMAGE_MODEL = "wavespeed-ai/wan-2.1/i2v-480p";

type PredictionResult = {
  data?: {
    status?: string;
    outputs?: string[];
    error?: string;
  };
};

async function pollResult(predictionId: string, key: string): Promise<string> {
  const url = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    const json = (await res.json()) as PredictionResult;
    const status = json.data?.status;
    if (status === "completed") {
      const out = json.data?.outputs?.[0];
      if (!out) throw new Error("No output URL");
      return out;
    }
    if (status === "failed") throw new Error(json.data?.error || "WaveSpeed job failed");
  }
  throw new Error("Timed out waiting for video");
}

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const key = process.env.WAVESPEED_API_KEY;
        if (!key) return new Response("Missing WAVESPEED_API_KEY", { status: 500 });
        if (!body.prompt) return new Response("prompt required", { status: 400 });

        const isImg = !!body.imageDataUrl;
        const model = isImg ? IMAGE_MODEL : TEXT_MODEL;

        const payload: Record<string, unknown> = {
          prompt: body.prompt,
          aspect_ratio: body.aspectRatio ?? "16:9",
          duration: body.duration === 10 ? 10 : 5,
        };
        if (isImg) payload.image = body.imageDataUrl;

        try {
          const submit = await fetch(`https://api.wavespeed.ai/api/v3/${model}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!submit.ok) {
            const text = await submit.text().catch(() => "");
            return new Response(`WaveSpeed ${submit.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const submitJson = (await submit.json()) as { data?: { id?: string } };
          const id = submitJson.data?.id;
          if (!id) return new Response("No prediction id from WaveSpeed", { status: 502 });
          const url = await pollResult(id, key);
          return Response.json({ url });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
