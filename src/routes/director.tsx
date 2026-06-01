import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FORMATS = [
  { id: "drama", label: "Nollywood Drama" },
  { id: "movie", label: "Cinematic Movie" },
  { id: "skit", label: "Comedy Skit (IG/TikTok)" },
  { id: "music_video", label: "Music Video" },
  { id: "commercial", label: "Commercial / Ad" },
  { id: "image", label: "Single Image" },
  { id: "video", label: "Generic Video Clip" },
] as const;
type FormatId = typeof FORMATS[number]["id"];

export const Route = createFileRoute("/director")({
  head: () => ({
    meta: [
      { title: "Prompt Director — DAMILOLAPOD AI" },
      { name: "description", content: "Turn rough shot ideas into detailed AI-ready prompts." },
    ],
  }),
  component: DirectorPage,
});

function DirectorPage() {
  const [desc, setDesc] = useState("");
  const [format, setFormat] = useState<FormatId>("drama");
  const [tone, setTone] = useState("");
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function expand() {
    if (!desc.trim()) return toast.error("Describe your shot or scene first");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, format, tone, duration }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const json = await res.json();
      setResult(json.prompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied prompt");
    setTimeout(() => setCopied(false), 1500);
  }

  const isImage = format === "image";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Prompt Director</h2>
            <p className="mt-1 text-xs text-muted-foreground">Rough idea in → cinema-grade prompt out.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            <Wand2 className="h-3.5 w-3.5" /> AI
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Your shot or scene description</label>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. A mother confronts her son in the kitchen about missing school fees. He looks down, ashamed. She is angry but loves him."
            className="mt-2 min-h-[140px] rounded-xl"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Format</label>
          <Select value={format} onValueChange={(v) => setFormat(v as FormatId)}>
            <SelectTrigger className="mt-2 h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Tone (optional)</label>
          <Input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. tense, hopeful, comedic, gritty"
            className="mt-2 h-11 rounded-xl"
          />
        </div>

        {!isImage && (
          <div className="mt-4">
            <label className="text-sm font-semibold">Duration</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 15, 20, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${duration === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button onClick={expand} disabled={loading} className="w-full h-12 rounded-xl text-base font-bold">
        {loading ? (<><Loader2 className="h-5 w-5 animate-spin" /> Directing…</>) : (<><Sparkles className="h-5 w-5" /> Generate Detailed Prompt</>)}
      </Button>

      {result && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Production-ready prompt</span>
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result}</div>
        </div>
      )}
    </div>
  );
}
