import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, ImageIcon, Video, Layers, Library, ArrowRight, Wand2 } from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — DAMILOLAPOD AI" },
      { name: "description", content: "Your creative studio dashboard." },
    ],
  }),
  component: HomePage,
});

const tiles = [
  { to: "/director", label: "Director", desc: "Prompt engineer for scenes", Icon: Wand2 },
  { to: "/prompt", label: "JSON", desc: "Prompt generator", Icon: Code2 },
  { to: "/image", label: "Image", desc: "Generate from prompt", Icon: ImageIcon },
  { to: "/video", label: "Video", desc: "Bring it to life", Icon: Video },
  { to: "/storyboard", label: "Storyboard", desc: "Plan your scenes", Icon: Layers },
  { to: "/history", label: "Library", desc: "Your saved work", Icon: Library },
] as const;

function HomePage() {
  return (
    <div className="space-y-6 py-2">
      <section className="rounded-3xl border border-border bg-card p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Welcome</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">What will you create?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a tool to get started.</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ to, label, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm font-bold">
                {label} <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-muted-foreground">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
