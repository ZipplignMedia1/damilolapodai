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

const ratioSizes: Record<Ratio, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 960, height: 960 },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderFreeVideo(options: {
  prompt: string;
  ratio: Ratio;
  duration: Duration;
  imageDataUrl: string | null;
  mode: Mode;
}) {
  if (!window.MediaRecorder) throw new Error("Your browser does not support free local video rendering.");
  const { width, height } = ratioSizes[options.ratio];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not start the video renderer.");

  const fps = 30;
  const totalFrames = options.duration * fps;
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: BlobPart[] = [];
  const image = options.imageDataUrl ? await loadImage(options.imageDataUrl) : null;

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    recorder.onerror = () => reject(new Error("Local render failed."));
  });

  function draw(frame: number) {
    const progress = frame / Math.max(totalFrames - 1, 1);
    const pulse = Math.sin(progress * Math.PI * 2);
    const drift = Math.sin(progress * Math.PI);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#151736");
    gradient.addColorStop(0.55, "#4f46e5");
    gradient.addColorStop(1, "#111827");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 9; i++) {
      const x = ((i * width) / 7 + progress * width * 0.22) % (width + 220) - 110;
      const y = height * (0.14 + ((i * 0.17) % 0.76));
      const r = Math.min(width, height) * (0.035 + (i % 3) * 0.018);
      ctx.beginPath();
      ctx.arc(x, y + pulse * 16, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (image) {
      const scale = Math.max(width / image.width, height / image.height) * (1.04 + progress * 0.08);
      const iw = image.width * scale;
      const ih = image.height * scale;
      const ix = (width - iw) / 2 + pulse * width * 0.025;
      const iy = (height - ih) / 2 - drift * height * 0.025;
      ctx.globalAlpha = 0.88;
      ctx.drawImage(image, ix, iy, iw, ih);
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, height * 0.34, 0, height);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.74)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
    }

    const pad = Math.max(42, width * 0.07);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(pad, pad, width * 0.18, 5);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(pad, pad, width * 0.18 * progress, 5);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = `${Math.max(18, width * 0.018)}px Arial, sans-serif`;
    ctx.fillText(options.mode === "image" ? "IMAGE MOTION" : "TEXT VIDEO", pad, pad + 42);

    const fontSize = Math.max(34, Math.min(width * 0.072, height * 0.082));
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = "alphabetic";
    const lines = wrapText(ctx, options.prompt, width - pad * 2, 4);
    const textY = image ? height - pad - (lines.length - 1) * fontSize * 1.12 : height * 0.48;
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#ffffff";
    lines.forEach((line, index) => {
      ctx.fillText(line, pad, textY + index * fontSize * 1.12);
    });
    ctx.shadowBlur = 0;
  }

  recorder.start();
  for (let frame = 0; frame < totalFrames; frame++) {
    draw(frame);
    await new Promise((resolve) => window.setTimeout(resolve, 1000 / fps));
  }
  recorder.stop();
  return finished;
}


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
    const toastId = toast.loading("Rendering locally…");
    try {
      const videoBlob = await renderFreeVideo({ prompt: prompt.trim(), ratio, duration, imageDataUrl, mode });
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
