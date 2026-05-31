import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import avatar from "@/assets/welcome-avatar.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DAMILOLAPOD AI — Create with AI" },
      { name: "description", content: "Generate images, videos, and cinematic storyboards from your ideas." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      {/* Avatar circle */}
      <div className="relative">
        <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-primary bg-card">
          <img
            src={avatar}
            alt="DAMILOLAPOD AI"
            className="h-full w-full object-cover object-center"
          />
        </div>
      </div>

      {/* Title */}
      <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight">
        DAMILOLAPOD <span className="text-primary">AI</span>
      </h1>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        Your creative companion for images, videos, and cinematic storyboards.
      </p>

      {/* CTA */}
      <Link
        to="/login"
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 active:scale-95"
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Link>

      <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Powered by AI
      </p>
    </div>
  );
}
