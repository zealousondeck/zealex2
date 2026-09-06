-- Preserve a pending checkout row and allow the credit RPC to resume it.
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
  existing_row public.deposit_requests%ROWTYPE;
  new_id uuid;
BEGIN
  IF _user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR round(_amount, 2) <> _amount THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RAISE EXCEPTION 'Invalid reference';
  END IF;

  SELECT * INTO existing_row
  FROM public.deposit_requests
  WHERE reference = btrim(_reference)
  FOR UPDATE;

  IF existing_row.id IS NOT NULL THEN
    IF existing_row.user_id <> _user_id THEN
      RAISE EXCEPTION 'Deposit reference belongs to another user';
    END IF;
    IF existing_row.status IN ('approved', 'paid') OR existing_row.stage = 'paid' THEN
      RETURN jsonb_build_object('duplicate', true, 'id', existing_row.id);
    END IF;
    UPDATE public.deposit_requests
    SET amount = _amount, currency = 'NGN', status = 'approved', stage = 'paid',
        note = 'Paystack deposit', updated_at = now()
    WHERE id = existing_row.id;
    new_id := existing_row.id;
  ELSE
    INSERT INTO public.deposit_requests(user_id, amount, currency, reference, status, stage, note)
    VALUES (_user_id, _amount, 'NGN', btrim(_reference), 'approved', 'paid', 'Paystack deposit')
    RETURNING id INTO new_id;
  END IF;

  INSERT INTO public.transactions(user_id, type, category, asset, amount, status, stage, reference)
  VALUES (_user_id, 'credit', 'deposit', 'NGN', _amount, 'completed', 'paid', btrim(_reference));

  INSERT INTO public.wallets(user_id, currency, balance)
  VALUES (_user_id, 'NGN', _amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.notifications(user_id, title, body, category)
  VALUES (_user_id, 'Deposit successful',
          'Your ₦' || _amount::text || ' deposit has been credited to your wallet.', 'deposit');

  RETURN jsonb_build_object('duplicate', false, 'id', new_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.paystack_credit_deposit(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paystack_credit_deposit(uuid, numeric, text) TO service_role;