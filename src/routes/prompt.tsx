import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy, Check, Code2, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { spendCredits, refundCredits } from "@/lib/credits.functions";

const TARGETS = [
  { id: "universal", label: "Universal (any model)" },
  { id: "veo3", label: "Google Veo 3" },
  { id: "veo2", label: "Google Veo 2" },
  { id: "seedance", label: "ByteDance Seedance" },
  { id: "kling", label: "Kling AI" },
  { id: "runway", label: "Runway Gen-3/4" },
  { id: "pika", label: "Pika 2" },
  { id: "luma", label: "Luma Dream Machine" },
  { id: "hailuo", label: "MiniMax Hailuo 02" },
  { id: "sora", label: "OpenAI Sora" },
  { id: "wan", label: "Alibaba Wan 2" },
] as const;
type TargetId = typeof TARGETS[number]["id"];




export const Route = createFileRoute("/prompt")({
  head: () => ({
    meta: [
      { title: "JSON Prompt Generator — DAMILOLAPOD AI" },
      { name: "description", content: "Turn any video idea into a structured shot-by-shot JSON prompt." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: PromptPage,
});

function PromptPage() {
  const [idea, setIdea] = useState("");
  const [duration, setDuration] = useState(10);
  const [target, setTarget] = useState<TargetId>("universal");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const qc = useQueryClient();
  const runSpend = useServerFn(spendCredits);
  const runRefund = useServerFn(refundCredits);

  const cost = duration; // 1 DPOD per second of generated plan

  async function generate() {
    if (!idea.trim()) return toast.error("Describe your video idea");
    setLoading(true);
    setResult(null);
    setOutOfCredits(false);
    const toastId = toast.loading(`Spending ${cost} DPOD · generating JSON…`);

    // 1. Spend credits first
    let spent = false;
    try {
      const spend = await runSpend({ data: { amount: cost, reason: `json_prompt:${duration}s` } });
      spent = true;
      // 2. Call generation
      const res = await fetch("/api/video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, duration, target }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(`JSON ready! ${spend.creditsRemaining} DPOD left.`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        setOutOfCredits(true);
        toast.error("Not enough DPOD", { id: toastId });
      } else {
        // Refund the spend if generation failed
        if (spent) {
          try {
            await runRefund({ data: { amount: cost, reason: `refund:json_prompt` } });
            qc.invalidateQueries({ queryKey: ["my-profile"] });
          } catch {}
        }
        toast.error(msg, { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied JSON");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">JSON Prompt Generator</h2>
            <p className="mt-1 text-xs text-muted-foreground">Describe any video — get a shot-by-shot JSON plan.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            <Code2 className="h-3.5 w-3.5" /> JSON
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Your idea</label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. A couple argues, then Pepsi instantly changes the mood. Modern living room, bright and refreshing."
            className="mt-2 min-h-[120px] rounded-xl"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">Target AI video model</label>
          <Select value={target} onValueChange={(v) => setTarget(v as TargetId)}>
            <SelectTrigger className="mt-2 h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGETS.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-[11px] text-muted-foreground">JSON will be tailored to the selected model's prompt format.</p>
        </div>

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
      </div>

      <Button onClick={generate} disabled={loading} className="w-full h-12 rounded-xl text-base font-bold">
        {loading ? (<><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>) : (<><Sparkles className="h-5 w-5" /> Generate JSON Prompt</>)}
      </Button>

      {result && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Generated JSON</span>
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-[60vh] overflow-auto p-4 text-[11px] leading-relaxed font-mono text-foreground/90">{result}</pre>
        </div>
      )}
    </div>
  );
}
