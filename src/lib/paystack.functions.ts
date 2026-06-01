import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TOPUP_PACKS, SUBSCRIPTION_PLAN } from "./paystack.config";

function getOrigin() {
  // Used to build the Paystack callback_url after payment.
  return process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "";
}

export const initializePaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "topup" | "subscription"; packId?: string; callbackOrigin?: string }) =>
    z
      .object({
        kind: z.enum(["topup", "subscription"]),
        packId: z.string().optional(),
        callbackOrigin: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string })?.email;
    if (!email) throw new Error("Account email is missing — please sign in again.");

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured yet.");

    let amountKobo: number;
    let credits: number;
    let label: string;
    if (data.kind === "subscription") {
      amountKobo = SUBSCRIPTION_PLAN.amountKobo;
      credits = SUBSCRIPTION_PLAN.credits;
      label = SUBSCRIPTION_PLAN.label;
    } else {
      const pack = TOPUP_PACKS.find((p) => p.id === data.packId);
      if (!pack) throw new Error("Invalid top-up package");
      amountKobo = pack.amountKobo;
      credits = pack.credits;
      label = pack.label;
    }

    const reference = `dpod_${data.kind}_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const origin = data.callbackOrigin || getOrigin();
    const callback_url = origin ? `${origin.replace(/\/$/, "")}/profile?paystack_ref=${reference}` : undefined;

    const body: Record<string, unknown> = {
      email,
      amount: amountKobo,
      currency: "NGN",
      reference,
      callback_url,
      metadata: {
        user_id: userId,
        kind: data.kind,
        credits,
        label,
      },
    };

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Paystack initialize failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    };

    if (!json.status || !json.data?.authorization_url) {
      throw new Error(json.message || "Paystack did not return a checkout URL.");
    }

    // Record the pending transaction (admin client, RLS-bypass).
    await supabaseAdmin.from("payment_transactions").insert({
      user_id: userId,
      reference,
      amount_kobo: amountKobo,
      credits,
      kind: data.kind,
      status: "pending",
      metadata: { label },
    });

    return {
      authorization_url: json.data.authorization_url,
      reference,
    };
  });

// Manual verification — called from the callback page (profile?paystack_ref=...) so
// credits show up immediately even before the webhook fires.
export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reference: string }) =>
    z.object({ reference: z.string().min(8).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured yet.");

    // Make sure this reference belongs to this user.
    const { data: tx } = await supabaseAdmin
      .from("payment_transactions")
      .select("user_id, credits, kind, status")
      .eq("reference", data.reference)
      .maybeSingle();

    if (!tx) return { status: "unknown" as const };
    if (tx.user_id !== userId) throw new Error("Not your transaction.");
    if (tx.status === "success") return { status: "success" as const };

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) return { status: "pending" as const };
    const json = (await res.json()) as {
      status?: boolean;
      data?: { status?: string; customer?: { customer_code?: string } };
    };
    const paystackStatus = json.data?.status;
    if (paystackStatus !== "success") {
      if (paystackStatus === "failed") {
        await supabaseAdmin
          .from("payment_transactions")
          .update({ status: "failed" })
          .eq("reference", data.reference);
        return { status: "failed" as const };
      }
      return { status: "pending" as const };
    }

    await supabaseAdmin.rpc("credit_for_payment", {
      _reference: data.reference,
      _user_id: userId,
      _credits: tx.credits,
      _kind: tx.kind,
    });

    if (tx.kind === "subscription") {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          status: "active",
          paystack_customer_code: json.data?.customer?.customer_code ?? null,
          current_period_end: periodEnd.toISOString(),
        },
        { onConflict: "user_id" },
      );
    }

    return { status: "success" as const };
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? { status: "inactive", current_period_end: null };
  });

export const getMyPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("reference, amount_kobo, credits, kind, status, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
