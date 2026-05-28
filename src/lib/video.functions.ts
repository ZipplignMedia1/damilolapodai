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

// JSON2Video uses width x height. Map common ratios to 1080p-ish dimensions.
function mapDimensions(r: string): { width: number; height: number } {
  switch (r) {
    case "9:16": return { width: 1080, height: 1920 };
    case "1:1":  return { width: 1080, height: 1080 };
    case "4:3":  return { width: 1440, height: 1080 };
    case "3:4":  return { width: 1080, height: 1440 };
    case "16:9":
    default:     return { width: 1920, height: 1080 };
  }
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.JSON2VIDEO_API_KEY;
    if (!key) throw new Error("JSON2VIDEO_API_KEY is not configured");

    const { width, height } = mapDimensions(data.aspectRatio);

    // Build a single-scene movie. For image mode we animate the uploaded image
    // with a Ken-Burns zoom; for text mode we generate via the AI video element.
    const element =
      data.mode === "image" && data.imageDataUrl
        ? {
            type: "image",
            src: data.imageDataUrl,
            duration: data.duration,
            zoom: 2,
            "pan-distance": 0.1,
          }
        : {
            type: "ai-video",
            prompt: data.prompt,
            duration: data.duration,
            model: "kling-2.1",
          };

    const movie = {
      resolution: "custom",
      width,
      height,
      quality: "high",
      scenes: [
        {
          duration: data.duration,
          elements: [element],
        },
      ],
    };

    const submitRes = await fetch("https://api.json2video.com/v2/movies", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(movie),
    });
    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`JSON2Video submit failed [${submitRes.status}]: ${text.slice(0, 400)}`);
    }
    const submitted = (await submitRes.json()) as {
      success?: boolean;
      project?: string;
      message?: string;
    };
    if (!submitted.success || !submitted.project) {
      throw new Error(`JSON2Video submit error: ${submitted.message ?? "no project id"}`);
    }

    // Poll for up to ~5 minutes
    const start = Date.now();
    const timeoutMs = 5 * 60 * 1000;
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 6000));
      const statusRes = await fetch(
        `https://api.json2video.com/v2/movies?project=${encodeURIComponent(submitted.project)}`,
        { headers: { "x-api-key": key } },
      );
      if (!statusRes.ok) continue;
      const status = (await statusRes.json()) as {
        success?: boolean;
        movie?: {
          status?: string;
          url?: string;
          message?: string;
        };
      };
      const m = status.movie;
      if (!m) continue;
      if (m.status === "error") {
        throw new Error(`JSON2Video generation failed: ${m.message ?? "unknown"}`);
      }
      if (m.status === "done" && m.url) {
        return { videoUrl: m.url };
      }
    }
    throw new Error("Generation timed out after 5 minutes");
  });
