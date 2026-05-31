import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2, Film, Copy, Check, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addStoryboard, type StoryboardItem, type StoryboardScene } from "@/lib/library";
import { supabase } from "@/integrations/supabase/client";
import { generateStoryboard } from "@/lib/credits.functions";

export const Route = createFileRoute("/storyboard")({
  head: () => ({
    meta: [
      { title: "Text Storyboard — DAMILOLAPOD AI" },
      { name: "description", content: "Turn any story into 9 cinematic text prompts with consistent location and wardrobe." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: StoryboardPage,
});

type Storyboard = {
  story_title: string;
  style: string;
  grid: string;
  location_bible: string;
  wardrobe_bible: string;
  scenes: StoryboardScene[];
};

function StoryboardPage() {
  const [story, setStory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [copiedId, setCopiedId] = useState<number | "all" | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const runGenerate = useServerFn(generateStoryboard);

  // Listen for sign-out → bounce to login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.navigate({ to: "/login" });
    });
    return () => subscription.unsubscribe();
  }, [router]);

  function buildScenePrompt(s: StoryboardScene, style: string) {
    return [
      `${style}. Scene ${s.scene_number} — ${s.title}.`,
      s.visual_prompt,
      `Location: ${s.location}.`,
      `Wardrobe: ${s.wardrobe}.`,
      `Camera: ${s.camera.angle}, ${s.camera.movement}.`,
      `Lighting: ${s.lighting}. Emotion: ${s.emotion}.`,
    ].join(" ");
  }

  async function copy(text: string, id: number | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function handleGenerate() {
    if (!story.trim()) return toast.error("Please enter a story idea");
    setSubmitting(true);
    setBoard(null);
    setOutOfCredits(false);
    const toastId = toast.loading("Spending 1 credit · writing 9-scene movie flow…");
    try {
      const data = await runGenerate({ data: { story } });
      setBoard(data);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      addStoryboard({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        kind: "storyboard",
        story_title: data.story_title,
        scenes: data.scenes,
      } satisfies StoryboardItem);
      toast.success(`Storyboard ready! ${data.credits_remaining} credits left.`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Storyboard failed";
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        setOutOfCredits(true);
        toast.error("You're out of credits", { id: toastId });
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Text Storyboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your story. AI writes a 9-scene movie flow with consistent location and wardrobe — as ready-to-use text prompts.
        </p>
        <Textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="A girl tries to surprise her boyfriend but accidentally empties his perfume bottle..."
          className="mt-4 min-h-[140px] rounded-xl"
        />
      </div>

      <Button onClick={handleGenerate} disabled={submitting || outOfCredits} className="w-full h-14 rounded-xl text-base font-bold">
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Wand2 className="h-5 w-5" /> Generate · 1 credit</>
        )}
      </Button>

      {outOfCredits && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
          <Coins className="h-6 w-6 mx-auto mb-2 text-primary" />
          <div className="text-sm font-bold">You're out of credits</div>
          <p className="mt-1 text-xs text-muted-foreground">Top-ups are coming soon. Hang tight!</p>
          <Link to="/" className="mt-3 inline-block text-xs font-semibold text-primary">← Back home</Link>
        </div>
      )}

      {board && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Storyboard</div>
                <h3 className="mt-1 text-base font-bold truncate">{board.story_title}</h3>
                <div className="mt-1 text-xs text-muted-foreground">{board.scenes.length} scenes · {board.style}</div>
              </div>
              <button
                onClick={() => copy(board.scenes.map((s) => `#${s.scene_number} ${s.title}\n${buildScenePrompt(s, board.style)}`).join("\n\n"), "all")}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium"
              >
                {copiedId === "all" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy all
              </button>
            </div>
            {board.location_bible && (
              <div className="mt-3 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">Location:</span> {board.location_bible}</div>
            )}
            {board.wardrobe_bible && (
              <div className="mt-1 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">Wardrobe:</span> {board.wardrobe_bible}</div>
            )}
          </div>

          <div className="space-y-2">
            {board.scenes.map((s) => {
              const text = buildScenePrompt(s, board.style);
              return (
                <div key={s.scene_number} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">#{s.scene_number}</span>
                      <div className="text-sm font-semibold truncate">{s.title}</div>
                    </div>
                    <button
                      onClick={() => copy(text, s.scene_number)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium"
                    >
                      {copiedId === s.scene_number ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">{s.description}</div>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2.5 text-[11px] leading-relaxed text-foreground">
{text}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded border border-border px-1.5 py-0.5">{s.camera.angle}</span>
                    <span className="rounded border border-border px-1.5 py-0.5">{s.camera.movement}</span>
                    <span className="rounded border border-border px-1.5 py-0.5">{s.lighting}</span>
                    <span className="rounded border border-border px-1.5 py-0.5">{s.emotion}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!board && !submitting && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Film className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Your 9 scene text prompts will appear here
        </div>
      )}
    </div>
  );
}
