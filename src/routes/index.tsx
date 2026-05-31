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

async function fetchKeyframes(prompt: string, count: number): Promise<HTMLImageElement[]> {
  const res = await fetch("/api/keyframes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, count }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI keyframes failed: ${text.slice(0, 160) || res.status}`);
  }
  const { images } = (await res.json()) as { images: string[] };
  return Promise.all(images.map((b64) => loadImage(`data:image/png;base64,${b64}`)));
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const scale = Math.max(width / img.width, height / img.height) * zoom;
  const iw = img.width * scale;
  const ih = img.height * scale;
  const ix = (width - iw) / 2 + panX;
  const iy = (height - ih) / 2 + panY;
  ctx.drawImage(img, ix, iy, iw, ih);
}

async function renderVideo(options: {
  prompt: string;
  ratio: Ratio;
  duration: Duration;
  imageDataUrl: string | null;
  mode: Mode;
  onStatus?: (s: string) => void;
}) {
  if (!window.MediaRecorder) throw new Error("Your browser does not support video rendering.");
  const { width, height } = ratioSizes[options.ratio];

  // Get source images: either user-uploaded (image mode) or AI keyframes (text mode)
  let frames: HTMLImageElement[];
  if (options.mode === "image" && options.imageDataUrl) {
    frames = [await loadImage(options.imageDataUrl)];
  } else {
    options.onStatus?.("Generating AI keyframes…");
    frames = await fetchKeyframes(options.prompt, options.duration === 10 ? 6 : 4);
  }

  options.onStatus?.("Rendering video…");
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
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    recorder.onerror = () => reject(new Error("Render failed."));
  });

  function draw(frame: number) {
    const progress = frame / Math.max(totalFrames - 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Determine current segment between two keyframes
    const segs = Math.max(frames.length, 1);
    const segPos = progress * segs;
    const segIndex = Math.min(Math.floor(segPos), segs - 1);
    const segLocal = segPos - segIndex; // 0..1 within this segment

    const current = frames[segIndex];
    const next = frames[Math.min(segIndex + 1, frames.length - 1)];

    // Ken Burns on current frame (zoom in over the segment)
    const zoomA = 1.05 + segLocal * 0.12;
    const panAx = (segIndex % 2 === 0 ? 1 : -1) * width * 0.04 * segLocal;
    const panAy = -height * 0.03 * segLocal;
    ctx.globalAlpha = 1;
    drawCover(ctx, current, width, height, zoomA, panAx, panAy);

    // Crossfade in the next frame during the last 25% of the segment
    if (next !== current) {
      const fadeStart = 0.75;
      if (segLocal > fadeStart) {
        const fade = (segLocal - fadeStart) / (1 - fadeStart);
        const zoomB = 1.0 + fade * 0.05;
        ctx.globalAlpha = fade;
        drawCover(ctx, next, width, height, zoomB, 0, 0);
        ctx.globalAlpha = 1;
      }
    }

    // Subtle vignette
    const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.max(width, height) * 0.7);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Progress bar
    const pad = Math.max(28, width * 0.04);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(pad, height - pad - 4, width - pad * 2, 4);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(pad, height - pad - 4, (width - pad * 2) * progress, 4);
  }

  recorder.start();
  for (let frame = 0; frame < totalFrames; frame++) {
    draw(frame);
    await new Promise((r) => window.setTimeout(r, 1000 / fps));
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
    const toastId = toast.loading(mode === "text" ? "Generating AI keyframes…" : "Rendering…");
    try {
      const videoBlob = await renderVideo({
        prompt: prompt.trim(),
        ratio,
        duration,
        imageDataUrl,
        mode,
        onStatus: (s) => toast.loading(s, { id: toastId }),
      });
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
