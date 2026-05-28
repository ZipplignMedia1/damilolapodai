import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Upload, Wand2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateVideo, getVideoStatus } from "@/lib/video.functions";
import { addToHistory } from "@/lib/history";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Create Video — DAMILOLAPOD AI" },
      { name: "description", content: "Generate AI videos from text prompts or images. Powered by JSON2Video." },
    ],
  }),
  component: CreatePage,
});

type Mode = "text" | "image";
type Ratio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
type Duration = 5 | 8;


function CreatePage() {
  const navigate = useNavigate();
  const startGeneration = useServerFn(generateVideo);
  const checkVideoStatus = useServerFn(getVideoStatus);
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [duration, setDuration] = useState<Duration>(8);
  
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
    const toastId = toast.loading("Submitting to JSON2Video…");
    try {
      const result = await startGeneration({
        data: {
          mode,
          prompt: prompt.trim(),
          negativePrompt: negative.trim() || undefined,
          aspectRatio: ratio,
          duration,
          imageDataUrl: mode === "image" ? imageDataUrl ?? undefined : undefined,
        },
      });
      toast.loading("Rendering video… this can take a few minutes.", { id: toastId });

      let videoUrl: string | undefined;
      const startedAt = Date.now();
      while (Date.now() - startedAt < 10 * 60 * 1000) {
        await new Promise((resolve) => window.setTimeout(resolve, 7000));
        const status = await checkVideoStatus({ data: { projectId: result.projectId } });
        if (status.status === "failed") throw new Error(status.error);
        if (status.status === "done") {
          videoUrl = status.videoUrl;
          break;
        }
      }

      if (!videoUrl) throw new Error("Video is still processing. Please try again in a few minutes.");

      addToHistory({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        mode, prompt, negativePrompt: negative, aspectRatio: ratio, duration,
        videoUrl,
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
      <p className="text-center text-xs text-muted-foreground">Powered by JSON2Video · 1–3 minutes</p>
    </div>
  );
}
