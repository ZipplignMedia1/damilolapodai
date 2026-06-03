import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  MoreVertical,
  Plus,
  ListPlus,
  SlidersHorizontal,
  Loader2,
  Download,
  Maximize2,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
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

const ASPECTS: { id: "1:1" | "16:9" | "9:16"; label: string }[] = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
];

const IMAGE_TYPES: { id: ImageType; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "face-portrait", label: "Portrait" },
  { id: "product", label: "Product" },
  { id: "illustration", label: "Illustration" },
  { id: "graphic-design", label: "Graphic" },
  { id: "book-cover", label: "Book Cover" },
  { id: "flyer", label: "Flyer" },
  { id: "logo", label: "Logo" },
  { id: "prompt", label: "Custom" },
];

const MODELS = [
  { id: "flux", label: "Flux" },
  { id: "flux-realism", label: "Realism" },
  { id: "flux-anime", label: "Anime" },
  { id: "flux-3d", label: "3D" },
  { id: "turbo", label: "Turbo" },
] as const;

type ModelId = typeof MODELS[number]["id"];

function ImagePage() {
  const nav = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [type, setType] = useState<ImageType>("photo");
  const [model, setModel] = useState<ModelId>("flux");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; creditsRemaining: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const qc = useQueryClient();
  const runGenerate = useServerFn(generateImage);

  const cost = 2;

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Enter an image prompt");
    setLoading(true);
    setResult(null);
    const toastId = toast.loading(`Spending ${cost} DPOD · generating…`);
    try {
      const data = await runGenerate({
        data: { prompt: prompt.trim(), aspectRatio: aspect, type, model },
      });
      setResult(data);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(`Image ready! ${data.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      if (msg.includes("INSUFFICIENT_CREDITS")) {
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
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav({ to: "/home" })}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-base font-medium">Image</span>
          <div className="flex items-center gap-0.5 ml-1">
            <span className="h-1 w-1 rounded-full bg-white/70" />
            <span className="h-1 w-1 rounded-full bg-white/70" />
            <span className="h-1 w-1 rounded-full bg-white/70" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-full hover:bg-white/10" aria-label="New">
            <Plus className="h-5 w-5" />
          </button>
          <button className="p-1.5 rounded-full border border-white/30 hover:bg-white/10" aria-label="Help">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-white/10" aria-label="More">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Canvas / empty state */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-white/60">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">Generating…</p>
          </div>
        ) : result?.image ? (
          <div className="w-full max-w-md flex flex-col items-center gap-3">
            <img src={result.image} alt="Generated" className="w-full rounded-2xl" />
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <PixelFlower />
            <p className="text-xl text-white/70 font-light leading-tight">
              Start creating
              <br />
              or drop media
            </p>
          </div>
        )}
      </main>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="px-4 pb-2 space-y-3">
          <Chips label="Style" items={IMAGE_TYPES} value={type} onChange={(v) => setType(v as ImageType)} />
          <Chips
            label="Aspect"
            items={ASPECTS}
            value={aspect}
            onChange={(v) => setAspect(v as "1:1" | "16:9" | "9:16")}
          />
          <Chips label="Model" items={MODELS as readonly { id: string; label: string }[]} value={model} onChange={(v) => setModel(v as ModelId)} />
        </div>
      )}

      {/* Bottom composer */}
      <footer className="p-3 pb-5">
        <div className="rounded-3xl bg-[#1c1c1e] border border-white/5 px-3 pt-3 pb-2">
          <div className="flex items-start gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What do you want to create?"
              rows={2}
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 resize-none outline-none px-2 pt-1"
            />
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="p-1 -mt-0.5 text-white/50 hover:text-white"
              aria-label="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/5"
                aria-label="Add"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button className="h-9 px-4 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90">
                {type === "photo" ? "Photo" : IMAGE_TYPES.find((t) => t.id === type)?.label ?? "Agent"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="text-white/70 hover:text-white"
                aria-label="Style"
              >
                <ListPlus className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="text-white/70 hover:text-white"
                aria-label="Settings"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 disabled:opacity-40 enabled:hover:bg-white enabled:hover:text-black transition"
                aria-label="Generate"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-white/40 flex items-center justify-center gap-1.5">
          <Coins className="h-3 w-3" /> {cost} DPOD per image · AI can make mistakes
        </p>
      </footer>
    </div>
  );
}

function Chips({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5 px-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              value === it.id
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/70 border-white/15 hover:text-white"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PixelFlower() {
  // Pixel-art flower icon (8-bit style)
  const px = "bg-white";
  const __ = "bg-transparent";
  const rows = [
    [__, __, px, px, __, px, px, __, __],
    [__, px, __, __, px, __, __, px, __],
    [px, __, px, px, __, px, px, __, px],
    [px, __, px, __, px, __, px, __, px],
    [__, px, __, px, px, px, __, px, __],
    [__, __, px, __, px, __, px, __, __],
    [__, __, __, __, px, __, __, __, __],
    [__, __, __, __, px, __, __, __, __],
    [__, __, __, px, px, px, __, __, __],
  ];
  return (
    <div className="grid grid-cols-9 gap-[3px]">
      {rows.flat().map((c, i) => (
        <span key={i} className={`h-2.5 w-2.5 ${c}`} />
      ))}
    </div>
  );
}
