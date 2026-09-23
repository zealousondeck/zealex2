-- Harden the existing financial RPCs without replacing their public contracts.

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
  IF _user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR round(_amount, 2) <> _amount THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RAISE EXCEPTION 'Invalid reference';
  END IF;

  SELECT id INTO existing_id
  FROM public.deposit_requests
  WHERE reference = btrim(_reference)
  FOR UPDATE;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'id', existing_id);
  END IF;

  BEGIN
    INSERT INTO public.deposit_requests(user_id, amount, currency, reference, status, stage, note)
    VALUES (_user_id, _amount, 'NGN', btrim(_reference), 'approved', 'paid', 'Paystack deposit')
    RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO existing_id
    FROM public.deposit_requests
    WHERE reference = btrim(_reference);
    IF existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('duplicate', true, 'id', existing_id);
    END IF;
    RAISE;
  END;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE category = 'withdrawal'
    GROUP BY reference
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate withdrawal transaction references exist; resolve them before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_withdrawal_reference_unique
  ON public.transactions(reference)
  WHERE category = 'withdrawal';

CREATE OR REPLACE FUNCTION public.process_withdrawal_approval(
  _withdrawal_id uuid,
  _admin_id uuid,
  _target_status text,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  withdrawal_row public.withdrawal_requests%ROWTYPE;
  wallet_row public.wallets%ROWTYPE;
  transaction_id uuid;
BEGIN
  IF NOT public.has_any_role(_admin_id, ARRAY['admin','super_admin','finance']::public.app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized administrator';
  END IF;
  IF _target_status NOT IN ('approved', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal status';
  END IF;

  SELECT * INTO withdrawal_row
  FROM public.withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;
  IF withdrawal_row.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF withdrawal_row.status = 'paid' THEN
    IF _target_status = 'paid' THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', 'paid', 'amount', withdrawal_row.amount);
    END IF;
    RAISE EXCEPTION 'Withdrawal is already paid';
  END IF;

  IF withdrawal_row.status = 'approved' THEN
    IF _target_status = 'paid' THEN
      UPDATE public.withdrawal_requests
      SET status = 'paid', stage = 'paid', note = COALESCE(_note, note), updated_at = now()
      WHERE id = withdrawal_row.id;
      INSERT INTO public.notifications(user_id, title, body, category)
      VALUES (withdrawal_row.user_id, 'Withdrawal marked paid',
              'Your withdrawal has been marked paid. Confirm payout settlement separately.', 'withdrawal');
      INSERT INTO public.audit_logs(admin_id, action, entity_type, entity_id, details)
      VALUES (_admin_id, 'withdrawal.paid', 'withdrawal_requests', withdrawal_row.id::text,
              jsonb_build_object('reference', withdrawal_row.reference, 'amount', withdrawal_row.amount, 'status', 'paid'));
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', 'paid', 'amount', withdrawal_row.amount);
    END IF;
    IF _target_status = 'approved' THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', 'approved', 'amount', withdrawal_row.amount);
    END IF;
    RAISE EXCEPTION 'Withdrawal is already approved';
  END IF;

  IF withdrawal_row.status = 'rejected' THEN
    RAISE EXCEPTION 'Withdrawal is already rejected';
  END IF;
  IF withdrawal_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal is not pending';
  END IF;

  IF _target_status = 'rejected' THEN
    UPDATE public.withdrawal_requests
    SET status = 'rejected', stage = 'under_review', note = COALESCE(_note, note), updated_at = now()
    WHERE id = withdrawal_row.id;
    INSERT INTO public.notifications(user_id, title, body, category)
    VALUES (withdrawal_row.user_id, 'Withdrawal rejected',
            'Your ₦' || withdrawal_row.amount::text || ' withdrawal was rejected.' ||
            CASE WHEN _note IS NOT NULL AND _note <> '' THEN ' Note: ' || _note ELSE '' END, 'withdrawal');
    INSERT INTO public.audit_logs(admin_id, action, entity_type, entity_id, details)
    VALUES (_admin_id, 'withdrawal.rejected', 'withdrawal_requests', withdrawal_row.id::text,
            jsonb_build_object('reference', withdrawal_row.reference, 'amount', withdrawal_row.amount, 'status', 'rejected'));
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', 'rejected', 'amount', withdrawal_row.amount);
  END IF;

  SELECT * INTO wallet_row
  FROM public.wallets
  WHERE user_id = withdrawal_row.user_id AND currency = 'NGN'
  FOR UPDATE;
  IF wallet_row.id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  IF wallet_row.balance < withdrawal_row.amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.wallets
  SET balance = balance - withdrawal_row.amount, updated_at = now()
  WHERE id = wallet_row.id;

  INSERT INTO public.transactions(user_id, type, category, asset, amount, status, stage, reference)
  VALUES (withdrawal_row.user_id, 'debit', 'withdrawal', 'NGN', withdrawal_row.amount,
          'completed', CASE WHEN _target_status = 'paid' THEN 'paid' ELSE 'approved' END, withdrawal_row.reference)
  ON CONFLICT (reference) WHERE category = 'withdrawal'
  DO NOTHING
  RETURNING id INTO transaction_id;
  IF transaction_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal debit already exists';
  END IF;

  UPDATE public.withdrawal_requests
  SET status = _target_status,
      stage = CASE WHEN _target_status = 'paid' THEN 'paid' ELSE 'approved' END,
      note = COALESCE(_note, note), updated_at = now()
  WHERE id = withdrawal_row.id;
  INSERT INTO public.notifications(user_id, title, body, category)
  VALUES (withdrawal_row.user_id,
          CASE WHEN _target_status = 'paid' THEN 'Withdrawal marked paid' ELSE 'Withdrawal approved' END,
          CASE WHEN _target_status = 'paid'
            THEN 'Your withdrawal has been marked paid. Confirm payout settlement separately.'
            ELSE 'Your withdrawal has been approved and is awaiting payout processing.' END,
          'withdrawal');
  INSERT INTO public.audit_logs(admin_id, action, entity_type, entity_id, details)
  VALUES (_admin_id, 'withdrawal.' || _target_status, 'withdrawal_requests', withdrawal_row.id::text,
          jsonb_build_object('reference', withdrawal_row.reference, 'amount', withdrawal_row.amount, 'status', _target_status, 'transaction_id', transaction_id));

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', _target_status, 'amount', withdrawal_row.amount);
END $$;

REVOKE EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, uuid, text, text) TO service_role;