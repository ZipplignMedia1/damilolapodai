import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SceneSchema = z.object({
  scene_number: z.number().int(),
  title: z.string(),
  description: z.string(),
  visual_prompt: z.string(),
  location: z.string(),
  wardrobe: z.string(),
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
  location_bible: z.string(),
  wardrobe_bible: z.string(),
  scenes: z.array(SceneSchema).length(9),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;

const SYSTEM = `You are a cinematic storyboard director. Convert the user's story into a 9-scene movie sequence with a clear narrative arc:
1-2: SETUP (establish character, world, mood)
3-4: INCITING INCIDENT / RISING ACTION
5-6: CONFLICT / PEAK TENSION
7-8: CLIMAX / TURNING POINT
9: RESOLUTION

CRITICAL CONSISTENCY RULES:
- Establish a "location_bible": detailed description of the main setting (architecture, props, color palette, time of day progression). Reuse this exact description across every scene unless the story demands a location change.
- Establish a "wardrobe_bible": detailed description of each character's outfit (fabric, color, accessories, hair). The SAME wardrobe must persist across all 9 scenes (unless the story is multi-day).
- Every scene's "location" and "wardrobe" fields must reference the bibles verbatim so the AI image model keeps continuity.
- Each scene should feel like a continuous film, not isolated images.

Return ONLY valid JSON matching this schema:
{
  "story_title": string,
  "style": "ultra-realistic cinematic",
  "grid": "3x3",
  "location_bible": "detailed reusable location description",
  "wardrobe_bible": "detailed reusable wardrobe description per character",
  "scenes": [
    {
      "scene_number": 1-9,
      "title": "short scene title",
      "description": "what is happening (story beat)",
      "visual_prompt": "ultra-realistic cinematic visual description for THIS beat",
      "location": "exact reference to location_bible + scene-specific framing",
      "wardrobe": "exact reference to wardrobe_bible for characters in shot",
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
