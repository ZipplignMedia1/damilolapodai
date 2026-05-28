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

// Veo 3 via Gemini API supports 16:9 and 9:16
function mapRatio(r: string): "16:9" | "9:16" {
  if (r === "9:16" || r === "3:4") return "9:16";
  return "16:9";
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  return { mimeType: match[1], base64: match[2] };
}

export const generateVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");

    const model = "veo-2.0-generate-001";
    const base = "https://generativelanguage.googleapis.com/v1beta";

    const instance: Record<string, unknown> = { prompt: data.prompt };
    if (data.mode === "image" && data.imageDataUrl) {
      const { mimeType, base64 } = parseDataUrl(data.imageDataUrl);
      instance.image = { bytesBase64Encoded: base64, mimeType };
    }

    const parameters: Record<string, unknown> = {
      aspectRatio: mapRatio(data.aspectRatio),
    };
    if (data.negativePrompt) parameters.negativePrompt = data.negativePrompt;

    const submitRes = await fetch(`${base}/models/${model}:predictLongRunning`, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ instances: [instance], parameters }),
    });
    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`Gemini submit failed [${submitRes.status}]: ${text.slice(0, 400)}`);
    }
    const submitted = (await submitRes.json()) as { name?: string };
    if (!submitted.name) throw new Error("Gemini did not return an operation name");

    // Poll up to ~5 minutes
    const start = Date.now();
    const timeoutMs = 5 * 60 * 1000;
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 8000));
      const opRes = await fetch(`${base}/${submitted.name}`, {
        headers: { "x-goog-api-key": key },
      });
      if (!opRes.ok) continue;
      const op = (await opRes.json()) as {
        done?: boolean;
        error?: { message?: string };
        response?: {
          generateVideoResponse?: {
            generatedSamples?: Array<{ video?: { uri?: string } }>;
          };
        };
      };
      if (op.error) throw new Error(`Gemini generation failed: ${op.error.message ?? "unknown"}`);
      if (!op.done) continue;

      const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error("No video URI in Gemini response");

      // Download video bytes (URI requires API key) and return as data URL
      const sep = uri.includes("?") ? "&" : "?";
      const videoRes = await fetch(`${uri}${sep}key=${key}`);
      if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
      const buf = new Uint8Array(await videoRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      const b64 = btoa(binary);
      return { videoUrl: `data:video/mp4;base64,${b64}` };
    }
    throw new Error("Generation timed out after 5 minutes");
  });
