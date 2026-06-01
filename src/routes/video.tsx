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
    const toastId = toast.loading(`Generating ${duration}s video…`);
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
      toast.success(`Video ready!`, { id: toastId });
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
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm relative overflow-hidden">
        {/* Coming Soon Overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-lg max-w-xs">
            <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary opacity-60" />
            <h3 className="text-lg font-bold">Coming Soon</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We're integrating a new AI video generation API. Stay tuned!
            </p>
          </div>
        </div>

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
            disabled
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
                disabled
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition opacity-50 ${
                  duration === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {d}s
                <span className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px]">Free</span>
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
                disabled
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition opacity-50 ${
                  aspect === a.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
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
            <button
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium opacity-50"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Upload image
            </button>
          </div>
        </div>
      </div>

      <Button
        disabled
        className="w-full h-14 rounded-xl text-base font-bold opacity-60"
      >
        <Sparkles className="h-5 w-5" /> Generate · Coming Soon
      </Button>

      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <Video className="h-6 w-6 mx-auto mb-2 opacity-60" />
        Video generation is temporarily unavailable while we upgrade our AI provider.
      </div>
    </div>
  );
}
