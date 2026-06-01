import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Loader2, Sparkles, Coins, Wand2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { generateImage, type ImageType } from "@/lib/generation.functions";

export const Route = createFileRoute("/image")({
  head: () => ({
    meta: [
      { title: "Image Generation — DAMILOLAPOD AI" },
      { name: "description", content: "Generate AI images from text prompts." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: ImagePage,
});

const ASPECTS = [
  { id: "1:1", label: "Square 1:1" },
  { id: "16:9", label: "Landscape 16:9" },
  { id: "9:16", label: "Portrait 9:16" },
] as const;

const IMAGE_TYPES: { id: ImageType; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "face-portrait", label: "Portrait" },
  { id: "product", label: "Product" },
  { id: "illustration", label: "Illustration" },
  { id: "graphic-design", label: "Graphic Design" },
  { id: "book-cover", label: "Book Cover" },
  { id: "flyer", label: "Flyer" },
  { id: "logo", label: "Logo" },
  { id: "prompt", label: "Custom" },
];

const MODELS = [
  { id: "flux", label: "Flux (default)" },
  { id: "flux-realism", label: "Flux Realism" },
  { id: "flux-anime", label: "Flux Anime" },
  { id: "flux-3d", label: "Flux 3D" },
  { id: "turbo", label: "Turbo (fast)" },
] as const;

type AspectId = typeof ASPECTS[number]["id"];
type ModelId = typeof MODELS[number]["id"];

function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectId>("1:1");
  const [type, setType] = useState<ImageType>("photo");
  const [model, setModel] = useState<ModelId>("flux");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; creditsRemaining: number } | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const qc = useQueryClient();
  const runGenerate = useServerFn(generateImage);

  const cost = 2; // 2 DPOD per image

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Enter an image prompt");
    setLoading(true);
    setResult(null);
    setOutOfCredits(false);
    const toastId = toast.loading(`Spending ${cost} DPOD · generating image…`);
    try {
      const data = await runGenerate({
        data: {
          prompt: prompt.trim(),
          aspectRatio: aspect,
          type,
          model,
        },
      });
      setResult(data);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(`Image ready! ${data.creditsRemaining} DPOD left.`, { id: toastId });
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
    if (!result?.image) return;
    const a = document.createElement("a");
    a.href = result.image;
    a.download = `damilolapod-image-${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Image Generation</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Describe what you want — AI paints it for you.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            <ImageIcon className="h-3.5 w-3.5" /> AI Image
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A Nigerian woman in traditional Aso Oke fabric, standing under a palm tree at golden hour, photorealistic"
            className="mt-2 min-h-[100px] rounded-xl"
          />
        </div>

        {/* Image Type */}
        <div className="mt-4">
          <label className="text-sm font-semibold">Style</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {IMAGE_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  type === t.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {t.label}
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
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div className="mt-4">
          <label className="text-sm font-semibold">Model</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  model === m.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading || outOfCredits || !prompt.trim()}
        className="w-full h-14 rounded-xl text-base font-bold"
      >
        {loading ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
        ) : (
          <><Sparkles className="h-5 w-5" /> Generate · {cost} DPOD</>
        )}
      </Button>

      {outOfCredits && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
          <Coins className="h-6 w-6 mx-auto mb-2 text-primary" />
          <div className="text-sm font-bold">Not enough DPOD</div>
          <p className="mt-1 text-xs text-muted-foreground">You need {cost} DPOD to generate this image.</p>
          <Link to="/topup" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Coins className="h-3.5 w-3.5" /> Top up now
          </Link>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-xs font-semibold text-muted-foreground">Generated Image</span>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
              >
                <Download className="h-3 w-3" /> Download
              </button>
            </div>
            <div className="p-4">
              <img
                src={result.image}
                alt="Generated"
                className="w-full rounded-xl"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {aspect} · {type} · {model} · Saved to Library
              </p>
            </div>
          </div>

          <Button
            onClick={() => { setResult(null); setPrompt(""); }}
            variant="outline"
            className="w-full h-12 rounded-xl text-sm font-bold"
          >
            <Wand2 className="h-4 w-4 mr-2" /> Create another
          </Button>
        </div>
      )}

      {!result && !loading && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <ImageIcon className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Your generated image will appear here
        </div>
      )}
    </div>
  );
}
