import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, credits")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { display_name: null, avatar_url: null, credits: 0 };
  });

// Spend N DPOD with a reason label. Returns the new balance.
export const spendCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number; reason: string }) =>
    z.object({ amount: z.number().int().min(1).max(100), reason: z.string().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: newBalance, error } = await supabase.rpc("spend_credit", {
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) {
      if (error.message.includes("INSUFFICIENT_CREDITS")) throw new Error("INSUFFICIENT_CREDITS");
      throw new Error(error.message);
    }
    return { creditsRemaining: (newBalance as number) ?? 0 };
  });

// Refund N DPOD (used when a generation fails after credits were spent).
export const refundCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number; reason: string }) =>
    z.object({ amount: z.number().int().min(1).max(100), reason: z.string().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: newBalance, error } = await supabase.rpc("credit_for_payment", {
      _reference: `refund-${userId}-${Date.now()}`,
      _user_id: userId,
      _credits: data.amount,
      _kind: data.reason,
    });
    if (error) throw new Error(error.message);
    return { creditsRemaining: (newBalance as number) ?? 0 };
  });


const SceneSchema = z.object({
  scene_number: z.number().int(),
  title: z.string(),
  description: z.string(),
  visual_prompt: z.string(),
  location: z.string(),
  wardrobe: z.string(),
  camera: z.object({ angle: z.string(), movement: z.string() }),
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

export type StoryboardResult = z.infer<typeof StoryboardSchema> & { credits_remaining: number };

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

export const generateStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { story: string }) =>
    z.object({ story: z.string().min(3).max(4000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<StoryboardResult> => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Server misconfigured: missing LOVABLE_API_KEY");

    // Spend 2 DPOD credits per generation (throws INSUFFICIENT_CREDITS if balance < 2)
    const GENERATION_COST = 2;
    const { data: newBalance, error: spendErr } = await supabase.rpc("spend_credit", {
      _amount: GENERATION_COST,
      _reason: "generation",
    });
    if (spendErr) {
      if (spendErr.message.includes("INSUFFICIENT_CREDITS")) {
        throw new Error("INSUFFICIENT_CREDITS");
      }
      throw new Error(spendErr.message);
    }

    let refunded = false;
    const refund = async () => {
      if (refunded) return;
      refunded = true;
      // Best-effort refund of the full generation cost
      const { data: prof } = await supabase
        .from("profiles")
        .select("credits")
        .eq("user_id", userId)
        .maybeSingle();
      const before = prof?.credits ?? 0;
      const after = before + GENERATION_COST;
      await supabase.from("profiles").update({ credits: after }).eq("user_id", userId);
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: GENERATION_COST,
        reason: "refund_failed_generation",
        balance_after: after,
      });
    };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: data.story.trim() },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        await refund();
        throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        await refund();
        throw new Error("Model did not return valid JSON");
      }
      const result = StoryboardSchema.safeParse(parsed);
      if (!result.success) {
        await refund();
        throw new Error("Storyboard validation failed");
      }
      return { ...result.data, credits_remaining: newBalance as number };
    } catch (err) {
      await refund();
      throw err;
    }
  });
