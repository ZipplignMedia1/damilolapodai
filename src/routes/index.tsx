import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, Video, Layers, Clock, Sparkles, Wand2, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DAMILOLAPOD AI — Create with AI" },
      { name: "description", content: "Generate images, videos, and cinematic storyboards from your ideas." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-[var(--gradient-surface)] p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          <Sparkles className="h-3 w-3" /> New · Nano Banana Pro
        </div>
        <h2 className="mt-3 font-display text-[26px] font-extrabold leading-[1.1] tracking-tight">
          Create anything.<br />
          <span className="text-primary">Instantly.</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Images, videos and cinematic storyboards — powered by AI.
        </p>
        <Link
          to="/image"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95"
        >
          <Wand2 className="h-4 w-4" /> Start creating
        </Link>
      </section>

      {/* Bento grid */}
      <section className="grid grid-cols-6 gap-3">
        <BentoCard
          to="/image"
          span="col-span-6"
          tone="bg-gradient-to-br from-primary/25 via-primary/10 to-transparent"
          Icon={ImageIcon}
          eyebrow="Featured"
          title="Generate Image"
          desc="Photoreal, cinematic, anime — text to image or transform uploads."
          tall
        />
        <BentoCard
          to="/video"
          span="col-span-3"
          tone="bg-gradient-to-br from-rose-500/20 to-transparent"
          Icon={Video}
          title="Video"
          desc="Animate ideas in seconds"
        />
        <BentoCard
          to="/storyboard"
          span="col-span-3"
          tone="bg-gradient-to-br from-orange-500/20 to-transparent"
          Icon={Layers}
          title="Storyboard"
          desc="9 cinematic scenes"
        />
        <BentoCard
          to="/history"
          span="col-span-6"
          tone="bg-gradient-to-br from-secondary to-card"
          Icon={Clock}
          title="Your library"
          desc="Everything you've generated, saved automatically."
        />
      </section>
    </div>
  );
}

function BentoCard({
  to, span, tone, Icon, title, desc, eyebrow, tall,
}: {
  to: string; span: string; tone: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; eyebrow?: string; tall?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl border border-border ${tone} ${span} ${tall ? "p-5 min-h-[160px]" : "p-4 min-h-[130px]"} transition hover:border-primary/40`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/70 backdrop-blur">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className={tall ? "mt-8" : "mt-6"}>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">{eyebrow}</p>
        )}
        <h3 className={`font-display font-extrabold tracking-tight ${tall ? "text-xl" : "text-base"}`}>{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}
