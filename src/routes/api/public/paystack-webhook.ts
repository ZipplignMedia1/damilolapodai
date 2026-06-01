import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Paystack signs every webhook with HMAC-SHA512 of the raw body using the secret key.
function verifySignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha512", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const sig = request.headers.get("x-paystack-signature");
        if (!verifySignature(raw, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          event?: string;
          data?: {
            reference?: string;
            status?: string;
            customer?: { customer_code?: string };
            metadata?: { user_id?: string; kind?: string; credits?: number };
          };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        if (payload.event === "charge.success" && payload.data?.reference) {
          const reference = payload.data.reference;

          // Look up the transaction we recorded at initialize time.
          const { data: tx } = await supabaseAdmin
            .from("payment_transactions")
            .select("user_id, credits, kind, status")
            .eq("reference", reference)
            .maybeSingle();

          if (!tx) {
            // Stranger payment — acknowledge so Paystack stops retrying.
            return new Response("ok", { status: 200 });
          }
          if (tx.status === "success") {
            return new Response("ok", { status: 200 });
          }

          await supabaseAdmin.rpc("credit_for_payment", {
            _reference: reference,
            _user_id: tx.user_id,
            _credits: tx.credits,
            _kind: tx.kind,
          });

          if (tx.kind === "subscription") {
            const periodEnd = new Date();
            periodEnd.setDate(periodEnd.getDate() + 30);
            await supabaseAdmin.from("subscriptions").upsert(
              {
                user_id: tx.user_id,
                status: "active",
                paystack_customer_code: payload.data.customer?.customer_code ?? null,
                current_period_end: periodEnd.toISOString(),
              },
              { onConflict: "user_id" },
            );
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
