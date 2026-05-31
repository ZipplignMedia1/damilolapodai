import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt: string;
  characterImages?: string[]; // data URLs
  style?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  location?: string;
  wardrobe?: string;
};

const ratioGuidance: Record<string, string> = {
  "1:1": "square 1:1 framing",
  "16:9": "widescreen cinematic 16:9 landscape framing",
  "9:16": "vertical 9:16 mobile/reels framing",
  "4:3": "classic 4:3 framing",
  "3:4": "portrait 3:4 framing",
};

export const Route = createFileRoute("/api/storyboard-scene")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const style = body.style?.trim() || "ultra-realistic cinematic";
        const ratio = ratioGuidance[body.aspectRatio ?? "1:1"];
        const parts = [
          body.prompt.trim(),
          body.location ? `LOCATION (must stay identical across scenes): ${body.location}` : "",
          body.wardrobe ? `WARDROBE (must stay identical across scenes): ${body.wardrobe}` : "",
          `Style: ${style}.`,
          `Framing: ${ratio}.`,
          "Keep the provided character(s) consistent in face, body, hair, and outfit. Keep the location architecture, props, and color palette identical to previous scenes. High detail, cinematic lighting, film grain.",
        ].filter(Boolean);
        const fullPrompt = parts.join(" ");

        const content: Array<
          { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
        > = [{ type: "text", text: fullPrompt }];
        for (const img of body.characterImages ?? []) {
          if (img) content.push({ type: "image_url", image_url: { url: img } });
        }

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image-preview",
              messages: [{ role: "user", content }],
              modalities: ["image", "text"],
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            if (res.status === 429) return new Response("Rate limit — try again shortly.", { status: 429 });
            if (res.status === 402) return new Response("AI credits exhausted.", { status: 402 });
            return new Response(`Gateway ${res.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const json = (await res.json()) as { data?: { b64_json?: string }[] };
          const b64 = json.data?.[0]?.b64_json;
          if (!b64) return new Response("No image returned", { status: 502 });
          return Response.json({ image: `data:image/png;base64,${b64}` });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Scene failed", { status: 502 });
        }
      },
    },
  },
});
