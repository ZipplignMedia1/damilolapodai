import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt: string;
  style?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16";
  lighting?: string;
};

const SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
};

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const fullPrompt = [
          body.prompt.trim(),
          body.style ? `Style: ${body.style}.` : "",
          body.lighting ? `Lighting: ${body.lighting}.` : "",
          "Ultra detailed, high quality.",
        ]
          .filter(Boolean)
          .join(" ");

        const size = SIZE[body.aspectRatio ?? "1:1"] ?? "1024x1024";

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-image-2",
              prompt: fullPrompt,
              quality: "low",
              size,
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return new Response(`Gateway ${res.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const json = (await res.json()) as { data?: { b64_json?: string }[] };
          const b64 = json.data?.[0]?.b64_json;
          if (!b64) return new Response("No image returned", { status: 502 });
          return Response.json({ image: `data:image/png;base64,${b64}` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
