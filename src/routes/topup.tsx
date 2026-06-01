import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Check, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/credits.functions";
import { initializePaystackPayment, getMySubscription } from "@/lib/paystack.functions";
import { TOPUP_PACKS, SUBSCRIPTION_PLAN, formatNaira } from "@/lib/paystack.config";

export const Route = createFileRoute("/topup")({
  head: () => ({
    meta: [
      { title: "Buy DPOD credits — DAMILOLAPOD AI" },
      { name: "description", content: "Top up your DPOD credits or subscribe monthly. Pay with Nigerian cards, bank transfer, or USSD via Paystack." },
    ],
  }),
  component: TopupPage,
});

function TopupPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useServerFn(getMyProfile);
  const fetchSub = useServerFn(getMySubscription);
  const initPayment = useServerFn(initializePaystackPayment);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    return () => subscription.unsubscribe();
  }, []);

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
        <h1 className="text-2xl font-bold">Buy DPOD</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to buy credits.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
          Sign in
        </Link>
      </div>
    );
  }

  async function start(kind: "topup" | "subscription", packId?: string) {
    setError(null);
    setBusyId(packId || kind);
    try {
      const { authorization_url } = await initPayment({
        data: { kind, packId, callbackOrigin: window.location.origin },
      });
      window.location.href = authorization_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment");
      setBusyId(null);
    }
  }

  const credits = profile?.credits ?? 0;
  const subActive = sub?.status === "active";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => navigate({ to: "/profile" })}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">Buy DPOD</h1>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold">
          <Coins className="h-3.5 w-3.5 text-primary" />
          <span>{credits}</span>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Each generation costs 2 DPOD. Pay in Naira via card, bank or USSD.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Subscription card */}
      <div className="mt-6 rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              <Sparkles className="h-3 w-3" /> Best value
            </div>
            <h2 className="mt-2 font-display text-xl font-extrabold">{SUBSCRIPTION_PLAN.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{SUBSCRIPTION_PLAN.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold">{formatNaira(SUBSCRIPTION_PLAN.amountKobo)}</div>
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">/ month</div>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 text-sm">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 2,000 DPOD instantly</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> ~1,000 generations / month</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Renew anytime, cancel anytime</li>
        </ul>

        {subActive ? (
          <div className="mt-4 rounded-full bg-card px-4 py-2 text-center text-xs font-semibold">
            Active{sub?.current_period_end ? ` until ${new Date(sub.current_period_end).toLocaleDateString()}` : ""}
          </div>
        ) : (
          <button
            disabled={busyId === "subscription"}
            onClick={() => start("subscription")}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-60"
          >
            {busyId === "subscription" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Subscribe — {formatNaira(SUBSCRIPTION_PLAN.amountKobo)}/mo
          </button>
        )}
      </div>

      {/* One-time packs */}
      <h2 className="mt-8 font-display text-lg font-extrabold">One-time top-ups</h2>
      <p className="text-xs text-muted-foreground">No subscription. Credits never expire.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {TOPUP_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`relative rounded-2xl border bg-card p-4 ${pack.highlight ? "border-primary" : "border-border"}`}
          >
            {pack.highlight && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                Popular
              </div>
            )}
            <div className="text-xs font-semibold text-muted-foreground">{pack.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold">{pack.credits.toLocaleString()}</span>
              <span className="text-xs font-semibold text-muted-foreground">DPOD</span>
            </div>
            <div className="mt-1 text-sm font-bold">{formatNaira(pack.amountKobo)}</div>
            <button
              disabled={busyId === pack.id}
              onClick={() => start("topup", pack.id)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-60"
            >
              {busyId === pack.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Buy
            </button>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[10px] text-muted-foreground">
        Payments are processed securely by Paystack.
      </p>
    </div>
  );
}
