import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, Video, Layers, Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DAMILOLAPOD AI — Create with AI" },
      { name: "description", content: "Generate images, videos, and cinematic storyboards from your ideas with DAMILOLAPOD AI." },
    ],
  }),
  component: HomePage,
});

const TOOLS = [
  {
    to: "/image",
    title: "Generate Image",
    desc: "Text → image or transform uploads",
    Icon: ImageIcon,
    gradient: "from-rose-500/15 to-orange-500/15",
  },
  {
    to: "/video",
    title: "Generate Video",
    desc: "Text → video or animate an image",
    Icon: Video,
    gradient: "from-violet-500/15 to-indigo-500/15",
  },
  {
    to: "/storyboard",
    title: "Storyboard Creator",
    desc: "Story → 9 cinematic scenes",
    Icon: Layers,
    gradient: "from-emerald-500/15 to-cyan-500/15",
  },
  {
    to: "/history",
    title: "Saved Projects",
    desc: "Your generated library",
    Icon: Clock,
    gradient: "from-amber-500/15 to-pink-500/15",
  },
] as const;

function HomePage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-5 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Welcome to your AI studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a tool to get creating.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS.map(({ to, title, desc, Icon, gradient }) => (
          <Link
            key={to}
            to={to}
            className={`group rounded-2xl border border-border bg-gradient-to-br ${gradient} p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-base font-bold">{title}</h2>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
