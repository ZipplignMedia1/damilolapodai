import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy, Check, Wand2, BookOpen, Mic, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { runDirector } from "@/lib/ai.functions";
import { useLoadingTask } from "@/components/LoadingBar";

type Tab = "prompt" | "story" | "voice" | "analyze";

const FORMATS = [
  { id: "movie", label: "Cinematic Movie" },
  { id: "drama", label: "Nollywood Drama" },
  { id: "skit", label: "Comedy Skit (IG/TikTok)" },
  { id: "playlet", label: "Playlet (stage-style)" },
  { id: "music_video", label: "Music Video" },
  { id: "commercial", label: "Commercial / Ad" },
  { id: "image", label: "Single Image" },
  { id: "video", label: "Generic Video Clip" },
] as const;

export const Route = createFileRoute("/director")({
  head: () => ({
    meta: [
      { title: "Director — DAMILOLAPOD AI" },
      { name: "description", content: "Prompts, stories, voice direction, and prompt analysis." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: DirectorPage,
});

function DirectorPage() {
  const [tab, setTab] = useState<Tab>("prompt");

  const tabs: { id: Tab; label: string; Icon: typeof Wand2 }[] = [
    { id: "prompt", label: "Prompt", Icon: Wand2 },
    { id: "story", label: "Story", Icon: BookOpen },
    { id: "voice", label: "Voice", Icon: Mic },
    { id: "analyze", label: "Analyze", Icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-2">
        <div className="grid grid-cols-4 gap-1">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "prompt" && <PromptTab />}
      {tab === "story" && <StoryTab />}
      {tab === "voice" && <VoiceTab />}
      {tab === "analyze" && <AnalyzeTab />}
    </div>
  );
}

function useDirector() {
  const qc = useQueryClient();
  const runFn = useServerFn(runDirector);
  const withLoading = useLoadingTask();

  return async function run(
    cost: number,
    reason: string,
    body: {
      mode: "expand" | "story" | "voice" | "analyze";
      description?: string;
      format?: string;
      tone?: string;
      duration?: number;
      idea?: string;
      genre?: string;
      length?: "short" | "medium" | "long";
      character?: string;
      gender?: "male" | "female" | "neutral";
      language?: string;
      prompt?: string;
      target?: string;
    },
  ): Promise<{ text: string | null; json: unknown | null; creditsRemaining: number }> {
    const data = await withLoading(() =>
      runFn({ data: { ...body, cost, reason } }),
    );
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    return {
      text: data.resultText,
      json: data.resultJsonString ? JSON.parse(data.resultJsonString) : null,
      creditsRemaining: data.creditsRemaining,
    };
  };
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

/* ---------------- PROMPT ---------------- */
function PromptTab() {
  const [desc, setDesc] = useState("");
  const [format, setFormat] = useState<string>("drama");
  const [tone, setTone] = useState("");
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const director = useDirector();

  const isImage = format === "image";
  const cost = isImage ? 1 : duration; // image prompt = 1 DPOD, video prompt = duration DPOD

  async function run() {
    if (!desc.trim()) return toast.error("Describe your shot first");
    setLoading(true); setResult(null);
    const toastId = toast.loading(`Directing · ${cost} DPOD on success…`);
    try {
      const out = await director(cost, `director:prompt:${format}`, { mode: "expand", description: desc, format, tone, duration });
      setResult(out.text ?? (out.json ? JSON.stringify(out.json) : ""));
      toast.success(`Done! ${out.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg.includes("INSUFFICIENT_CREDITS") ? "Not enough DPOD" : `${msg} (no DPOD charged)`, { id: toastId });
    }
    finally { setLoading(false); }
  }

  return (
    <>
      <SectionCard title="Prompt Director" subtitle="Rough idea in → cinema-grade prompt out.">
        <div>
          <label className="text-sm font-semibold">Your shot or scene</label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. A mother confronts her son in the kitchen about missing school fees." className="mt-2 min-h-[120px] rounded-xl" />
        </div>
        <div>
          <label className="text-sm font-semibold">Format</label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{FORMATS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-semibold">Tone (optional)</label>
          <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="tense, hopeful, comedic, gritty" className="mt-2 h-11 rounded-xl" />
        </div>
        {!isImage && (
          <div>
            <label className="text-sm font-semibold">Duration</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 15, 20, 30].map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${duration === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>{d}s</button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <Button onClick={run} disabled={loading} className="w-full h-12 rounded-xl text-base font-bold">
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Directing…</> : <><Sparkles className="h-5 w-5" /> Generate Prompt · {cost} DPOD</>}
      </Button>

      {result && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Production-ready prompt</span>
            <CopyBtn text={result} />
          </div>
          <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result}</div>
        </div>
      )}
    </>
  );
}

/* ---------------- STORY ---------------- */
function StoryTab() {
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("drama");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("short");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const director = useDirector();

  const cost = length === "short" ? 2 : length === "medium" ? 4 : 6;

  async function run() {
    if (!idea.trim()) return toast.error("Give me a small idea to grow");
    setLoading(true); setResult(null);
    const toastId = toast.loading(`Writing story · ${cost} DPOD on success…`);
    try {
      const out = await director(cost, `director:story:${length}`, { mode: "story", idea, genre, tone, length });
      setResult(out.text ?? "");
      toast.success(`Done! ${out.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg.includes("INSUFFICIENT_CREDITS") ? "Not enough DPOD" : `${msg} (no DPOD charged)`, { id: toastId });
    }
    finally { setLoading(false); }
  }

  return (
    <>
      <SectionCard title="Story Generator" subtitle="Small idea → full story treatment.">
        <div>
          <label className="text-sm font-semibold">Your idea</label>
          <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. A Lagos taxi driver finds a bag of money on the back seat." className="mt-2 min-h-[120px] rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold">Genre</label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["drama","comedy","romance","thriller","horror","crime","family","action","slice of life"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-semibold">Length</label>
            <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
              <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (~200w)</SelectItem>
                <SelectItem value="medium">Medium (~450w)</SelectItem>
                <SelectItem value="long">Long (~800w)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold">Tone (optional)</label>
          <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="bittersweet, gritty, hopeful" className="mt-2 h-11 rounded-xl" />
        </div>
      </SectionCard>

      <Button onClick={run} disabled={loading} className="w-full h-12 rounded-xl text-base font-bold">
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Writing…</> : <><BookOpen className="h-5 w-5" /> Generate Story · {cost} DPOD</>}
      </Button>

      {result && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Story</span>
            <CopyBtn text={result} />
          </div>
          <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result}</div>
        </div>
      )}
    </>
  );
}

/* ---------------- VOICE ---------------- */
type VoiceResult = {
  voice_match?: string;
  gender?: string;
  language?: string;
  pitch?: number;
  warmth?: number;
  naturalness?: number;
  depth?: number;
  pacing?: number;
  emotion?: number;
  delivery_notes?: string;
  sample_line?: string;
  raw?: string;
};

function VoiceTab() {
  const [character, setCharacter] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "neutral">("male");
  const [language, setLanguage] = useState("Nigerian English");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const director = useDirector();
  const cost = 1;

  async function run() {
    if (!character.trim()) return toast.error("Describe the character or voice you want");
    setLoading(true); setResult(null);
    const toastId = toast.loading(`Tuning voice · ${cost} DPOD on success…`);
    try {
      const out = await director(cost, "director:voice", { mode: "voice", character, gender, language });
      setResult((out.json as VoiceResult) ?? null);
      toast.success(`Done! ${out.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg.includes("INSUFFICIENT_CREDITS") ? "Not enough DPOD" : `${msg} (no DPOD charged)`, { id: toastId });
    }
    finally { setLoading(false); }
  }

  function copyAll() {
    if (!result) return "";
    const r = result;
    return [
      `Pitch: ${r.pitch! >= 0 ? "+" : ""}${r.pitch}`,
      `Warmth: ${r.warmth}%`,
      `Naturalness: ${r.naturalness}%`,
      `Depth: ${r.depth}%`,
      `Pacing: ${r.pacing}x`,
      `Emotion: ${r.emotion}%`,
      `Voice Match: ${r.voice_match}`,
      `(${(r.gender || "").charAt(0).toUpperCase() + (r.gender || "").slice(1)}) ${r.language}`,
      "",
      r.delivery_notes,
      "",
      `Sample: "${r.sample_line}"`,
    ].join("\n");
  }

  return (
    <>
      <SectionCard title="Voice Prompt Generator" subtitle="Describe the character → cinematic voice spec.">
        <div>
          <label className="text-sm font-semibold">Character / voice description</label>
          <Textarea value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="e.g. A tired Lagos detective in his 40s, low gravelly voice, world-weary but warm with kids." className="mt-2 min-h-[110px] rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold">Gender</label>
            <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
              <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-semibold">Language / accent</label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-2 h-11 rounded-xl" />
          </div>
        </div>
      </SectionCard>

      <Button onClick={run} disabled={loading} className="w-full h-12 rounded-xl text-base font-bold">
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Tuning…</> : <><Mic className="h-5 w-5" /> Generate Voice · {cost} DPOD</>}
      </Button>

      {result && !result.raw && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Voice spec</span>
            <CopyBtn text={copyAll()} />
          </div>
          <div className="space-y-3 p-4 text-sm">
            <VoiceRow label="Pitch" value={`${(result.pitch ?? 0) >= 0 ? "+" : ""}${result.pitch}`} pct={((result.pitch ?? 0) + 10) * 5} />
            <VoiceRow label="Warmth" value={`${result.warmth}%`} pct={result.warmth ?? 0} />
            <VoiceRow label="Naturalness" value={`${result.naturalness}%`} pct={result.naturalness ?? 0} />
            <VoiceRow label="Depth" value={`${result.depth}%`} pct={result.depth ?? 0} />
            <VoiceRow label="Pacing" value={`${result.pacing}x`} pct={Math.round((((result.pacing ?? 1) - 0.6) / 1.0) * 100)} />
            <VoiceRow label="Emotion" value={`${result.emotion}%`} pct={result.emotion ?? 0} />
            <div className="pt-2 border-t border-border space-y-1">
              <div className="text-xs text-muted-foreground">Voice Match</div>
              <div className="text-sm font-semibold">{result.voice_match}</div>
              <div className="text-xs text-muted-foreground">({(result.gender || "").replace(/^./, (c) => c.toUpperCase())}) {result.language}</div>
            </div>
            {result.delivery_notes && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">Delivery notes</div>
                <p className="text-sm leading-relaxed">{result.delivery_notes}</p>
              </div>
            )}
            {result.sample_line && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">Sample line</div>
                <p className="text-sm italic">"{result.sample_line}"</p>
              </div>
            )}
          </div>
        </div>
      )}
      {result?.raw && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm whitespace-pre-wrap">{result.raw}</div>
      )}
    </>
  );
}

function VoiceRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

/* ---------------- ANALYZE ---------------- */
type AnalyzeResult = {
  score?: number;
  verdict?: string;
  fit_for_model?: boolean;
  strengths?: string[];
  weaknesses?: string[];
  missing?: string[];
  rewrite?: string;
  raw?: string;
};

function AnalyzeTab() {
  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState("image");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const director = useDirector();
  const cost = 1;

  async function run() {
    if (!prompt.trim()) return toast.error("Paste a prompt to analyze");
    setLoading(true); setResult(null);
    const toastId = toast.loading(`Analyzing · ${cost} DPOD on success…`);
    try {
      const out = await director(cost, "director:analyze", { mode: "analyze", prompt, target });
      setResult((out.json as AnalyzeResult) ?? null);
      toast.success(`Done! ${out.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg.includes("INSUFFICIENT_CREDITS") ? "Not enough DPOD" : `${msg} (no DPOD charged)`, { id: toastId });
    }
    finally { setLoading(false); }
  }

  const score = result?.score ?? 0;
  const verdictColor =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-primary" : score >= 40 ? "text-yellow-500" : "text-destructive";

  return (
    <>
      <SectionCard title="Prompt Analyzer" subtitle="Check if your prompt is good for the model.">
        <div>
          <label className="text-sm font-semibold">Your prompt</label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Paste the prompt you plan to send to the model…" className="mt-2 min-h-[140px] rounded-xl" />
        </div>
        <div>
          <label className="text-sm font-semibold">Target model</label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Image model</SelectItem>
              <SelectItem value="video">Video model</SelectItem>
              <SelectItem value="story">Story / text model</SelectItem>
              <SelectItem value="voice">Voice / TTS model</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <Button onClick={run} disabled={loading} className="w-full h-12 rounded-xl text-base font-bold">
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing…</> : <><ShieldCheck className="h-5 w-5" /> Analyze · {cost} DPOD</>}
      </Button>

      {result && !result.raw && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Score</div>
                <div className={`text-3xl font-extrabold ${verdictColor}`}>{score}<span className="text-base text-muted-foreground">/100</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Verdict</div>
                <div className={`text-base font-bold capitalize ${verdictColor}`}>{result.verdict}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{result.fit_for_model ? "Fit for model" : "Not ideal for this model"}</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
            </div>
          </div>

          {result.strengths && result.strengths.length > 0 && (
            <ListCard title="Strengths" items={result.strengths} dotClass="bg-green-500" />
          )}
          {result.weaknesses && result.weaknesses.length > 0 && (
            <ListCard title="Weaknesses" items={result.weaknesses} dotClass="bg-destructive" />
          )}
          {result.missing && result.missing.length > 0 && (
            <ListCard title="Add these" items={result.missing} dotClass="bg-yellow-500" />
          )}
          {result.rewrite && (
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-xs font-semibold text-muted-foreground">Improved rewrite</span>
                <CopyBtn text={result.rewrite} />
              </div>
              <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result.rewrite}</div>
            </div>
          )}
        </div>
      )}
      {result?.raw && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm whitespace-pre-wrap">{result.raw}</div>
      )}
    </>
  );
}

function ListCard({ title, items, dotClass }: { title: string; items: string[]; dotClass: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold text-muted-foreground mb-2">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
