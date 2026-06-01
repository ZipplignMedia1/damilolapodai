
-- Track every Paystack payment attempt (one-time top-ups and subscription charges)
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  amount_kobo INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('topup','subscription')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON public.payment_transactions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_payment_tx_user ON public.payment_transactions(user_id, created_at DESC);

-- Track active monthly subscriptions
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','cancelled')),
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  email_token TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-side helper: credit DPOD after a verified Paystack payment.
-- Idempotent: if the reference is already marked success, does nothing.
CREATE OR REPLACE FUNCTION public.credit_for_payment(
  _reference TEXT,
  _user_id UUID,
  _credits INTEGER,
  _kind TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance INTEGER;
  _tx_status TEXT;
BEGIN
  SELECT status INTO _tx_status FROM public.payment_transactions WHERE reference = _reference FOR UPDATE;
  IF _tx_status = 'success' THEN
    SELECT credits INTO _new_balance FROM public.profiles WHERE user_id = _user_id;
    RETURN _new_balance;
  END IF;

  UPDATE public.profiles
    SET credits = credits + _credits
    WHERE user_id = _user_id
    RETURNING credits INTO _new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
  VALUES (_user_id, _credits, _kind || ':' || _reference, _new_balance);

  UPDATE public.payment_transactions
    SET status = 'success', paid_at = now()
    WHERE reference = _reference;

  RETURN _new_balance;
END;
$$;
