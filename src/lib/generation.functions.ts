import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Video Generation ──────────────────────────────────────────────

const TEXT_MODEL = "wavespeed-ai/wan-2.1/t2v-480p";
const IMAGE_MODEL = "wavespeed-ai/wan-2.1/i2v-480p";

type PredictionResult = {
  data?: {
    status?: string;
    outputs?: string[];
    error?: string;
  };
};

async function pollWaveSpeed(predictionId: string, key: string): Promise<string> {
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

async function callWaveSpeed(
  prompt: string,
  duration: 5 | 10,
  aspectRatio: string,
  imageDataUrl: string | null,
  key: string,
): Promise<string> {
  const isImg = !!imageDataUrl;
  const model = isImg ? IMAGE_MODEL : TEXT_MODEL;

  const payload: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    duration: duration === 10 ? 10 : 5,
  };
  if (isImg) payload.image = imageDataUrl;

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
    throw new Error(`WaveSpeed ${submit.status}: ${text.slice(0, 300)}`);
  }
  const submitJson = (await submit.json()) as { data?: { id?: string } };
  const id = submitJson.data?.id;
  if (!id) throw new Error("No prediction id from WaveSpeed");
  return pollWaveSpeed(id, key);
}

const VideoInputSchema = z.object({
  prompt: z.string().min(3).max(2000),
  duration: z.union([z.literal(5), z.literal(10)]),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  imageDataUrl: z.string().nullable().optional(),
});

export const generateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; duration: 5 | 10; aspectRatio: string; imageDataUrl?: string | null }) =>
    VideoInputSchema.parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.WAVESPEED_API_KEY;
    if (!key) throw new Error("Server misconfigured: missing WAVESPEED_API_KEY");

    const cost = data.duration; // 5 or 10 DPOD
    const { data: newBalance, error: spendErr } = await supabase.rpc("spend_credit", {
      _amount: cost,
      _reason: `video:${data.duration}s`,
    });
    if (spendErr) throw new Error(spendErr.message);

    try {
      const videoUrl = await callWaveSpeed(
        data.prompt,
        data.duration,
        data.aspectRatio,
        data.imageDataUrl ?? null,
        key,
      );

      const { data: row, error: libErr } = await supabase
        .from("library_items")
        .insert({
          user_id: userId,
          kind: "video",
          prompt: data.prompt,
          media_url: videoUrl,
          payload: {
            aspectRatio: data.aspectRatio,
            duration: data.duration,
            mode: data.imageDataUrl ? "image" : "text",
          },
        })
        .select()
        .single();

      if (libErr) throw new Error(libErr.message);

      return {
        videoUrl,
        itemId: row.id,
        creditsRemaining: newBalance ?? 0,
      };
    } catch (err) {
      // Refund credits if generation failed
      try {
        await supabase.rpc("credit_for_payment", {
          _reference: `refund-${userId}-${Date.now()}`,
          _user_id: userId,
          _credits: cost,
          _kind: "refund:video",
        });
      } catch {}
      throw err;
    }
  });


// ─── Image Generation ────────────────────────────────────────────────

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

const ImageInputSchema = z.object({
  prompt: z.string().min(3).max(2000),
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"),
  type: z.enum([
    "photo",
    "graphic-design",
    "book-cover",
    "face-portrait",
    "flyer",
    "logo",
    "illustration",
    "product",
    "prompt",
  ]).default("photo"),
  model: z.enum(["flux", "flux-realism", "flux-anime", "flux-3d", "turbo"]).default("flux"),
});

export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; aspectRatio: "1:1" | "16:9" | "9:16"; type: ImageType; model?: "flux" | "flux-realism" | "flux-anime" | "flux-3d" | "turbo" }) =>
    ImageInputSchema.parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cost = 2; // 2 DPOD per image
    const { data: newBalance, error: spendErr } = await supabase.rpc("spend_credit", {
      _amount: cost,
      _reason: "image",
    });
    if (spendErr) throw new Error(spendErr.message);

    try {
      const { w, h } = DIMS[data.aspectRatio];
      const directive = TYPE_DIRECTIVES[data.type] ?? TYPE_DIRECTIVES.photo;
      const fullPrompt = [
        directive,
        `Subject: ${data.prompt.trim()}.`,
        "Ultra detailed, high quality, no watermark.",
      ].join(" ");

      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w}&height=${h}&model=${encodeURIComponent(data.model)}&seed=${seed}&nologo=true&enhance=true`;

      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Pollinations ${res.status}: ${text.slice(0, 200)}`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const dataUrl = `data:${mime};base64,${b64}`;

      const { data: row, error: libErr } = await supabase
        .from("library_items")
        .insert({
          user_id: userId,
          kind: "image",
          prompt: data.prompt,
          media_url: dataUrl,
          payload: { source: "text", aspectRatio: data.aspectRatio, type: data.type, model: data.model },
        })
        .select()
        .single();

      if (libErr) throw new Error(libErr.message);

      return {
        image: dataUrl,
        itemId: row.id,
        creditsRemaining: newBalance ?? 0,
      };
    } catch (err) {
      try {
        await supabase.rpc("credit_for_payment", {
          _reference: `refund-${userId}-${Date.now()}`,
          _user_id: userId,
          _credits: cost,
          _kind: "refund:image",
        });
      } catch {}
      throw err;
    }
  });

