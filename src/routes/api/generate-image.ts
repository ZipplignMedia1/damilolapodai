import { createFileRoute } from "@tanstack/react-router";

type ModelId = "nano-banana" | "nano-banana-pro";

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
  referenceImages?: string[]; // data URLs of character/avatar refs
};

const MODEL_MAP: Record<ModelId, string> = {
  "nano-banana": "gemini-2.5-flash-image",
  "nano-banana-pro": "gemini-3-pro-image-preview",
};


const TYPE_DIRECTIVES: Record<ImageType, string> = {
  photo:
    "Generate a photorealistic photograph. Natural lighting, realistic textures, true-to-life colors, sharp focus, camera-quality depth of field, no illustration or rendering artifacts.",
  "graphic-design":
    "Generate a modern graphic design composition. Clean layout, bold typography, balanced negative space, vibrant brand-ready colors, vector-clean shapes, contemporary design language.",
  "book-cover":
    "Generate a professional book cover. Strong central focal subject, dramatic typography area at top and bottom for title and author, cinematic mood, evocative atmosphere, print-ready composition with clear hierarchy.",
  "face-portrait":
    "Generate a highly detailed human face portrait. Realistic skin texture with pores and subtle imperfections, accurate facial anatomy, expressive eyes with catchlights, natural studio or soft lighting, sharp focus on the face, shallow background.",
  flyer:
    "Generate a print-ready flyer. Clear headline area, supporting subtext space, eye-catching hero visual, strong color hierarchy, balanced margins, call-to-action region, professional marketing aesthetic.",
  logo:
    "Generate a clean logo design. Simple memorable mark, scalable vector-style shapes, limited color palette, centered on a clean background, balanced proportions, brand-identity quality.",
  illustration:
    "Generate a stylized digital illustration. Expressive linework, rich color palette, intentional shading, artistic composition, storybook or editorial illustration quality.",
  product:
    "Generate a professional product shot. Clean studio background, accurate product materials and reflections, soft directional lighting, sharp detail, commercial e-commerce quality.",
  prompt:
    "Provide a highly detailed and vivid description of this concept, capturing every visible element with maximum accuracy. Describe the scene thoroughly — objects, people, clothing, lighting, colors, textures, environment, composition, perspective, mood, and any small or subtle detail. Render as a faithful high-fidelity image suitable as a Nano Banana reference.",
};

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const key = process.env.GEMINI_API_KEY;
        if (!key) return new Response("Missing GEMINI_API_KEY. Add it in the setup panel.", { status: 500 });
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const model = MODEL_MAP[body.model ?? "nano-banana"] ?? MODEL_MAP["nano-banana"];
        const ratio = body.aspectRatio ?? "1:1";
        const type = body.type ?? "photo";
        const directive = TYPE_DIRECTIVES[type] ?? TYPE_DIRECTIVES.photo;

        const refs = (body.referenceImages ?? [])
          .filter((u) => typeof u === "string" && u.startsWith("data:"))
          .slice(0, 8);

        const fullPrompt = [
          directive,
          `Subject: ${body.prompt.trim()}.`,
          `Aspect ratio: ${ratio}.`,
          refs.length
            ? `Use the ${refs.length} reference image${refs.length > 1 ? "s" : ""} as the character/avatar/style reference. Preserve identity, face, outfit and key details from the references.`
            : "",
          "Ultra detailed, high quality, no watermark, no text artifacts unless requested.",
        ].filter(Boolean).join(" ");

        const parts: Array<Record<string, unknown>> = [{ text: fullPrompt }];
        for (const url of refs) {
          const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(url);
          if (!m) continue;
          parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
        }

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: { responseModalities: ["IMAGE"] },
              }),
            },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return new Response(`Google AI ${res.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const json = (await res.json()) as {
            candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
          };
          const partsOut = json.candidates?.[0]?.content?.parts ?? [];
          const imgPart = partsOut.find((p) => p.inlineData?.data);
          const b64 = imgPart?.inlineData?.data;
          const mime = imgPart?.inlineData?.mimeType ?? "image/png";
          if (!b64) return new Response("No image returned", { status: 502 });
          return Response.json({ image: `data:${mime};base64,${b64}` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          return new Response(msg, { status: 502 });
        }
      },

    },
  },
});
