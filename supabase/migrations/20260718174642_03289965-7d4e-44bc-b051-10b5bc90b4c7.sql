
-- Prevent duplicate deposit references (Paystack idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS deposit_requests_reference_unique
  ON public.deposit_requests(reference);

-- Atomic credit function for verified Paystack payments
CREATE OR REPLACE FUNCTION public.paystack_credit_deposit(
  _user_id uuid,
  _amount numeric,
  _reference text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT id INTO existing_id FROM public.deposit_requests WHERE reference = _reference;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'id', existing_id);
  END IF;

  INSERT INTO public.deposit_requests(user_id, amount, currency, reference, status, stage, note)
  VALUES (_user_id, _amount, 'NGN', _reference, 'approved', 'paid', 'Paystack deposit')
  RETURNING id INTO new_id;

  INSERT INTO public.transactions(user_id, type, category, asset, amount, status, stage, reference)
  VALUES (_user_id, 'credit', 'deposit', 'NGN', _amount, 'completed', 'paid', _reference);

  INSERT INTO public.wallets(user_id, currency, balance)
  VALUES (_user_id, 'NGN', _amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.notifications(user_id, title, body, category)
  VALUES (_user_id, 'Deposit successful',
          'Your deposit of ₦' || _amount::text || ' has been credited to your wallet.',
          'deposit');

  RETURN jsonb_build_object('duplicate', false, 'id', new_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.paystack_credit_deposit(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paystack_credit_deposit(uuid, numeric, text) TO service_role;
