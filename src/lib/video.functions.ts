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

const StatusInputSchema = z.object({
  projectId: z.string().min(1).max(200),
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

function getJson2VideoKey() {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) throw new Error("JSON2VIDEO_API_KEY is not configured");
  return key;
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getJson2VideoKey();

    const { width, height } = mapDimensions(data.aspectRatio);

    // Build a single-scene movie. For image mode we animate the uploaded image
    // with a Ken-Burns zoom; for text mode JSON2Video generates AI video via
    // the regular video element plus a video-capable model.
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
            type: "video",
            prompt: data.prompt,
            duration: data.duration,
            model: "seedance-v1.5-pro",
            resize: "fill",
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
    const submitted = (await submitRes.json()) as Record<string, any>;
    const projectId: string | undefined =
      submitted.project ??
      submitted.project_id ??
      submitted.projectId ??
      submitted.id ??
      submitted?.movie?.project ??
      submitted?.data?.project;
    if (!projectId) {
      throw new Error(
        `JSON2Video submit error: ${submitted.message ?? JSON.stringify(submitted).slice(0, 300)}`,
      );
    }

    return { projectId };
  });

export const getVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = getJson2VideoKey();
    const statusRes = await fetch(
      `https://api.json2video.com/v2/movies?project=${encodeURIComponent(data.projectId)}`,
      { headers: { "x-api-key": key } },
    );
    if (!statusRes.ok) {
      const text = await statusRes.text();
      throw new Error(`JSON2Video status failed [${statusRes.status}]: ${text.slice(0, 400)}`);
    }
    const status = (await statusRes.json()) as {
      success?: boolean;
      movie?: {
        status?: string;
        url?: string;
        message?: string;
      };
      message?: string;
    };
    const movie = status.movie;
    if (!status.success || !movie) {
      return { status: "processing" as const };
    }
    if (movie.status === "error") {
      return { status: "failed" as const, error: movie.message ?? "Video generation failed" };
    }
    if (movie.status === "done" && movie.url) {
      return { status: "done" as const, videoUrl: movie.url };
    }
    return { status: "processing" as const };
  });
