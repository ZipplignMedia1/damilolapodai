import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Wand2, Film, Camera, Lightbulb, Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addStoryboard, type StoryboardItem, type StoryboardScene } from "@/lib/library";

export const Route = createFileRoute("/storyboard")({
  head: () => ({
    meta: [
      { title: "Storyboard Creator — DAMILOLAPOD AI" },
      { name: "description", content: "Turn any story idea into a 3x3 cinematic storyboard with detailed scene prompts." },
    ],
  }),
  component: StoryboardPage,
});

type Storyboard = { story_title: string; style: string; grid: string; scenes: StoryboardScene[] };

function StoryboardPage() {
  const [story, setStory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [board, setBoard] = useState<Storyboard | null>(null);

  async function handleGenerate() {
    if (!story.trim()) return toast.error("Please enter a story idea");
    setSubmitting(true);
    setBoard(null);
    const toastId = toast.loading("Building 9-scene storyboard…");
    try {
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const data = (await res.json()) as Storyboard;
      setBoard(data);
      const item: StoryboardItem = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        kind: "storyboard",
        story_title: data.story_title,
        scenes: data.scenes,
      };
      addStoryboard(item);
      toast.success("Storyboard ready!", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Storyboard failed", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Storyboard Creator</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paste a story idea. AI splits it into 9 cinematic scenes.</p>
        <Textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="A girl tries to surprise her boyfriend but accidentally empties his perfume bottle..."
          className="mt-4 min-h-[140px] rounded-xl"
        />
      </div>

      <Button onClick={handleGenerate} disabled={submitting} className="w-full h-14 rounded-xl text-base font-bold">
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Wand2 className="h-5 w-5" /> Generate 9 Scenes</>
        )}
      </Button>

      {board && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Storyboard</div>
            <h3 className="mt-1 text-base font-bold">{board.story_title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">{board.scenes.length} scenes · {board.style}</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {board.scenes.map((s) => (
              <div key={s.scene_number} className="rounded-xl border border-border bg-card p-2 text-[10px]">
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <Film className="h-5 w-5" />
                </div>
                <div className="mt-1 font-semibold text-foreground text-[11px] truncate">{s.scene_number}. {s.title}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {board.scenes.map((s) => (
              <details key={s.scene_number} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <summary className="cursor-pointer font-semibold list-none flex items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">#{s.scene_number}</span>
                  {s.title}
                </summary>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">{s.description}</p>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">
                    <div className="font-semibold uppercase tracking-wide text-muted-foreground text-[10px]">Visual prompt</div>
                    <p className="mt-1">{s.visual_prompt}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <Tag icon={<Camera className="h-3 w-3" />}>{s.camera.angle} · {s.camera.movement}</Tag>
                    <Tag icon={<Lightbulb className="h-3 w-3" />}>{s.lighting}</Tag>
                    <Tag icon={<Heart className="h-3 w-3" />}>{s.emotion}</Tag>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground">
      {icon} {children}
    </span>
  );
}
