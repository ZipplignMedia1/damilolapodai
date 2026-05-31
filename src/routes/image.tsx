import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Download, Sparkles, Plus, X, ImageIcon } from "lucide-react";
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
const TYPES = [
  { id: "photo", label: "Photo" },
  { id: "graphic-design", label: "Graphic Design" },
  { id: "book-cover", label: "Book Cover" },
  { id: "face-portrait", label: "Face / Portrait" },
  { id: "flyer", label: "Flyer" },
  { id: "logo", label: "Logo" },
  { id: "illustration", label: "Illustration" },
  { id: "product", label: "Product Shot" },
  { id: "prompt", label: "Prompt (Detailed)" },
] as const;
type ImageType = (typeof TYPES)[number]["id"];

type Gen =
  | { id: string; prompt: string; status: "loading"; progress: number; ratio: Ratio }
  | { id: string; prompt: string; status: "done"; image: string; ratio: Ratio };

function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("nano-banana");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [type, setType] = useState<ImageType>("photo");
  const [showType, setShowType] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gens, setGens] = useState<Gen[]>([]);
  const [attachment, setAttachment] = useState<{ name: string; dataUrl: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [gens.length]);

  useEffect(() => () => { if (progressTimer.current) clearInterval(progressTimer.current); }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Please enter a prompt");
    const currentPrompt = prompt.trim();
    const currentRatio = ratio;
    setSubmitting(true);
    const id = crypto.randomUUID();
    const gen: Gen = { id, prompt: currentPrompt, status: "loading", progress: 0, ratio: currentRatio };
    setGens((g) => [gen, ...g]);
    setPrompt("");
    const initImage = attachment?.dataUrl;
    setAttachment(null);

    let p = 0;
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 95) p = 95;
      setGens((prev) =>
        prev.map((g) => (g.id === id && g.status === "loading" ? { ...g, progress: Math.round(p) } : g))
      );
    }, 900);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, model, style, aspectRatio: currentRatio, initImage }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const { image } = (await res.json()) as { image: string };
      setGens((prev) =>
        prev.map((g) => (g.id === id ? { id, prompt: currentPrompt, status: "done", image, ratio: currentRatio } : g))
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

  return (
    <div className="flex flex-col gap-4 pb-[260px]">
      <div ref={feedRef} className="flex flex-col gap-3">
        {gens.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {gens.map((g) =>
              g.status === "loading" ? (
                <SkeletonCard key={g.id} gen={g} ratioClass={ratioClass(g.ratio)} />
              ) : (
                <FeedCard key={g.id} gen={g} ratioClass={ratioClass(g.ratio)} />
              )
            )}
          </div>
        )}
      </div>

      {/* Sticky composer */}
      <div className="fixed bottom-[88px] left-0 right-0 z-30 px-4">
        <div className="mx-auto max-w-screen-md">
          {showStyle && (
            <div className="mb-2 rounded-lg border border-border bg-card/95 p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Style</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`rounded-md border px-3 py-1 text-xs font-medium capitalize transition ${style === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-background/60 p-1.5 pr-2">
                <img src={attachment.dataUrl} alt="attachment" className="h-8 w-8 rounded object-cover" />
                <span className="flex-1 truncate text-[11px] text-muted-foreground">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-xl bg-muted/30 p-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-foreground"
                aria-label="Upload image"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
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
                className="min-h-[28px] max-h-32 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <button
                onClick={handleGenerate}
                disabled={submitting || !prompt.trim()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] transition disabled:opacity-50"
                aria-label="Generate"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as ModelId)}
                className="rounded-lg border border-border bg-background/60 px-2 py-1 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
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
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold capitalize transition ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/60 text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function SkeletonCard({ gen, ratioClass }: { gen: Extract<Gen, { status: "loading" }>; ratioClass: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className={`${ratioClass} relative w-full overflow-hidden bg-muted`}>
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-[shimmer_1.5s_infinite_linear]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary animate-pulse">
            <ImageIcon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">{gen.progress}%</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/10">
          <div
            className="h-full bg-[var(--gradient-primary)] transition-[width] duration-300 ease-out"
            style={{ width: `${gen.progress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 p-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <p className="flex-1 truncate text-[10px] text-muted-foreground">{gen.prompt}</p>
      </div>
    </div>
  );
}

function FeedCard({ gen, ratioClass }: { gen: Extract<Gen, { status: "done" }>; ratioClass: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm animate-[fadeIn_0.4s_ease-out]">
      <div className={`${ratioClass} w-full overflow-hidden bg-muted`}>
        <img src={gen.image} alt={gen.prompt} className="h-full w-full object-cover" />
      </div>
      <div className="flex items-center justify-between gap-2 p-2">
        <p className="flex-1 truncate text-[10px] text-muted-foreground">{gen.prompt}</p>
        <a href={gen.image} download={`image-${gen.id}.png`} className="shrink-0 rounded-md border border-border p-1 text-muted-foreground hover:text-foreground" aria-label="Download">
          <Download className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-[var(--gradient-surface)] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-lg font-extrabold tracking-tight">Generate your first image</h2>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Type a prompt below. Your latest creations appear here.
      </p>
    </div>
  );
}
