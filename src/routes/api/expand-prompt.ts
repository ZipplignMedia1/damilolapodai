import { createFileRoute } from "@tanstack/react-router";

type Format = "movie" | "drama" | "skit" | "music_video" | "commercial" | "image" | "video";

type Body = { description?: string; format?: Format; tone?: string; duration?: number };

const FORMAT_GUIDE: Record<Format, string> = {
  movie: "Cinematic feature-film shot. Think 35mm, anamorphic lens, deep blocking, layered sound design, naturalistic performance.",
  drama: "Nigerian-style emotional drama scene (Nollywood). Focus on character emotion, dialogue beats, domestic or community setting, warm practical lighting.",
  skit: "Short-form comedy skit (Instagram/TikTok). Punchy setup→twist→punchline, exaggerated reactions, vertical 9:16 framing, bright daylight or ring-light look.",
  music_video: "Music video shot. Rhythmic camera motion synced to a beat, stylized color grade, performance + narrative cutaways.",
  commercial: "30s commercial spot. Hero product framing, aspirational lifestyle, clean key light, end card with logo/tagline.",
  image: "Single still image. Describe composition, subject, environment, lighting, lens, mood, color palette, and finishing style in vivid sensory detail.",
  video: "Generic AI video clip. Describe subject, action, environment, camera motion, lighting, duration pacing, and style references.",
};

function buildSystem(fmt: Format, tone: string, duration: number) {
  return `You are a senior prompt engineer for AI image and video models, specialized in African (Nigerian) screen content — Nollywood drama, skits, music videos, and commercials.

Your job: take the user's rough shot/scene description and rewrite it as a single, richly detailed, production-ready prompt that an AI image or video model will execute well.

Format: ${fmt.toUpperCase()} — ${FORMAT_GUIDE[fmt]}
Tone: ${tone || "natural, grounded, authentic"}
${fmt === "image" ? "" : `Target duration: ${duration}s.`}

Rules:
- Output ONE prompt only. No headers, no bullet lists, no "Prompt:" label, no markdown fences, no commentary.
- Lead with the subject and action, then environment, then camera, then lighting, then mood/style.
- Use concrete sensory language: lens (35mm, 50mm, 85mm), lighting (golden hour, practical tungsten, soft window), color palette, textures.
- Keep character/wardrobe/location specific so it can stay consistent across shots.
- Preserve Nigerian cultural details when present (Ankara, agbada, gele, Lagos traffic, danfo, suya stand, NEPA, etc.) — never sanitize them away.
- If the user wrote pidgin or Yoruba/Igbo/Hausa, keep the cultural flavor in the description but write the prompt in clear English the model understands.
- ${fmt === "image" ? "Add aspect ratio hint (e.g. 9:16 portrait, 1:1 square, 16:9 landscape) based on context." : "Include camera motion (static, pan, dolly-in, handheld, crane) and a clear beat structure across the duration."}
- 80–180 words. Vivid but tight.`;
}

type ChatMessage = { role: "system" | "user"; content: string };

function gatewayError(message: string, status?: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function callBluesminds(key: string, model: string, messages: ChatMessage[]) {
  const res = await fetch("https://api.bluesminds.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
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
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw gatewayError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

async function generatePrompt(messages: ChatMessage[]) {
  const bluesmindsKey = process.env.BLUESMINDS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const bluesmindsModel = process.env.BLUESMINDS_MODEL || "gpt-4o-mini";

  if (bluesmindsKey) {
    try {
      return await callBluesminds(bluesmindsKey, bluesmindsModel, messages);
    } catch (error) {
      if (!geminiKey) throw error;
    }
  }

  if (!geminiKey) throw gatewayError("Missing BLUESMINDS_API_KEY or GEMINI_API_KEY", 500);
  return callGemini(geminiKey, messages);
}

export const Route = createFileRoute("/api/expand-prompt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { description, format, tone, duration } = (await request.json()) as Body;
        if (!description?.trim()) return new Response("description required", { status: 400 });
        const fmt: Format = (format && FORMAT_GUIDE[format] ? format : "drama");
        const dur = Math.max(3, Math.min(60, Number(duration) || 10));

        try {
          const prompt = (await generatePrompt([
            { role: "system", content: buildSystem(fmt, tone || "", dur) },
            { role: "user", content: description.trim() },
          ]))
            .replace(/^```[a-z]*\s*/i, "")
            .replace(/```\s*$/i, "")
            .replace(/^\s*prompt\s*:\s*/i, "")
            .trim();
          return Response.json({ prompt, format: fmt });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Failed", { status: 502 });
        }
      },
    },
  },
});
