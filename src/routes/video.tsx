import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Film, Upload, Wand2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addToHistory } from "@/lib/history";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Generate Video — DAMILOLAPOD AI" },
      { name: "description", content: "Generate cinematic videos from text or animate uploaded images." },
    ],
  }),
  component: CreatePage,
});

type Ratio = "16:9" | "9:16" | "1:1";
type Duration = 5 | 10;
type Mode = "text" | "image";
type Motion = "static" | "pan" | "dolly" | "handheld";

function CreatePage() {
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [duration, setDuration] = useState<Duration>(5);
  const [motion, setMotion] = useState<Motion>("static");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImagePick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB");
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
      const fullPrompt = motion !== "static" ? `${prompt.trim()} Camera motion: ${motion}.` : prompt.trim();
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          aspectRatio: ratio,
          duration,
          imageDataUrl: mode === "image" ? imageDataUrl : null,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const { url } = (await res.json()) as { url: string };
      toast.loading("Downloading video…", { id: toastId });
      const videoRes = await fetch(url);
      const videoBlob = await videoRes.blob();
      const videoUrl = URL.createObjectURL(videoBlob);
      const id = crypto.randomUUID();
      await addToHistory(
        {
          id,
          createdAt: Date.now(),
          mode,
          prompt,
          aspectRatio: ratio,
          duration,
          videoUrl,
          videoBlobKey: id,
          thumbnail: imageDataUrl ?? undefined,
        },
        videoBlob,
      );
      toast.success("Video ready!", { id: toastId });
      navigate({ to: "/history" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Generate Video</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            <Film className="h-3.5 w-3.5" /> WaveSpeed
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1">
          <button onClick={() => setMode("image")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "image" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Image to Video</button>
          <button onClick={() => setMode("text")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "text" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Text to Video</button>
        </div>

        {mode === "image" && (
          <div className="mt-5">
            <label className="text-sm font-semibold">Upload an image</label>
            {imageDataUrl ? (
              <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
                <img src={imageDataUrl} alt="upload" className="w-full object-cover max-h-64" />
                <button onClick={() => setImageDataUrl(null)} className="absolute top-2 right-2 rounded-full bg-foreground/70 p-1.5 text-background">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="mt-2 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 py-10 hover:bg-muted"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to upload</span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImagePick(f);
                    e.currentTarget.value = "";
                  }}
                />
              </button>
            )}
          </div>
        )}

        <div className="mt-5">
          <label className="text-sm font-semibold">{mode === "image" ? "Describe the motion" : "Describe the video"}</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === "image" ? "Camera slowly zooms in, leaves sway in the wind..." : "A neon-lit Tokyo street at night, cinematic..."}
            className="mt-2 min-h-[100px] rounded-xl"
          />
        </div>

        <div className="mt-5 space-y-4">
          <Selector label="Aspect ratio" options={["16:9", "9:16", "1:1"] as const} value={ratio} onChange={setRatio} />
          <Selector label="Duration" options={[5, 10] as const} value={duration} onChange={setDuration} format={(v) => `${v}s`} />
          <Selector label="Camera motion" options={["static", "pan", "dolly", "handheld"] as const} value={motion} onChange={setMotion} />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={submitting} className="w-full h-14 rounded-xl text-base font-bold">
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Wand2 className="h-5 w-5" /> Generate Video</>
        )}
      </Button>
    </div>
  );
}

function Selector<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o)}
            onClick={() => onChange(o)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${value === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
          >
            {format ? format(o) : String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
