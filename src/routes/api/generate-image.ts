import { createFileRoute } from "@tanstack/react-router";

type ModelId = "flux" | "flux-realism" | "flux-anime" | "flux-3d" | "turbo";

export type ImageType =
  | "photo"
  | "graphic-design"
  | "book-cover"
  | "face-portrait"
  | "flyer"
  | "logo"
  | "illustration"
  | "product"
  | "prompt";

type Body = {
  prompt: string;
  model?: ModelId;
  type?: ImageType;
  aspectRatio?: "1:1" | "16:9" | "9:16";
  referenceImages?: string[];
};

const TYPE_DIRECTIVES: Record<ImageType, string> = {
  photo:
    "Photorealistic photograph. Natural lighting, realistic textures, true-to-life colors, sharp focus, camera-quality depth of field.",
  "graphic-design":
    "Modern graphic design composition. Clean layout, bold typography, balanced negative space, vibrant brand-ready colors.",
  "book-cover":
    "Professional book cover. Strong central subject, dramatic title and author space, cinematic mood, print-ready composition.",
  "face-portrait":
    "Highly detailed human face portrait. Realistic skin texture, accurate anatomy, expressive eyes, soft studio lighting, shallow background.",
  flyer:
    "Print-ready flyer. Clear headline area, hero visual, balanced margins, professional marketing aesthetic.",
  logo:
    "Clean logo design. Simple memorable mark, scalable shapes, limited color palette, centered, brand-identity quality.",
  illustration:
    "Stylized digital illustration. Expressive linework, rich color palette, artistic composition, editorial illustration quality.",
  product:
    "Professional product shot. Clean studio background, accurate materials and reflections, soft directional lighting, commercial e-commerce quality.",
  prompt:
    "Highly detailed and vivid scene with maximum accuracy across objects, people, clothing, lighting, colors, textures, environment, composition, perspective and mood.",
};

const DIMS: Record<"1:1" | "16:9" | "9:16", { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const model = body.model ?? "flux";
        const ratio = body.aspectRatio ?? "1:1";
        const { w, h } = DIMS[ratio];
        const type = body.type ?? "photo";
        const directive = TYPE_DIRECTIVES[type] ?? TYPE_DIRECTIVES.photo;

        const fullPrompt = [
          directive,
          `Subject: ${body.prompt.trim()}.`,
          "Ultra detailed, high quality, no watermark.",
        ].join(" ");

        const seed = Math.floor(Math.random() * 1_000_000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w}&height=${h}&model=${encodeURIComponent(model)}&seed=${seed}&nologo=true&enhance=true`;

        try {
          const res = await fetch(url, { method: "GET" });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return new Response(`Pollinations ${res.status}: ${text.slice(0, 200)}`, { status: 502 });
          }
          const buf = new Uint8Array(await res.arrayBuffer());
          const mime = res.headers.get("content-type") ?? "image/jpeg";
          let bin = "";
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
          const b64 = btoa(bin);
          return Response.json({ image: `data:${mime};base64,${b64}` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
