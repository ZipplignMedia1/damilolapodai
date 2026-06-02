import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ───────── Shared AI helpers ─────────

type ChatMessage = { role: "system" | "user"; content: string };

async function callBluesminds(key: string, model: string, messages: ChatMessage[], json: boolean) {
  const res = await fetch("https://api.bluesminds.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1800,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bluesminds ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(key: string, messages: ChatMessage[], json: boolean) {
  const prompt = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function runAI(messages: ChatMessage[], json: boolean): Promise<string> {
  const bm = process.env.BLUESMINDS_API_KEY;
  const gem = process.env.GEMINI_API_KEY;
  const bmModel = process.env.BLUESMINDS_MODEL || "gpt-4o-mini";
  let lastErr: unknown;
  if (bm) {
    try {
      return await callBluesminds(bm, bmModel, messages, json);
    } catch (e) {
      lastErr = e;
    }
  }
  if (gem) {
    try {
      return await callGemini(gem, messages, json);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No AI provider configured");
}

function cleanJsonText(s: string) {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function tryParseJson(s: string): unknown | null {
  const cleaned = cleanJsonText(s);
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    return null;
  }
}

// ───────── JSON Prompt Generator ─────────

const TARGETS = [
  "universal",
  "veo3",
  "veo2",
  "seedance",
  "kling",
  "runway",
  "pika",
  "luma",
  "hailuo",
  "sora",
  "wan",
] as const;
type TargetModel = (typeof TARGETS)[number];

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

function buildJsonSystem(target: TargetModel) {
  return `You are a cinematic video prompt engineer for ${TARGET_LABEL[target]}.
Convert the user's idea into a structured shot-by-shot JSON plan.

CRITICAL RULES:
- FOLLOW THE USER'S IDEA EXACTLY. If they describe a fight scene, output a fight scene. If they describe a romance, output a romance. NEVER turn it into an advert, commercial, or product placement unless they explicitly asked for one.
- branding.product_name and branding.tagline MUST be empty strings unless the user actually named a brand/product.
- Genre, tone, characters, location and action must reflect ONLY what the user described.
- Output ONLY a valid JSON object, no markdown fences, no commentary.
- Add "target_model": "${target}" at the root.
- 4-6 camera beats spread across the requested duration.
- 1-3 characters as fits the idea (empty array if none).
- All "time" values are seconds within [0, duration] in increasing order.

Base schema (extend with target-specific fields):
{
  "shot_number": <integer>,
  "duration": <seconds, integer>,
  "scene": "<one-line scene summary from the user's idea>",
  "camera": [ { "time": <sec>, "angle": "<camera angle / framing>" } ],
  "characters": [
    {
      "name": "<character name>",
      "actions": [ { "time": <sec>, "action": "<what they do>" } ],
      "expressions": [ { "time": <sec>, "expression": "<facial / emotional>" } ],
      "voice_lines": [ { "time": <sec>, "line": "<spoken line, optional>" } ]
    }
  ],
  "sound_effects": [ { "time": <sec>, "effect": "<sfx>" } ],
  "lighting": "<lighting style fitting the mood>",
  "environment": "<setting description from the user's idea>",
  "branding": { "product_name": "", "tagline": "" }
}`;
}

export const runJsonPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { idea: string; duration: number; target: string }) =>
    z
      .object({
        idea: z.string().min(3).max(2000),
        duration: z.number().int().min(3).max(60),
        target: z.string().default("universal"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tgt: TargetModel = (TARGETS as readonly string[]).includes(data.target)
      ? (data.target as TargetModel)
      : "universal";

    // 1. Generate FIRST (no charge if this fails)
    const content = await runAI(
      [
        { role: "system", content: buildJsonSystem(tgt) },
        {
          role: "user",
          content: `User's idea (follow this exactly, do not turn it into an ad): ${data.idea.trim()}\nDuration: ${data.duration} seconds.\nTarget model: ${TARGET_LABEL[tgt]}.`,
        },
      ],
      true,
    );
    const parsed = tryParseJson(content);
    if (!parsed) throw new Error("AI returned invalid JSON — no DPOD charged. Try again.");

    // 2. Only NOW spend credits (atomic via RPC)
    const cost = data.duration; // 1 DPOD per second
    const { data: newBalance, error: spendErr } = await supabase.rpc("spend_credit", {
      _amount: cost,
      _reason: `json_prompt:${data.duration}s`,
    });
    if (spendErr) {
      if (spendErr.message.includes("INSUFFICIENT_CREDITS")) throw new Error("INSUFFICIENT_CREDITS");
      throw new Error(spendErr.message);
    }

    return { result: parsed as Record<string, unknown>, creditsRemaining: (newBalance as number) ?? 0 };
  });

// ───────── Director (Prompt / Story / Voice / Analyze) ─────────

const FORMAT_GUIDE: Record<string, string> = {
  movie:
    "Cinematic feature-film shot. 35mm or anamorphic lens, deep blocking, layered sound design, naturalistic performance, dramatic pacing.",
  drama:
    "Nollywood-style emotional drama. Strong character emotion, dialogue beats, domestic or community setting, warm practical lighting.",
  skit:
    "Short-form comedy skit (IG/TikTok). Setup → twist → punchline, exaggerated reactions, 9:16 framing, snappy timing.",
  playlet:
    "Stage-style playlet. Theatrical blocking, clear acts, expressive dialogue, single location with strong character beats.",
  music_video:
    "Music video shot. Rhythmic camera motion, stylized color grade, performance + narrative cutaways, beat-synced cuts.",
  commercial:
    "30s commercial / ad spot. Hero product framing, aspirational lifestyle, clean key light, strong tagline beat.",
  image: "Single still image. Composition, subject, environment, lighting, lens, mood, palette, finish.",
  video:
    "Generic AI video clip. Subject, action, environment, camera motion, lighting, pacing, style references.",
};

const ALLOWED_FORMATS = Object.keys(FORMAT_GUIDE);

type DirectorBody = {
  mode: "expand" | "story" | "voice" | "analyze";
  description?: string;
  format?: string;
  tone?: string;
  duration?: number;
  idea?: string;
  genre?: string;
  length?: "short" | "medium" | "long";
  character?: string;
  gender?: "male" | "female" | "neutral";
  language?: string;
  prompt?: string;
  target?: string;
};

function directorSystem(body: DirectorBody): { system: string; user: string; json: boolean } {
  const mode = body.mode;

  if (mode === "expand") {
    const fmt = body.format && FORMAT_GUIDE[body.format] ? body.format : "drama";
    const dur = Math.max(3, Math.min(60, Number(body.duration) || 10));
    const tone = body.tone || "natural, grounded, authentic";
    const isAd = fmt === "commercial";
    return {
      system: `You are a trained ${fmt.toUpperCase()} director (Nigerian / African screen specialist). Convert the user's rough description into one production-ready prompt that ACTUALLY MATCHES the requested format.

Format you MUST deliver: ${fmt.toUpperCase()} — ${FORMAT_GUIDE[fmt]}
Tone: ${tone}
${fmt === "image" ? "" : `Target duration: ${dur}s.`}

CRITICAL:
- This is a ${fmt.toUpperCase()}. Do NOT turn it into something else.
- ${isAd ? "Since the user picked COMMERCIAL, branding/product hero IS allowed." : "Do NOT add brands, products, taglines, or advert framing. No 'aspirational lifestyle' fluff unless the user asked."}
- Preserve the user's actual subject, action, and intent. If they said "fight scene", deliver a fight scene. If they said "argument", deliver an argument.
- Output ONE prompt only. No headers, no bullets, no "Prompt:" label, no markdown, no commentary.
- Lead with subject and action, then environment, camera, lighting, mood/style.
- Concrete sensory language: lens, lighting, palette, textures, blocking, camera motion.
- Preserve Nigerian / African cultural detail where natural (Ankara, agbada, gele, danfo, NEPA, suya, pidgin slang, etc.) — only when it fits.
- ${fmt === "image" ? "Add aspect ratio hint (9:16, 1:1, or 16:9)." : "Include camera motion and clear beat structure across the duration."}
- 80–180 words. Vivid but tight.`,
      user: body.description?.trim() || "",
      json: false,
    };
  }

  if (mode === "story") {
    const length = body.length || "short";
    const wordTarget = length === "long" ? "700–1000" : length === "medium" ? "350–550" : "150–250";
    return {
      system: `You are a Nigerian screenwriter and storyteller. Turn the small idea into a vivid, emotionally grounded story treatment that STAYS true to the user's premise.
Genre: ${body.genre || "drama"}
Tone: ${body.tone || "authentic, character-driven"}
Length: ${wordTarget} words.

Rules:
- Begin with a 1-line punchy title on its own line, blank line, then the prose.
- 3-act structure: setup, conflict, resolution.
- Stay in the requested genre. Don't add commercial / advert beats.
- Specific Nigerian texture where it fits (settings, names, slang, food, transport, faith).
- Show, don't tell. Sensory detail. Real dialogue when it earns its place.
- End on a beat that lingers — not a moral lecture.
- No markdown, no bullets.`,
      user: body.idea?.trim() || "",
      json: false,
    };
  }

  if (mode === "voice") {
    return {
      system: `You are a voice direction engineer. Convert the user's character description into a structured voice prompt for cinematic TTS (ElevenLabs-style).

Output STRICT JSON only:
{
  "voice_match": "<short style label>",
  "gender": "male" | "female" | "neutral",
  "language": "<language or accent>",
  "pitch": <integer -10..+10>,
  "warmth": <0..100>,
  "naturalness": <0..100>,
  "depth": <0..100>,
  "pacing": <0.6..1.6, one decimal>,
  "emotion": <0..100>,
  "delivery_notes": "<2-3 sentences directing the read>",
  "sample_line": "<one short line the voice would naturally say>"
}

Defaults: gender=${body.gender || "male"}, language=${body.language || "Nigerian English"}.
Tune numbers to the character. Be specific, not generic.`,
      user: body.character?.trim() || "",
      json: true,
    };
  }

  // analyze
  return {
    system: `You are a prompt quality auditor for generative AI (image, video, story, voice).
Target model type: ${body.target || "image/video"}.

Return STRICT JSON only:
{
  "score": <0..100>,
  "verdict": "excellent" | "good" | "okay" | "weak",
  "fit_for_model": <true|false>,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missing": ["concrete things to add (lens, lighting, camera motion, aspect ratio, mood)"],
  "rewrite": "<improved version, single paragraph, 80-180 words, no markdown>"
}

Be honest. Vague → low score. Solid → say so.`,
    user: body.prompt?.trim() || "",
    json: true,
  };
}

const DirectorSchema = z.object({
  mode: z.enum(["expand", "story", "voice", "analyze"]),
  description: z.string().max(4000).optional(),
  format: z.string().max(40).optional(),
  tone: z.string().max(200).optional(),
  duration: z.number().int().min(3).max(60).optional(),
  idea: z.string().max(4000).optional(),
  genre: z.string().max(40).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  character: z.string().max(2000).optional(),
  gender: z.enum(["male", "female", "neutral"]).optional(),
  language: z.string().max(80).optional(),
  prompt: z.string().max(4000).optional(),
  target: z.string().max(40).optional(),
  cost: z.number().int().min(1).max(20),
  reason: z.string().min(1).max(80),
});

export const runDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof DirectorSchema>) => DirectorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Validate format against whitelist for "expand"
    if (data.mode === "expand" && data.format && !ALLOWED_FORMATS.includes(data.format)) {
      data.format = "drama";
    }

    const { system, user, json } = directorSystem(data);
    if (!user) throw new Error("Input required");

    // 1. Generate FIRST
    const raw = await runAI(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json,
    );
    const trimmed = cleanJsonText(raw);
    let resultText: string | null = null;
    let resultJson: Record<string, unknown> | null = null;
    if (json) {
      const parsed = tryParseJson(trimmed);
      if (!parsed) throw new Error("AI returned invalid JSON — no DPOD charged. Try again.");
      resultJson = parsed as Record<string, unknown>;
    } else {
      if (!trimmed) throw new Error("AI returned empty response — no DPOD charged. Try again.");
      resultText = trimmed;
    }

    // 2. Spend credits only on success
    const { data: newBalance, error: spendErr } = await supabase.rpc("spend_credit", {
      _amount: data.cost,
      _reason: data.reason,
    });
    if (spendErr) {
      if (spendErr.message.includes("INSUFFICIENT_CREDITS")) throw new Error("INSUFFICIENT_CREDITS");
      throw new Error(spendErr.message);
    }

    return {
      resultText,
      resultJson,
      creditsRemaining: (newBalance as number) ?? 0,
    };
  });
