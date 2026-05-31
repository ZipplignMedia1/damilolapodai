import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/verify-gemini")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
          return Response.json(
            { ok: false, error: "GEMINI_API_KEY is not configured on the server." },
            { status: 200 },
          );
        }
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`,
            { method: "GET" },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return Response.json(
              { ok: false, error: `Google AI rejected the key (${res.status}). ${text.slice(0, 200)}` },
              { status: 200 },
            );
          }
          return Response.json({ ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Network error";
          return Response.json({ ok: false, error: msg }, { status: 200 });
        }
      },
    },
  },
});
