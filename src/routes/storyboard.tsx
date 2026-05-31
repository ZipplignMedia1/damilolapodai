import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, Wand2, Film, Plus, X, Download, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { addStoryboard, type StoryboardItem, type StoryboardScene } from "@/lib/library";

export const Route = createFileRoute("/storyboard")({
  head: () => ({
    meta: [
      { title: "Image Storyboard — DAMILOLAPOD AI" },
      { name: "description", content: "Upload your characters and generate a consistent 9-scene cinematic image storyboard." },
    ],
  }),
  component: StoryboardPage,
});

type Storyboard = { story_title: string; style: string; grid: string; scenes: StoryboardScene[] };
type SceneImage = { status: "idle" | "loading" | "done" | "error"; dataUrl?: string; error?: string };

function StoryboardPage() {
  const [story, setStory] = useState("");
  const [characters, setCharacters] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [images, setImages] = useState<Record<number, SceneImage>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  function handleAddCharacters(files: FileList | null) {
    if (!files?.length) return;
    const slots = Math.max(0, 4 - characters.length);
    Array.from(files).slice(0, slots).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setCharacters((prev) => (prev.length < 4 ? [...prev, reader.result as string] : prev));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  async function generateSceneImage(scene: StoryboardScene, style: string) {
    setImages((p) => ({ ...p, [scene.scene_number]: { status: "loading" } }));
    try {
      const res = await fetch("/api/storyboard-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${scene.visual_prompt}. Camera: ${scene.camera.angle}, ${scene.camera.movement}. Lighting: ${scene.lighting}. Emotion: ${scene.emotion}.`,
          characterImages: characters,
          style,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const data = (await res.json()) as { image: string };
      setImages((p) => ({ ...p, [scene.scene_number]: { status: "done", dataUrl: data.image } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scene failed";
      setImages((p) => ({ ...p, [scene.scene_number]: { status: "error", error: msg } }));
    }
  }

  async function handleGenerate() {
    if (!story.trim()) return toast.error("Please enter a story idea");
    if (characters.length === 0) return toast.error("Upload at least one character image");
    setSubmitting(true);
    setBoard(null);
    setImages({});
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
      addStoryboard({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        kind: "storyboard",
        story_title: data.story_title,
        scenes: data.scenes,
      } satisfies StoryboardItem);
      toast.success("Generating scene images…", { id: toastId });
      // Generate scene images sequentially to avoid hammering the gateway
      for (const scene of data.scenes) {
        await generateSceneImage(scene, data.style);
      }
      toast.success("Storyboard ready!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Storyboard failed", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Image Storyboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your characters, describe the story. AI generates 9 consistent cinematic scenes.
        </p>

        {/* Characters */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Characters ({characters.length}/4)
          </div>
          <div className="grid grid-cols-4 gap-2">
            {characters.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <img src={src} alt={`Character ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => setCharacters((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                  aria-label="Remove character"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {characters.length < 4 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/50 transition"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleAddCharacters(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <Textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="A girl tries to surprise her boyfriend but accidentally empties his perfume bottle..."
          className="mt-4 min-h-[120px] rounded-xl"
        />
      </div>

      <Button onClick={handleGenerate} disabled={submitting} className="w-full h-14 rounded-xl text-base font-bold">
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Wand2 className="h-5 w-5" /> Generate Image Storyboard</>
        )}
      </Button>

      {board && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Storyboard</div>
            <h3 className="mt-1 text-base font-bold">{board.story_title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">{board.scenes.length} scenes · {board.style}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {board.scenes.map((s) => {
              const img = images[s.scene_number];
              return (
                <div key={s.scene_number} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    {img?.status === "done" && img.dataUrl ? (
                      <img src={img.dataUrl} alt={s.title} className="h-full w-full object-cover" />
                    ) : img?.status === "loading" ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Skeleton className="h-full w-full rounded-none" />
                        <Loader2 className="absolute h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : img?.status === "error" ? (
                      <button
                        onClick={() => board && generateSceneImage(s, board.style)}
                        className="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-destructive p-2 text-center"
                      >
                        <X className="h-4 w-4 mb-1" />
                        Retry
                      </button>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <span className="absolute top-1 left-1 rounded bg-background/80 backdrop-blur px-1.5 py-0.5 text-[10px] font-bold">
                      #{s.scene_number}
                    </span>
                    {img?.status === "done" && img.dataUrl && (
                      <a
                        href={img.dataUrl}
                        download={`scene-${s.scene_number}.png`}
                        className="absolute top-1 right-1 h-6 w-6 rounded-md bg-background/80 backdrop-blur flex items-center justify-center"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold truncate">{s.title}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2">{s.description}</div>
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
          Your image storyboard will appear here
        </div>
      )}
    </div>
  );
}
