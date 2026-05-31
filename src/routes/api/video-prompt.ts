import { createFileRoute } from "@tanstack/react-router";

type Body = { idea?: string; duration?: number };

const SYSTEM = `You are a cinematic video prompt engineer. Convert the user's idea into a single JSON object describing a shot-by-shot video plan. Follow this EXACT schema and key order:

{
  "shot_number": <integer>,
  "duration": <seconds, integer>,
  "scene": "<one-line scene summary>",
  "camera": [ { "time": <sec>, "angle": "<camera angle / framing>" } ],
  "characters": [
    {
      "name": "<character name>",
      "actions": [ { "time": <sec>, "action": "<what they do>" } ],
      "expressions": [ { "time": <sec>, "expression": "<facial / emotional>" } ],
      "voice_lines": [ { "time": <sec>, "line": "<spoken line, emojis ok>" } ]
    }
  ],
  "sound_effects": [ { "time": <sec>, "effect": "<sfx description>" } ],
  "lighting": "<lighting style>",
  "environment": "<setting description>",
  "branding": { "product_name": "<brand or empty string>", "tagline": "<tagline or empty string>" }
}

Rules:
- Output ONLY the JSON object. No markdown fences, no commentary.
- 7-10 camera beats spread across the duration.
- 1-3 characters depending on the idea. If no characters fit (e.g. product shot), use an empty array.
- All "time" values are seconds within [0, duration], in increasing order per array.
- If the idea mentions a brand/product, fill branding; otherwise use empty strings.
- Keep voice_lines short and natural; reflect the requested language/tone of the idea.`;

export const Route = createFileRoute("/api/video-prompt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { idea, duration } = (await request.json()) as Body;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!idea?.trim()) return new Response("idea required", { status: 400 });
        const dur = Math.max(3, Math.min(60, Number(duration) || 10));

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: `Idea: ${idea.trim()}\nDuration: ${dur} seconds.\nGenerate the JSON.` },
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
          const content = (json.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
          let parsed: unknown;
          try { parsed = JSON.parse(content); } catch {
            return new Response("Model did not return valid JSON", { status: 502 });
          }
          return Response.json(parsed);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Failed", { status: 502 });
        }
      },
    },
  },
});
