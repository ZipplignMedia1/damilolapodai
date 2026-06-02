import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, ImageIcon, Video, Layers, Library, ArrowRight, Wand2, Clock } from "lucide-react";

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
  { to: "/director", label: "Director", desc: "Prompt engineer for scenes", Icon: Wand2, soon: false },
  { to: "/prompt", label: "JSON", desc: "Prompt generator", Icon: Code2, soon: false },
  { to: "/image", label: "Image", desc: "Generate from prompt", Icon: ImageIcon, soon: false },
  { to: "/video", label: "Video", desc: "Coming soon", Icon: Video, soon: true },
  { to: "/storyboard", label: "Storyboard", desc: "Plan your scenes", Icon: Layers, soon: false },
  { to: "/history", label: "Library", desc: "Your saved work", Icon: Library, soon: false },
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
        {tiles.map(({ to, label, desc, Icon, soon }) => (
          <Link
            key={to}
            to={to}
            className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary"
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
            {soon && (
              <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                <Clock className="h-2.5 w-2.5" /> Soon
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
