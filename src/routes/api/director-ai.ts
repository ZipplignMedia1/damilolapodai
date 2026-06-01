import { createFileRoute } from "@tanstack/react-router";

type Mode = "expand" | "story" | "voice" | "analyze";

type Body = {
  mode?: Mode;
  description?: string;
  format?: string;
  tone?: string;
  duration?: number;
  // story
  idea?: string;
  genre?: string;
  length?: "short" | "medium" | "long";
  // voice
  character?: string;
  gender?: "male" | "female" | "neutral";
  language?: string;
  // analyze
  prompt?: string;
  target?: string; // image / video / story etc.
};

const FORMAT_GUIDE: Record<string, string> = {
  movie: "Cinematic feature-film shot. 35mm, anamorphic lens, deep blocking, layered sound design, naturalistic performance.",
  drama: "Nollywood-style emotional drama. Character emotion, dialogue beats, domestic or community setting, warm practical lighting.",
  skit: "Short-form comedy skit (IG/TikTok). Setup→twist→punchline, exaggerated reactions, 9:16 framing.",
  music_video: "Music video shot. Rhythmic camera motion, stylized grade, performance + narrative cutaways.",
  commercial: "30s commercial spot. Hero product framing, aspirational lifestyle, clean key light.",
  image: "Single still image. Composition, subject, environment, lighting, lens, mood, palette, finish.",
  video: "Generic AI video clip. Subject, action, environment, camera motion, lighting, pacing, style refs.",
};

function systemFor(body: Body): { system: string; user: string; json?: boolean } {
  const mode: Mode = body.mode || "expand";

  if (mode === "expand") {
    const fmt = body.format && FORMAT_GUIDE[body.format] ? body.format : "drama";
    const dur = Math.max(3, Math.min(60, Number(body.duration) || 10));
    const tone = body.tone || "natural, grounded, authentic";
    return {
      system: `You are a senior prompt engineer for AI image/video models, specialized in African (Nigerian) screen content.
Take the user's rough shot/scene description and rewrite it as a single, richly detailed, production-ready prompt.
Format: ${fmt.toUpperCase()} — ${FORMAT_GUIDE[fmt]}
Tone: ${tone}
${fmt === "image" ? "" : `Target duration: ${dur}s.`}
Rules:
- Output ONE prompt only. No headers, bullets, "Prompt:" label, markdown, or commentary.
- Lead with subject and action, then environment, camera, lighting, mood/style.
- Concrete sensory language: lens, lighting, palette, textures.
- Preserve Nigerian cultural details (Ankara, agbada, gele, danfo, NEPA, suya, etc.).
- ${fmt === "image" ? "Add aspect ratio hint (9:16, 1:1, 16:9)." : "Include camera motion and beat structure."}
- 80–180 words. Vivid but tight.`,
      user: body.description?.trim() || "",
    };
  }

  if (mode === "story") {
    const length = body.length || "short";
    const wordTarget = length === "long" ? "700–1000" : length === "medium" ? "350–550" : "150–250";
    return {
      system: `You are a Nigerian screenwriter and storyteller. Take a small idea and turn it into a vivid, emotionally grounded story treatment.
Genre: ${body.genre || "drama"}
Tone: ${body.tone || "authentic, character-driven"}
Length: ${wordTarget} words.

Rules:
- Output the story directly. No title prefix like "Title:". Begin with a 1-line punchy title on its own line, blank line, then the prose.
- 3-act structure: setup, conflict, resolution.
- Specific Nigerian texture when relevant (settings, names, slang, food, transport, faith).
- Show, don't tell. Sensory detail. Real dialogue when it earns its place.
- End on a beat that lingers — not a moral lecture.
- No markdown, no bullets.`,
      user: body.idea?.trim() || "",
    };
  }

  if (mode === "voice") {
    return {
      system: `You are a voice direction engineer. Convert the user's character description into a structured voice prompt for cinematic TTS (ElevenLabs-style).

Output STRICT JSON only, no markdown, no commentary. Shape:
{
  "voice_match": "<short style label, e.g. 'ElevenLabs cinematic narrator'>",
  "gender": "male" | "female" | "neutral",
  "language": "<language or accent, e.g. 'Nigerian English'>",
  "pitch": <integer -10..+10>,
  "warmth": <0..100>,
  "naturalness": <0..100>,
  "depth": <0..100>,
  "pacing": <0.6..1.6, one decimal>,
  "emotion": <0..100>,
  "delivery_notes": "<2-3 sentences directing the read: emphasis, pauses, breath, energy>",
  "sample_line": "<one short line the voice would naturally say, in-character>"
}

Defaults if user didn't specify: gender=${body.gender || "male"}, language=${body.language || "Nigerian English"}.
Tune numbers to fit the character. Be specific, not generic.`,
      user: body.character?.trim() || "",
      json: true,
    };
  }

  // analyze
  return {
    system: `You are a prompt quality auditor for generative AI models (image, video, story, voice).
Target model type: ${body.target || "image/video"}.

Analyze the user's prompt and return STRICT JSON only, no markdown:
{
  "score": <0..100 overall>,
  "verdict": "excellent" | "good" | "okay" | "weak",
  "fit_for_model": <true|false>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "missing": ["concrete things to add (e.g. lens, lighting, camera motion, aspect ratio, mood)"],
  "rewrite": "<one improved version of the prompt, single paragraph, 80-180 words, no markdown>"
}

Be honest. If the prompt is vague, score low. If it's solid, say so.`,
    user: body.prompt?.trim() || "",
    json: true,
  };
}

export const Route = createFileRoute("/api/director-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const { system, user, json } = systemFor(body);
        if (!user) return new Response("input required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: system },
                { role: "user", content: user },
              ],
              ...(json ? { response_format: { type: "json_object" } } : {}),
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            if (res.status === 429) return new Response("Rate limit — try again shortly.", { status: 429 });
            if (res.status === 402) return new Response("AI credits exhausted.", { status: 402 });
            return new Response(`Gateway ${res.status}: ${text.slice(0, 300)}`, { status: 502 });
          }
          const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          let content = (data.choices?.[0]?.message?.content ?? "")
            .replace(/^```[a-z]*\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          if (json) {
            try {
              const parsed = JSON.parse(content);
              return Response.json({ result: parsed });
            } catch {
              // try to extract JSON block
              const m = content.match(/\{[\s\S]*\}/);
              if (m) {
                try { return Response.json({ result: JSON.parse(m[0]) }); } catch {}
              }
              return Response.json({ result: { raw: content } });
            }
          }
          return Response.json({ result: content });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Failed", { status: 502 });
        }
      },
    },
  },
});
