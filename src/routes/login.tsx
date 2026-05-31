import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — DAMILOLAPOD AI" },
      { name: "description", content: "Sign in to your DAMILOLAPOD AI account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // If already signed in, bounce away
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password required");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-5 pt-4">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get <span className="font-semibold text-foreground">10 free credits</span> on signup.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogle}
        disabled={busy}
        className="w-full h-12 rounded-xl"
      >
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or</span></div>
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        <div>
          <Label htmlFor="email" className="text-xs">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="password" className="text-xs">Password</Label>
          <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 rounded-xl" />
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl text-sm font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
        <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-semibold text-primary underline-offset-2 hover:underline">
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </p>

      <p className="text-center"><Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back home</Link></p>
    </div>
  );
}
