import { createFileRoute } from "@tanstack/react-router";

type Body = {
  imageDataUrl: string;
  prompt: string;
  strength?: number;
  styleTransfer?: boolean;
};

export const Route = createFileRoute("/api/transform-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!body.imageDataUrl || !body.prompt?.trim()) {
          return new Response("imageDataUrl and prompt required", { status: 400 });
        }

        const strengthDesc =
          body.strength != null
            ? `Apply changes with intensity ${body.strength}/100 (higher = more transformation).`
            : "";
        const styleDesc = body.styleTransfer ? "Apply style transfer aggressively." : "";
        const fullPrompt = `${body.prompt.trim()}. ${strengthDesc} ${styleDesc} Keep composition coherent. Ultra-realistic, high detail.`;

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: fullPrompt },
                    { type: "image_url", image_url: { url: body.imageDataUrl } },
                  ],
                },
              ],
              modalities: ["image", "text"],
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
          const msg = err instanceof Error ? err.message : "Transform failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
