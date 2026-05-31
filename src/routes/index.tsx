import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import avatar from "@/assets/welcome-avatar.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DAMILOLAPO AI — Create with AI" },
      { name: "description", content: "Generate images, videos, and cinematic storyboards from your ideas." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Avatar circle */}
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-full bg-[conic-gradient(from_0deg,var(--primary),transparent_60%,var(--primary))] opacity-70 blur-md" />
        <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-primary/40 bg-card shadow-[var(--shadow-glow)]">
          <img
            src={avatar}
            alt="DAMILOLAPO AI"
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>

      {/* Title */}
      <h1 className="relative mt-8 font-display text-4xl font-extrabold tracking-tight">
        DAMILOLAPO <span className="text-primary">AI</span>
      </h1>
      <p className="relative mt-3 max-w-xs text-sm text-muted-foreground">
        Your creative companion for images, videos, and cinematic storyboards.
      </p>

      {/* CTA */}
      <Link
        to="/image"
        className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:opacity-95 active:scale-95"
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Link>

      <p className="relative mt-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Powered by AI
      </p>
    </div>
  );
}
