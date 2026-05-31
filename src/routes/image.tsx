import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Image as ImageIcon, Upload, Wand2, Loader2, X, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { addImage } from "@/lib/library";

export const Route = createFileRoute("/image")({
  head: () => ({
    meta: [
      { title: "Generate Image — DAMILOLAPOD AI" },
      { name: "description", content: "Create photorealistic and cinematic AI images from text or transform uploads." },
    ],
  }),
  component: ImagePage,
});

type Mode = "text" | "transform";
type Ratio = "1:1" | "16:9" | "9:16";

const STYLES = ["photorealistic", "cinematic", "3D render", "anime"] as const;
const MODELS = [
  { id: "nano-banana", label: "Nano Banana" },
  { id: "nano-banana-pro", label: "Nano Banana Pro" },
] as const;
type ModelId = (typeof MODELS)[number]["id"];
const LIGHTING = ["studio", "natural", "dramatic"] as const;

function ImagePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("photorealistic");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [lighting, setLighting] = useState<(typeof LIGHTING)[number]>("natural");
  const [model, setModel] = useState<ModelId>("nano-banana");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [strength, setStrength] = useState(60);
  const [styleTransfer, setStyleTransfer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleImagePick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB");
    const r = new FileReader();
    r.onload = () => setImageDataUrl(r.result as string);
    r.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Please enter a prompt");
    if (mode === "transform" && !imageDataUrl) return toast.error("Please upload an image");
    setSubmitting(true);
    setResult(null);
    const toastId = toast.loading("Generating image…");
    try {
      const endpoint = mode === "text" ? "/api/generate-image" : "/api/transform-image";
      const payload =
        mode === "text"
          ? { prompt, model, style, aspectRatio: ratio, lighting }
          : { prompt, imageDataUrl, strength, styleTransfer };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const { image } = (await res.json()) as { image: string };
      setResult(image);
      addImage({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        kind: "image",
        prompt,
        dataUrl: image,
        source: mode === "text" ? "text" : "transform",
      });
      toast.success("Image ready!", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Generate Image</h2>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1">
          <button
            onClick={() => setMode("text")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "text" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Text to Image
          </button>
          <button
            onClick={() => setMode("transform")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "transform" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Upload & Transform
          </button>
        </div>

        {mode === "transform" && (
          <div className="mt-5">
            <label className="text-sm font-semibold">Source image</label>
            {imageDataUrl ? (
              <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
                <img src={imageDataUrl} alt="src" className="w-full max-h-64 object-cover" />
                <button
                  onClick={() => setImageDataUrl(null)}
                  className="absolute top-2 right-2 rounded-full bg-foreground/70 p-1.5 text-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 py-10 hover:bg-muted"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to upload</span>
                <input
                  ref={fileRef}
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
          <label className="text-sm font-semibold">
            {mode === "text" ? "Describe the image" : "Describe the transformation"}
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === "text" ? "A serene mountain lake at sunrise, mist rolling over the water..." : "Turn this into a cinematic film still with dramatic lighting..."}
            className="mt-2 min-h-[100px] rounded-xl"
          />
        </div>

        {mode === "text" ? (
          <div className="mt-5 space-y-4">
            <Selector label="Style" options={STYLES} value={style} onChange={setStyle} />
            <Selector label="Aspect ratio" options={["1:1", "16:9", "9:16"] as const} value={ratio} onChange={setRatio} />
            <Selector label="Lighting" options={LIGHTING} value={lighting} onChange={setLighting} />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Transformation strength</label>
                <span className="text-sm text-muted-foreground">{strength}</span>
              </div>
              <Slider value={[strength]} onValueChange={(v) => setStrength(v[0])} min={0} max={100} step={5} className="mt-2" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={styleTransfer} onChange={(e) => setStyleTransfer(e.target.checked)} />
              Apply style transfer
            </label>
          </div>
        )}
      </div>

      <Button onClick={handleGenerate} disabled={submitting} className="w-full h-14 rounded-xl text-base font-bold">
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Wand2 className="h-5 w-5" /> {mode === "text" ? "Generate Image" : "Transform Image"}</>
        )}
      </Button>

      {result && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <img src={result} alt="generated" className="w-full" />
          <div className="p-4">
            <a href={result} download={`image-${Date.now()}.png`}>
              <Button variant="outline" className="w-full rounded-lg"><Download className="h-4 w-4" /> Download</Button>
            </a>
          </div>
        </div>
      )}

      {!result && !submitting && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> Saved automatically to your library
        </div>
      )}
    </div>
  );
}

function Selector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${value === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
