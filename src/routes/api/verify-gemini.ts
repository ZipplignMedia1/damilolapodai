import { createFileRoute } from "@tanstack/react-router";

// Pollinations.ai needs no API key — always OK.
export const Route = createFileRoute("/api/verify-gemini")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
    },
  },
});
