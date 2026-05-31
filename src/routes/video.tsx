import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Video } from "lucide-react";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Video Generation — Coming Soon" },
      { name: "description", content: "AI video generation is coming soon to DAMILOLAPOD AI." },
    ],
  }),
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full rounded-3xl border border-border bg-[var(--gradient-surface)] p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card/70 backdrop-blur">
          <Video className="h-6 w-6 text-primary" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          <Sparkles className="h-3 w-3" /> Coming Soon
        </div>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Video Generation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We're cooking something cinematic. Check back soon.
        </p>
      </div>
    </div>
  );
}
