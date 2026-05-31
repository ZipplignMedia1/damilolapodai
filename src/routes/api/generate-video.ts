import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: number;
  imageDataUrl?: string | null;
};

// fal.ai models — fast & cheap
// text-to-video: fal-ai/ltx-video (very fast, ~5-10s)
// image-to-video: fal-ai/ltx-video/image-to-video
const TEXT_MODEL = "fal-ai/ltx-video";
const IMAGE_MODEL = "fal-ai/ltx-video/image-to-video";

async function pollResult(statusUrl: string, key: string): Promise<unknown> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    const data = (await res.json()) as { status?: string; response_url?: string };
    if (data.status === "COMPLETED" && data.response_url) {
      const final = await fetch(data.response_url, { headers: { Authorization: `Key ${key}` } });
      return final.json();
    }
    if (data.status === "FAILED") throw new Error("fal.ai job failed");
  }
  throw new Error("Timed out waiting for video");
}

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const key = process.env.FAL_KEY;
        if (!key) return new Response("Missing FAL_KEY", { status: 500 });
        if (!body.prompt) return new Response("prompt required", { status: 400 });

        const isImg = !!body.imageDataUrl;
        const model = isImg ? IMAGE_MODEL : TEXT_MODEL;

        const payload: Record<string, unknown> = {
          prompt: body.prompt,
          aspect_ratio: body.aspectRatio ?? "16:9",
          num_frames: body.duration === 10 ? 161 : 121,
        };
        if (isImg) payload.image_url = body.imageDataUrl;

        try {
          const submit = await fetch(`https://queue.fal.run/${model}`, {
            method: "POST",
            headers: {
              Authorization: `Key ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!submit.ok) {
            const text = await submit.text().catch(() => "");
            return new Response(`fal.ai ${submit.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const { status_url } = (await submit.json()) as { status_url: string };
          const result = (await pollResult(status_url, key)) as { video?: { url?: string } };
          const url = result.video?.url;
          if (!url) return new Response("No video URL in fal response", { status: 502 });
          return Response.json({ url });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
