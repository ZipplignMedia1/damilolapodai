import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, LogOut, User as UserIcon, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/credits.functions";
import { getMySubscription, verifyPaystackPayment } from "@/lib/paystack.functions";

const searchSchema = z.object({
  paystack_ref: z.string().optional(),
});

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — DAMILOLAPOD AI" },
      { name: "description", content: "Your account, credits and settings." },
    ],
  }),
  validateSearch: searchSchema,
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/profile" });
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "success" | "failed" | "pending">("idle");

  const fetchProfile = useServerFn(getMyProfile);
  const fetchSub = useServerFn(getMySubscription);
  const verify = useServerFn(verifyPaystackPayment);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setEmail(data.session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Verify Paystack payment when user returns from checkout.
  useEffect(() => {
    if (authed !== true || !search.paystack_ref) return;
    const ref = search.paystack_ref;
    setVerifyState("verifying");
    verify({ data: { reference: ref } })
      .then((r) => {
        setVerifyState(r.status === "success" ? "success" : r.status === "failed" ? "failed" : "pending");
        qc.invalidateQueries({ queryKey: ["my-profile"] });
        qc.invalidateQueries({ queryKey: ["my-subscription"] });
        // Strip the ref from the URL after handling.
        navigate({ to: "/profile", replace: true, search: {} });
      })
      .catch(() => setVerifyState("failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, search.paystack_ref]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: authed === true,
  });
  const { data: sub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
    enabled: authed === true,
  });

  if (authed === false) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to view your account.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
          Sign in
        </Link>
      </div>
    );
  }

  const initial = (profile?.display_name || email || "U").charAt(0).toUpperCase();
  const credits = profile?.credits ?? 0;
  const lowBalance = credits < 4;
  const subActive = sub?.status === "active";

  return (
    <div className="mx-auto max-w-md py-6">
      {verifyState !== "idle" && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-xs font-semibold ${
            verifyState === "success"
              ? "border-primary/40 bg-primary/10 text-primary"
              : verifyState === "failed"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-card text-muted-foreground"
          }`}
        >
          {verifyState === "verifying" && (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying payment…</span>
          )}
          {verifyState === "success" && (
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Payment received — your DPOD has been added.</span>
          )}
          {verifyState === "pending" && "Payment is still being confirmed. Your DPOD will appear shortly."}
          {verifyState === "failed" && "We couldn't confirm your payment. If you were charged, contact support."}
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-card text-2xl font-extrabold">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <h1 className="mt-4 font-display text-xl font-extrabold">
          {profile?.display_name || "Your account"}
        </h1>
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-primary" /> DPOD credits
          </div>
          <span className="text-lg font-extrabold">{credits}</span>
        </div>
        {lowBalance && (
          <p className="mt-2 text-xs text-destructive">
            Low balance — top up to keep generating.
          </p>
        )}
        <Link
          to="/topup"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Sparkles className="h-4 w-4" /> Buy DPOD
        </Link>
        {subActive && (
          <p className="mt-2 text-center text-[10px] font-semibold text-primary">
            Monthly plan active{sub?.current_period_end ? ` · renews ${new Date(sub.current_period_end).toLocaleDateString()}` : ""}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="h-4 w-4 text-primary" /> Account
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-accent"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
