import { createFileRoute } from "@tanstack/react-router";

type Body = { prompt: string; count?: number };

async function generateOne(prompt: string, key: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from the model.");
  return b64;
}

export const Route = createFileRoute("/api/keyframes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt, count = 4 } = (await request.json()) as Body;
        if (!prompt || typeof prompt !== "string") {
          return new Response("prompt is required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const n = Math.max(2, Math.min(6, Number(count) || 4));
        const variants = [
          "establishing wide cinematic shot, dramatic lighting",
          "medium shot, slight camera push-in, rich detail",
          "close-up dynamic angle, motion blur, cinematic",
          "alternate angle, golden hour lighting, atmospheric",
          "high angle dramatic moment, depth of field",
          "final hero shot, epic composition, cinematic finale",
        ].slice(0, n);

        try {
          const images = await Promise.all(
            variants.map((v) =>
              generateOne(
                `Cinematic film still. ${prompt}. ${v}. Photorealistic, high detail, 16:9 cinematic framing. No text, no captions, no watermarks.`,
                key,
              ),
            ),
          );
          return Response.json({ images });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
