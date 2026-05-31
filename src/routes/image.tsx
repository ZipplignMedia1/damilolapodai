import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Download, Sparkles, ChevronDown, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { addImage } from "@/lib/library";

export const Route = createFileRoute("/image")({
  head: () => ({
    meta: [
      { title: "Generate Image — DAMILOLAPOD AI" },
      { name: "description", content: "Create photorealistic and cinematic AI images from text." },
    ],
  }),
  component: ImagePage,
});

type Ratio = "1:1" | "16:9" | "9:16";
const MODELS = [
  { id: "nano-banana", label: "Nano Banana" },
  { id: "nano-banana-pro", label: "Nano Banana Pro" },
] as const;
type ModelId = (typeof MODELS)[number]["id"];
const RATIOS: Ratio[] = ["1:1", "16:9", "9:16"];
const STYLES = ["photorealistic", "cinematic", "3D render", "anime"] as const;

type Gen =
  | { id: string; prompt: string; status: "loading"; progress: number }
  | { id: string; prompt: string; status: "done"; image: string };

function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("nano-banana");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("photorealistic");
  const [showStyle, setShowStyle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gens, setGens] = useState<Gen[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [gens.length]);

  // cleanup progress timer on unmount
  useEffect(() => () => { if (progressTimer.current) clearInterval(progressTimer.current); }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Please enter a prompt");
    const currentPrompt = prompt.trim();
    setSubmitting(true);
    const id = crypto.randomUUID();
    const gen: Gen = { id, prompt: currentPrompt, status: "loading", progress: 0 };
    setGens((g) => [gen, ...g]);
    setPrompt("");

    // simulate progress 0 -> 95 over ~12s
    let p = 0;
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      p += Math.random() * 8 + 2; // 2-10% increments
      if (p >= 95) p = 95;
      setGens((prev) =>
        prev.map((g) => (g.id === id && g.status === "loading" ? { ...g, progress: Math.round(p) } : g))
      );
    }, 900);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, model, style, aspectRatio: ratio }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const { image } = (await res.json()) as { image: string };
      setGens((prev) =>
        prev.map((g) => (g.id === id ? { id, prompt: currentPrompt, status: "done", image } : g))
      );
      addImage({ id, createdAt: Date.now(), kind: "image", prompt: currentPrompt, dataUrl: image, source: "text" });
      toast.success("Image ready!");
    } catch (err) {
      setGens((prev) => prev.filter((g) => g.id !== id));
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setSubmitting(false);
      if (progressTimer.current) clearInterval(progressTimer.current);
    }
  }

  const ratioClass = (r: Ratio) =>
    r === "1:1" ? "aspect-square" : r === "16:9" ? "aspect-video" : "aspect-[9/16]";

  const loadingGens = gens.filter((g): g is Extract<Gen, { status: "loading" }> => g.status === "loading");
  const doneGens = gens.filter((g): g is Extract<Gen, { status: "done" }> => g.status === "done");
  const [latestDone, ...restDone] = doneGens;

  return (
    <div className="flex flex-col gap-4 pb-[260px]">
      {/* Feed */}
      <div ref={feedRef} className="flex flex-col gap-3">
        {gens.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Loading cards (skeletons) */}
            {loadingGens.map((g) => (
              <SkeletonCard key={g.id} gen={g} ratioClass={ratioClass(ratio)} />
            ))}

            {/* Latest completed big */}
            {latestDone && <FeedCard gen={latestDone} ratioClass={ratioClass(ratio)} primary />}

            {/* Previous completed as 2-col grid */}
            {restDone.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {restDone.map((g) => (
                  <FeedCard key={g.id} gen={g} ratioClass="aspect-square" />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky composer */}
      <div className="fixed bottom-[88px] left-0 right-0 z-30 px-4">
        <div className="mx-auto max-w-screen-md">
          {showStyle && (
            <div className="mb-2 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Style</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${style === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-3xl border border-border bg-card/95 p-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <div className="flex items-end gap-2 px-2 pt-1">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Type prompt…"
                rows={1}
                className="min-h-[40px] max-h-32 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <button
                onClick={handleGenerate}
                disabled={submitting || !prompt.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] transition disabled:opacity-50"
                aria-label="Generate"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <Pill onClick={() => setModel(model === "nano-banana" ? "nano-banana-pro" : "nano-banana")}>
                {MODELS.find((m) => m.id === model)?.label}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Pill>
              <div className="flex items-center gap-1.5">
                <Pill onClick={() => setShowStyle((s) => !s)} active={showStyle}>
                  <Sparkles className="h-3 w-3" /> {style}
                </Pill>
                <Pill
                  onClick={() => {
                    const i = RATIOS.indexOf(ratio);
                    setRatio(RATIOS[(i + 1) % RATIOS.length]);
                  }}
                >
                  {ratio}
                </Pill>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/60 text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function SkeletonCard({ gen, ratioClass }: { gen: Extract<Gen, { status: "loading" }>; ratioClass: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className={`${ratioClass} relative w-full overflow-hidden bg-muted`}>
        {/* animated skeleton gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-[shimmer_1.5s_infinite_linear]" />
        {/* centered icon + progress */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary animate-pulse">
            <ImageIcon className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{gen.progress}%</span>
        </div>
        {/* progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/10">
          <div
            className="h-full bg-[var(--gradient-primary)] transition-[width] duration-300 ease-out"
            style={{ width: `${gen.progress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 p-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <p className="flex-1 truncate text-[11px] text-muted-foreground">{gen.prompt}</p>
      </div>
    </div>
  );
}

function FeedCard({ gen, ratioClass, primary }: { gen: Extract<Gen, { status: "done" }>; ratioClass: string; primary?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-[fadeIn_0.4s_ease-out]">
      <div className={`${ratioClass} w-full overflow-hidden bg-muted`}>
        <img src={gen.image} alt={gen.prompt} className="h-full w-full object-cover" />
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className={`flex-1 truncate text-muted-foreground ${primary ? "text-xs" : "text-[11px]"}`}>{gen.prompt}</p>
        <a href={gen.image} download={`image-${gen.id}.png`} className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground" aria-label="Download">
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-[var(--gradient-surface)] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-lg font-extrabold tracking-tight">Generate your first image</h2>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Type a prompt below. Your latest creations appear here.
      </p>
    </div>
  );
}
