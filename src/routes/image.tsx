import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Download, Sparkles, ChevronDown } from "lucide-react";
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

type Gen = { id: string; prompt: string; image: string };

function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("nano-banana");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("photorealistic");
  const [showStyle, setShowStyle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gens, setGens] = useState<Gen[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [gens.length]);

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Please enter a prompt");
    const currentPrompt = prompt.trim();
    setSubmitting(true);
    const toastId = toast.loading("Generating image…");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, model, style, aspectRatio: ratio }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const { image } = (await res.json()) as { image: string };
      const id = crypto.randomUUID();
      setGens((g) => [{ id, prompt: currentPrompt, image }, ...g]);
      addImage({ id, createdAt: Date.now(), kind: "image", prompt: currentPrompt, dataUrl: image, source: "text" });
      setPrompt("");
      toast.success("Image ready!", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  const [latest, ...rest] = gens;
  const ratioClass = (r: Ratio) =>
    r === "1:1" ? "aspect-square" : r === "16:9" ? "aspect-video" : "aspect-[9/16]";

  return (
    <div className="flex flex-col gap-4 pb-[260px]">
      {/* Feed */}
      <div ref={feedRef} className="flex flex-col gap-3">
        {gens.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Latest big */}
            <FeedCard gen={latest} ratioClass={ratioClass(ratio)} primary />
            {/* Previous as 2-col grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {rest.map((g) => (
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

function FeedCard({ gen, ratioClass, primary }: { gen: Gen; ratioClass: string; primary?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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
