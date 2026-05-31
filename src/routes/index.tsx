import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Film, Upload, Wand2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addToHistory } from "@/lib/history";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Create Video — DAMILOLAPOD AI" },
      { name: "description", content: "Animate images into AI videos with a motion prompt. Powered by Lovable." },
    ],
  }),
  component: CreatePage,
});

type Ratio = "16:9" | "9:16" | "1:1";
type Duration = 5 | 10;
type Mode = "text" | "image";






function CreatePage() {
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [duration, setDuration] = useState<Duration>(5);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImagePick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Please describe the video");
    if (mode === "image" && !imageDataUrl) return toast.error("Please upload an image");
    setSubmitting(true);
    const toastId = toast.loading("Generating video… (~20-40s)");
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio: ratio,
          duration,
          imageDataUrl: mode === "image" ? imageDataUrl : null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Generation failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };

      toast.loading("Downloading video…", { id: toastId });
      const videoRes = await fetch(url);
      const videoBlob = await videoRes.blob();
      const videoUrl = URL.createObjectURL(videoBlob);
      const id = crypto.randomUUID();

      await addToHistory({
        id,
        createdAt: Date.now(),
        mode,
        prompt,
        aspectRatio: ratio,
        duration,
        videoUrl,
        videoBlobKey: id,
        thumbnail: imageDataUrl ?? undefined,
      }, videoBlob);
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
            <Film className="h-3.5 w-3.5" /> Free Local
          </div>
        </div>

        {/* Mode toggle */}
        <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("image")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "image" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Image to Video
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Text to Video
          </button>
        </div>

        {/* Image picker */}
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => imageInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") imageInputRef.current?.click();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleImagePick(file);
                }}
                className="relative mt-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-10 cursor-pointer hover:bg-muted transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to upload an image</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, or WebP · max 8MB</span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImagePick(file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Prompt */}
        <div className="mt-5">
          <label className="text-sm font-semibold">
            {mode === "image" ? "Describe the motion" : "Describe the video"}
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === "image"
                ? "Camera slowly zooms in, leaves sway in the wind..."
                : "A neon-lit Tokyo street at night, cinematic, slow dolly forward..."
            }
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
      <p className="text-center text-xs text-muted-foreground">100% free local render · no credits · saves as WebM</p>
    </div>
  );
}
