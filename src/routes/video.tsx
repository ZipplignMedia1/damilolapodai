import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Video, Loader2, Sparkles, Coins, Wand2, ImageIcon, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { generateVideo } from "@/lib/generation.functions";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Video Generation — DAMILOLAPOD AI" },
      { name: "description", content: "Generate AI videos from text prompts." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: VideoPage,
});

const ASPECTS = [
  { id: "16:9", label: "Landscape 16:9" },
  { id: "9:16", label: "Portrait 9:16" },
  { id: "1:1", label: "Square 1:1" },
] as const;

type AspectId = typeof ASPECTS[number]["id"];

function VideoPage() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [aspect, setAspect] = useState<AspectId>("16:9");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ videoUrl: string; creditsRemaining: number } | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const runGenerate = useServerFn(generateVideo);

  const cost = duration; // 5 or 10 DPOD

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      toast.success("Image uploaded — video will animate from this frame");
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Enter a video prompt");
    setLoading(true);
    setResult(null);
    setOutOfCredits(false);
    const toastId = toast.loading(`Spending ${cost} DPOD · generating ${duration}s video…`);
    try {
      const data = await runGenerate({
        data: {
          prompt: prompt.trim(),
          duration,
          aspectRatio: aspect,
          imageDataUrl,
        },
      });
      setResult(data);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(`Video ready! ${data.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        setOutOfCredits(true);
        toast.error("Not enough DPOD", { id: toastId });
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result?.videoUrl) return;
    const a = document.createElement("a");
    a.href = result.videoUrl;
    a.download = `damilolapod-video-${Date.now()}.mp4`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Video Generation</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Describe a scene — AI turns it into a short video clip.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            <Video className="h-3.5 w-3.5" /> AI Video
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A serene African sunset over the savanna, golden light, elephants walking in the distance, cinematic"
            className="mt-2 min-h-[100px] rounded-xl"
          />
        </div>

        {/* Duration */}
        <div className="mt-4">
          <label className="text-sm font-semibold">Duration</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {([5, 10] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  duration === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}s
                <span className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px]">{d} DPOD</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="mt-4">
          <label className="text-sm font-semibold">Aspect Ratio</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAspect(a.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  aspect === a.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Image-to-video upload */}
        <div className="mt-4">
          <label className="text-sm font-semibold">Starting Frame (optional)</label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Upload an image to animate from it</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {imageDataUrl ? "Replace image" : "Upload image"}
            </button>
            {imageDataUrl && (
              <button
                onClick={() => setImageDataUrl(null)}
                className="text-xs text-muted-foreground underline"
              >
                Remove
              </button>
            )}
          </div>
          {imageDataUrl && (
            <img
              src={imageDataUrl}
              alt="Starting frame"
              className="mt-2 max-h-32 rounded-lg border border-border"
            />
          )}
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="w-full h-14 rounded-xl text-base font-bold"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" /> Generate · {cost} DPOD
          </>
        )}
      </Button>

      {outOfCredits && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <Coins className="h-4 w-4" /> Out of DPOD
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            You don't have enough DPOD to generate this video.
          </p>
          <Link
            to="/wallet"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Wand2 className="h-3.5 w-3.5" /> Top up DPOD
          </Link>
        </div>
      )}

      {result?.videoUrl && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <video
            src={result.videoUrl}
            controls
            className="w-full rounded-xl"
          />
          <Button
            onClick={handleDownload}
            variant="outline"
            className="mt-3 w-full rounded-xl"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
    </div>
  );
}
