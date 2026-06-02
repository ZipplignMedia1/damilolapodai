import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Video, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Video Generation — Coming Soon — DAMILOLAPOD AI" },
      { name: "description", content: "Video generation is coming soon." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: VideoComingSoon,
});

function VideoComingSoon() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Video className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Video Generation</h2>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Clock className="h-3 w-3" /> Coming soon
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          We're switching to a better video engine. In the meantime, use{" "}
          <span className="font-semibold text-foreground">JSON Prompt</span> or{" "}
          <span className="font-semibold text-foreground">Director</span> to plan your
          scenes — you can paste those prompts straight into Veo, Sora, Runway, Kling
          and more.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            to="/prompt"
            className="rounded-xl border border-border bg-background px-3 py-3 text-xs font-semibold hover:border-primary"
          >
            JSON Prompt
          </Link>
          <Link
            to="/director"
            className="rounded-xl border border-border bg-background px-3 py-3 text-xs font-semibold hover:border-primary"
          >
            Director
          </Link>
        </div>

        <Link
          to="/home"
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
      </div>
    </div>
  );
}
