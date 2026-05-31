This is a large expansion of the current DAMILOLAPOD AI video app. I'll keep the app name as you asked and build it in 3 phases so each phase ships working features instead of a half-done mega-build.

## Phase 1 — Creative features (no auth)

New pages added to the bottom nav (rename "Create" → "Home Dashboard"):

1. **Home Dashboard** (`/`) — entry tiles for each tool + recent items.
2. **Generate Image** (`/image`) — text→image. Style (photoreal / cinematic / 3D / anime), aspect ratio (1:1 / 16:9 / 9:16), lighting (studio / natural / dramatic). Uses Lovable AI Gateway (`openai/gpt-image-2`, streamed).
3. **Upload & Transform** (`/transform`) — image→image. Upload + modification prompt + strength slider + style-transfer toggle. Uses `google/gemini-3.1-flash-image-preview` with the uploaded image as reference.
4. **Generate Video** (`/video`) — existing text→video and image→video screen, moved off `/`. Adds 30s duration and camera-motion selector (static / pan / dolly / handheld) appended to the prompt sent to WaveSpeed.
5. **Storyboard Creator** (`/storyboard`) — paste a story → server calls `google/gemini-3-flash-preview` with structured output (Zod schema) to produce a 9-scene 3×3 storyboard matching your `scene_format`. Each scene gets a "Generate image" button (uses the visual_prompt) and a "Generate video" button (uses visual_prompt + camera).
6. **Saved Projects** (`/history`) — current history page, extended to hold images, videos, and storyboards (IndexedDB, same pattern as today).

New server routes (TanStack Start, not Edge Functions):
- `src/routes/api/generate-image.ts` — SSE stream from Lovable AI Gateway.
- `src/routes/api/transform-image.ts` — image-to-image via Gemini.
- `src/routes/api/storyboard.ts` — structured 9-scene JSON.
- Existing `src/routes/api/generate-video.ts` stays (WaveSpeed).
- Existing `src/routes/api/keyframes.ts` stays.

## Phase 2 — Accounts + cloud projects

- Enable Lovable Cloud.
- Email/password + Google sign-in.
- `profiles` table + `projects` table (user-scoped, RLS via `auth.uid()`).
- Migrate Saved Projects from IndexedDB to cloud (signed-in users); guests keep local history.
- `usage_counters` table to track daily free-tier generations per user.

## Phase 3 — Monetization (Stripe)

- Enable Lovable's built-in Stripe Payments (no API keys needed from you).
- One `Premium` subscription product.
- Free tier: configurable daily caps per feature (image / video / storyboard). Enforced server-side in each `/api/*` route via `usage_counters`.
- Premium tier: unlimited generations, HD video (1080p WaveSpeed model), advanced storyboard controls (custom scene count, regen single scene).
- `/pricing` page + "Upgrade" CTA when a free user hits a cap.

## Technical notes

- Keep `src/routes/__root.tsx` header as "DAMILOLAPOD AI".
- Storyboard server fn uses AI SDK `Output.object` with Zod to guarantee the JSON shape; no manual parsing.
- Per-route SEO `head()` on every new public route.
- Phase 1 stays single-user / no DB so it ships fast. Phase 2 introduces Cloud + RLS. Phase 3 layers Stripe on top.

## What I need from you to start

1. **Confirm I should start with Phase 1 now.** I'll build all 5 new feature pages + server routes in this turn.
2. After Phase 1 ships and you've tried it, say "go" and I'll do Phase 2, then Phase 3.

Trying to do all 3 phases in one shot would mean ~20+ files, schema migrations, Stripe setup, and untested auth flows all landing at once — high chance something breaks and hard to debug. Phased is faster end-to-end.