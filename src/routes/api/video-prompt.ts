import { createFileRoute } from "@tanstack/react-router";

type TargetModel =
  | "universal"
  | "veo3"
  | "veo2"
  | "seedance"
  | "kling"
  | "runway"
  | "pika"
  | "luma"
  | "hailuo"
  | "sora"
  | "wan";

type Body = { idea?: string; duration?: number; target?: TargetModel };

const BASE_SCHEMA = `{
  "shot_number": <integer>,
  "duration": <seconds, integer>,
  "scene": "<one-line scene summary>",
  "camera": [ { "time": <sec>, "angle": "<camera angle / framing>" } ],
  "characters": [
    {
      "name": "<character name>",
      "actions": [ { "time": <sec>, "action": "<what they do>" } ],
      "expressions": [ { "time": <sec>, "expression": "<facial / emotional>" } ],
      "voice_lines": [ { "time": <sec>, "line": "<spoken line>" } ]
    }
  ],
  "sound_effects": [ { "time": <sec>, "effect": "<sfx>" } ],
  "lighting": "<lighting style>",
  "environment": "<setting description>",
  "branding": { "product_name": "<brand or empty>", "tagline": "<tagline or empty>" }
}`;

const TARGET_NOTES: Record<TargetModel, string> = {
  universal:
    "Format works for any modern video model. Keep cinematic vocabulary generic.",
  veo3:
    "Optimize for Google Veo 3. Add a top-level \"dialogue\" string per character voice_line and a \"negative_prompt\" string at the root. Use natural cinematic language Veo understands (lens mm, dolly, handheld, anamorphic).",
  veo2:
    "Optimize for Google Veo 2. Prefer concise descriptive prose inside fields. Add \"negative_prompt\" at root.",
  seedance:
    "Optimize for ByteDance Seedance 1.0 Pro. Emphasize fluid motion, physics, multi-shot continuity. Add \"motion_strength\" (1-10) and \"style\" fields at the root.",
  kling:
    "Optimize for Kling 2.x. Use vivid action verbs, add \"camera_motion\" (static|pan|tilt|dolly|zoom|handheld|orbit), \"negative_prompt\", and \"aspect_ratio\" at the root.",
  runway:
    "Optimize for Runway Gen-3 / Gen-4. Lead each shot with [Camera Motion]: ... [Subject]: ... [Scene]: ... style hints. Add \"seed\" placeholder and \"style\" at root.",
  pika:
    "Optimize for Pika 2.x. Keep prose tight; add \"-camera <motion>\", \"-fps 24\", and \"-ar 16:9\" style hints in a root \"modifiers\" array.",
  luma:
    "Optimize for Luma Dream Machine / Ray 2. Add \"camera_motion\", \"loop\" (bool), and \"enhance_prompt\" (bool) at root. Use natural cinematic language.",
  hailuo:
    "Optimize for MiniMax Hailuo 02. Add \"subject_reference\" (string), \"camera_movement\", and keep prompts under ~1500 chars total.",
  sora:
    "Optimize for OpenAI Sora. Favor long descriptive prose per shot with strong continuity bibles for character + location. Add \"style\" and \"mood\" at root.",
  wan:
    "Optimize for Alibaba Wan 2.x. Add \"motion_bucket_id\" (1-255), \"fps\", and \"aspect_ratio\" at root. Keep prompts concrete and physical.",
};

const TARGET_LABEL: Record<TargetModel, string> = {
  universal: "Universal",
  veo3: "Google Veo 3",
  veo2: "Google Veo 2",
  seedance: "ByteDance Seedance",
  kling: "Kling AI",
  runway: "Runway Gen-3/4",
  pika: "Pika 2",
  luma: "Luma Dream Machine",
  hailuo: "MiniMax Hailuo",
  sora: "OpenAI Sora",
  wan: "Alibaba Wan 2",
};

function buildSystem(target: TargetModel) {
  return `You are a cinematic video prompt engineer for ${TARGET_LABEL[target]}. Convert the user's idea into a single JSON object describing a shot-by-shot video plan.

Base schema (extend with the target-specific fields described below):
${BASE_SCHEMA}

Target model: ${TARGET_LABEL[target]}.
Target-specific guidance: ${TARGET_NOTES[target]}

Rules:
- Output ONLY the JSON object. No markdown fences, no commentary.
- Add a root-level "target_model": "${target}" field.
- 7-10 camera beats spread across the duration.
- 1-3 characters depending on the idea. If no characters fit, use an empty array.
- All "time" values are seconds within [0, duration], in increasing order per array.
- If the idea mentions a brand/product, fill branding; otherwise use empty strings.
- Keep voice_lines short and natural; reflect the requested language/tone.`;
}

export const Route = createFileRoute("/api/video-prompt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { idea, duration, target } = (await request.json()) as Body;
        const key = process.env.BLUESMINDS_API_KEY;
        if (!key) return new Response("Missing BLUESMINDS_API_KEY", { status: 500 });
        if (!idea?.trim()) return new Response("idea required", { status: 400 });
        const dur = Math.max(3, Math.min(60, Number(duration) || 10));
        const tgt: TargetModel = (target && TARGET_NOTES[target] ? target : "universal");
        const model = process.env.BLUESMINDS_MODEL || "gpt-4o-mini";

        try {
          const res = await fetch("https://api.bluesminds.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: buildSystem(tgt) },
                { role: "user", content: `Idea: ${idea.trim()}\nDuration: ${dur} seconds.\nTarget: ${TARGET_LABEL[tgt]}.\nGenerate the JSON.` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            if (res.status === 429) return new Response("Rate limit — try again shortly.", { status: 429 });
            if (res.status === 402) return new Response("AI credits exhausted. Add credits in Settings.", { status: 402 });
            return new Response(`Gateway ${res.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          let content = (json.choices?.[0]?.message?.content ?? "")
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          let parsed: unknown;
          try {
            parsed = JSON.parse(content);
          } catch {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              try { parsed = JSON.parse(match[0]); } catch {}
            }
            if (!parsed) {
              return new Response(`Model did not return valid JSON: ${content.slice(0, 300)}`, { status: 502 });
            }
          }
          return Response.json(parsed);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Failed", { status: 502 });
        }
      },
    },
  },
});
