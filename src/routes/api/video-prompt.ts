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
  return `You are a cinematic video prompt engineer for ${TARGET_LABEL[target]}. Convert the user's idea into a compact JSON object describing a shot-by-shot video plan.

Base schema (extend with the target-specific fields described below):
${BASE_SCHEMA}

Target model: ${TARGET_LABEL[target]}.
Target-specific guidance: ${TARGET_NOTES[target]}

Rules:
- Output ONLY the JSON object. No markdown fences, no commentary.
- Add a root-level "target_model": "${target}" field.
- 4-6 camera beats spread across the duration.
- 1-3 characters depending on the idea. If no characters fit, use an empty array.
- All "time" values are seconds within [0, duration], in increasing order per array.
- If the idea mentions a brand/product, fill branding; otherwise use empty strings.
- Keep voice_lines short and natural; reflect the requested language/tone.
- Keep the entire JSON under 1200 words.`;
}

type ChatMessage = { role: "system" | "user"; content: string };

function gatewayError(message: string, status?: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function callBluesminds(key: string, model: string, messages: ChatMessage[], signal: AbortSignal) {
  const res = await fetch("https://api.bluesminds.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 1800,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw gatewayError(`Bluesminds ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callGemini(key: string, messages: ChatMessage[]) {
  const prompt = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw gatewayError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

async function generateJsonPrompt(messages: ChatMessage[], signal: AbortSignal) {
  const bluesmindsKey = process.env.BLUESMINDS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const bluesmindsModel = process.env.BLUESMINDS_MODEL || "gpt-4o-mini";

  if (bluesmindsKey) {
    try {
      return await callBluesminds(bluesmindsKey, bluesmindsModel, messages, signal);
    } catch (error) {
      if (!geminiKey) throw error;
    }
  }

  if (!geminiKey) throw gatewayError("Missing BLUESMINDS_API_KEY or GEMINI_API_KEY", 500);
  return callGemini(geminiKey, messages);
}

function buildFallbackPrompt(idea: string, duration: number, target: TargetModel) {
  const beats = [0, Math.round(duration * 0.25), Math.round(duration * 0.5), Math.round(duration * 0.75), duration]
    .filter((value, index, values) => values.indexOf(value) === index);

  return {
    target_model: target,
    shot_number: 1,
    duration,
    scene: idea,
    camera: beats.map((time, index) => ({
      time,
      angle: [
        "establishing wide shot introducing the setting and subjects",
        "smooth medium shot following the main action",
        "close-up emphasizing emotion and product detail",
        "dynamic tracking shot with clear motion continuity",
        "hero end frame with the key visual centered",
      ][index] ?? "cinematic continuation shot",
    })),
    characters: [
      {
        name: "Main subject",
        actions: beats.map((time, index) => ({
          time,
          action: index === 0 ? `enters the scene for: ${idea}` : "continues the performance with natural, believable motion",
        })),
        expressions: beats.map((time, index) => ({
          time,
          expression: index < beats.length - 1 ? "engaged and expressive" : "confident and satisfied",
        })),
        voice_lines: [{ time: Math.min(2, duration), line: "This is exactly what we needed." }],
      },
    ],
    sound_effects: [
      { time: 0, effect: "soft ambient room tone" },
      { time: Math.round(duration * 0.5), effect: "subtle cinematic whoosh" },
      { time: duration, effect: "clean branded end sting" },
    ],
    lighting: "bright commercial lighting with soft highlights and natural shadows",
    environment: "polished advertising set designed around the requested concept",
    branding: { product_name: "", tagline: "" },
    style: "cinematic commercial, realistic motion, polished product-advertising finish",
    motion_strength: target === "seedance" ? 7 : undefined,
    fallback: true,
  };
}

function parseJsonOrFallback(content: string, idea: string, duration: number, target: TargetModel) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as unknown; } catch {}
    }
    return buildFallbackPrompt(idea, duration, target);
  }
}

export const Route = createFileRoute("/api/video-prompt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { idea, duration, target } = (await request.json()) as Body;
        if (!idea?.trim()) return new Response("idea required", { status: 400 });
        const dur = Math.max(3, Math.min(60, Number(duration) || 10));
        const tgt: TargetModel = (target && TARGET_NOTES[target] ? target : "universal");

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 22000);
          const content = await generateJsonPrompt([
            { role: "system", content: buildSystem(tgt) },
            { role: "user", content: `Idea: ${idea.trim()}\nDuration: ${dur} seconds.\nTarget: ${TARGET_LABEL[tgt]}.\nGenerate the JSON.` },
          ], controller.signal);
          clearTimeout(timeout);
          const parsed = parseJsonOrFallback(content, idea.trim(), dur, tgt);
          return Response.json(parsed);
        } catch (err) {
          return Response.json(buildFallbackPrompt(idea.trim(), dur, tgt));
        }
      },
    },
  },
});
