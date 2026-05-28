import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Upload, Wand2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateVideo } from "@/lib/video.functions";
import { addToHistory } from "@/lib/history";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Create Video — DAMILOLAPOD AI" },
      { name: "description", content: "Generate AI videos from text prompts or images. Powered by Veo 3." },
    ],
  }),
  component: CreatePage,
});

type Mode = "text" | "image";
type Ratio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
type Duration = 5 | 8;

const RATIOS: { value: Ratio; label: string; sub: string }[] = [
  { value: "16:9", label: "16:9", sub: "Landscape" },
  { value: "9:16", label: "9:16", sub: "Portrait" },
  { value: "1:1", label: "1:1", sub: "Square" },
  { value: "4:3", label: "4:3", sub: "Standard" },
  { value: "3:4", label: "3:4", sub: "Photo" },
];

function CreatePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [duration, setDuration] = useState<Duration>(8);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImagePick(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Please describe your video");
    if (mode === "image" && !imageDataUrl) return toast.error("Please upload an image");
    setSubmitting(true);
    const toastId = toast.loading("Submitting to Veo 3… this can take a few minutes.");
    try {
      const result = await generateVideo({
        data: {
          mode,
          prompt: prompt.trim(),
          negativePrompt: negative.trim() || undefined,
          aspectRatio: ratio,
          duration,
          imageDataUrl: mode === "image" ? imageDataUrl ?? undefined : undefined,
        },
      });
      addToHistory({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        mode, prompt, negativePrompt: negative, aspectRatio: ratio, duration,
        videoUrl: result.videoUrl,
        thumbnail: imageDataUrl ?? undefined,
      });
      toast.success("Video ready!", { id: toastId });
      navigate({ to: "/history" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Create Video</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AI Powered
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 grid grid-cols-2 border-b border-border">
          {(["text", "image"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative pb-3 text-sm font-semibold transition-colors ${mode === m ? "text-foreground" : "text-muted-foreground"}`}
            >
              {m === "text" ? "Text to Video" : "Image to Video"}
              {mode === m && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>

        {/* Image picker (image mode) */}
        {mode === "image" && (
          <div className="mt-5">
            <label className="text-sm font-semibold">Upload an image</label>
            {imageDataUrl ? (
              <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
                <img src={imageDataUrl} alt="upload" className="w-full object-cover max-h-64" />
                <button onClick={() => setImageDataUrl(null)} className="absolute top-2 right-2 rounded-full bg-foreground/70 p-1.5 text-background backdrop-blur">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="mt-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-10 cursor-pointer hover:bg-muted transition">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to upload an image</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImagePick(e.target.files[0])} />
              </label>
            )}
          </div>
        )}

        {/* Prompt */}
        <div className="mt-5">
          <label className="text-sm font-semibold">
            {mode === "text" ? "Describe your video" : "Describe the motion"}
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === "text" ? "A serene ocean sunset with gentle waves..." : "Camera slowly zooms in, leaves sway in the wind..."}
            className="mt-2 min-h-[110px] resize-none rounded-xl border-border bg-background text-base"
          />
        </div>

        {/* Advanced */}
        <button
          onClick={() => setAdvancedOpen(v => !v)}
          className="mt-5 flex w-full items-center gap-2 text-left text-sm font-semibold text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Advanced Settings
          {advancedOpen ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
        </button>

        {advancedOpen && (
          <div className="mt-3 space-y-5 rounded-xl border border-border bg-muted/30 p-4">
            {/* Aspect Ratio */}
            <div>
              <p className="text-sm font-semibold">Aspect Ratio</p>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {RATIOS.map(r => {
                  const active = ratio === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setRatio(r.value)}
                      className={`flex flex-col items-center rounded-xl border px-3 py-2.5 transition ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-foreground hover:border-primary/50"}`}
                    >
                      <span className="text-base font-bold leading-tight">{r.label}</span>
                      <span className={`text-[11px] ${active ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{r.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration */}
            <div>
              <p className="text-sm font-semibold">Duration</p>
              <div className="mt-3 flex gap-2.5">
                {([5, 8] as Duration[]).map(d => {
                  const active = duration === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 max-w-24 rounded-xl border py-3 text-sm font-bold transition ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-foreground hover:border-primary/50"}`}
                    >
                      {d}s
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Negative prompt */}
            <div>
              <p className="text-sm font-semibold">Negative Prompt</p>
              <p className="text-xs text-muted-foreground">What to avoid in the video</p>
              <input
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                placeholder="blurry, low quality, distorted..."
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        onClick={handleGenerate}
        disabled={submitting}
        className="w-full h-14 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
      >
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Wand2 className="h-5 w-5" /> Generate Video</>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Powered by Google Veo 3 via fal.ai · 1–3 minutes</p>
    </div>
  );
}
