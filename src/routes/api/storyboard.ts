import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SceneSchema = z.object({
  scene_number: z.number().int(),
  title: z.string(),
  description: z.string(),
  visual_prompt: z.string(),
  camera: z.object({
    angle: z.string(),
    movement: z.string(),
  }),
  lighting: z.string(),
  emotion: z.string(),
});

const StoryboardSchema = z.object({
  story_title: z.string(),
  style: z.string().default("ultra-realistic cinematic"),
  grid: z.string().default("3x3"),
  scenes: z.array(SceneSchema).length(9),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;

const SYSTEM = `You are a cinematic storyboard director. Convert the user's story into a 3x3 storyboard of EXACTLY 9 scenes. Each scene must be ultra-realistic cinematic. Return ONLY valid JSON matching this schema:
{
  "story_title": string,
  "style": "ultra-realistic cinematic",
  "grid": "3x3",
  "scenes": [
    {
      "scene_number": 1-9,
      "title": "short scene title",
      "description": "what is happening",
      "visual_prompt": "ultra-realistic cinematic visual description with environment detail",
      "camera": { "angle": "close-up | wide | medium | over-the-shoulder | two-shot", "movement": "static | pan | dolly | handheld | slow zoom" },
      "lighting": "natural | moody | dramatic | soft | bright",
      "emotion": "feeling of the scene"
    }
  ]
}
Output ONLY the JSON object, no markdown fences, no commentary.`;

export const Route = createFileRoute("/api/storyboard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { story } = (await request.json()) as { story?: string };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!story?.trim()) return new Response("story required", { status: 400 });

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: story.trim() },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return new Response(`Gateway ${res.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = json.choices?.[0]?.message?.content ?? "";
          const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
          let parsed: unknown;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            return new Response("Model did not return valid JSON", { status: 502 });
          }
          const result = StoryboardSchema.safeParse(parsed);
          if (!result.success) {
            return new Response(`Storyboard validation failed: ${result.error.message.slice(0, 200)}`, { status: 502 });
          }
          return Response.json(result.data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Storyboard failed";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
