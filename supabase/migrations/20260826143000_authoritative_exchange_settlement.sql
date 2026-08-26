-- Make exchange settlement atomic and idempotent for crypto and gift-card sells.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS wallet_settled_at timestamptz;

CREATE OR REPLACE FUNCTION public.settle_exchange_transaction(
  _transaction_id uuid,
  _admin_id uuid,
  _target_status text,
  _stage text,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transaction_row public.transactions%ROWTYPE;
  wallet_row public.wallets%ROWTYPE;
  new_balance numeric;
BEGIN
  IF NOT public.has_any_role(_admin_id, ARRAY['admin','super_admin','finance']::public.app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized administrator';
  END IF;
  IF _target_status NOT IN ('processing', 'completed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transaction status';
  END IF;
  IF _stage IS NULL OR btrim(_stage) = '' THEN
    RAISE EXCEPTION 'Invalid transaction stage';
  END IF;

  SELECT * INTO transaction_row
  FROM public.transactions
  WHERE id = _transaction_id
    AND category IN ('crypto', 'giftcard')
  FOR UPDATE;
  IF transaction_row.id IS NULL THEN
    RAISE EXCEPTION 'Exchange transaction not found';
  END IF;

  IF transaction_row.status IN ('rejected', 'cancelled') THEN
    IF transaction_row.status = _target_status THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', transaction_row.status, 'amount', transaction_row.amount);
    END IF;
    RAISE EXCEPTION 'Transaction is already %', transaction_row.status;
  END IF;

  IF transaction_row.status = 'completed' AND _target_status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', 'completed', 'amount', transaction_row.amount);
  END IF;

  IF _target_status IN ('processing', 'rejected', 'cancelled') THEN
    IF transaction_row.status = _target_status THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', transaction_row.status, 'amount', transaction_row.amount);
    END IF;
    IF transaction_row.status = 'completed' THEN
      RAISE EXCEPTION 'Completed transaction cannot move backwards';
    END IF;
  END IF;

  IF _target_status = 'completed' AND transaction_row.type = 'sell' AND transaction_row.wallet_settled_at IS NULL THEN
    SELECT * INTO wallet_row
    FROM public.wallets
    WHERE user_id = transaction_row.user_id AND currency = 'NGN'
    FOR UPDATE;
    IF wallet_row.id IS NULL THEN
      RAISE EXCEPTION 'Wallet not found';
    END IF;

    new_balance := wallet_row.balance + transaction_row.amount;
    UPDATE public.wallets
    SET balance = new_balance, updated_at = now()
    WHERE id = wallet_row.id;

    UPDATE public.transactions
    SET status = 'completed', stage = _stage, wallet_settled_at = now(),
        reviewer_notes = COALESCE(_note, reviewer_notes), reviewed_at = now(), reviewed_by = _admin_id
    WHERE id = transaction_row.id;

    INSERT INTO public.audit_logs(admin_id, action, entity_type, entity_id, details)
    VALUES (_admin_id, 'exchange.settled', 'transactions', transaction_row.id::text,
            jsonb_build_object('reference', transaction_row.reference, 'user_id', transaction_row.user_id,
              'category', transaction_row.category, 'amount', transaction_row.amount,
              'balance_after', new_balance));
  ELSE
    UPDATE public.transactions
    SET status = _target_status, stage = _stage,
        reviewer_notes = COALESCE(_note, reviewer_notes), reviewed_at = now(), reviewed_by = _admin_id
    WHERE id = transaction_row.id;

    INSERT INTO public.audit_logs(admin_id, action, entity_type, entity_id, details)
    VALUES (_admin_id, 'exchange.' || _target_status, 'transactions', transaction_row.id::text,
            jsonb_build_object('reference', transaction_row.reference, 'user_id', transaction_row.user_id,
              'category', transaction_row.category, 'amount', transaction_row.amount));
  END IF;

  INSERT INTO public.notifications(user_id, title, body, category)
  VALUES (transaction_row.user_id,
          CASE WHEN _target_status = 'completed' THEN 'Exchange completed' ELSE 'Exchange ' || _target_status END,
          CASE WHEN _target_status = 'completed' AND transaction_row.type = 'sell'
            THEN 'Your ' || transaction_row.category || ' exchange was completed and the payout was credited to your wallet.'
            ELSE 'Your ' || transaction_row.category || ' exchange was marked ' || _target_status || '.' END,
          'trade');

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', _target_status, 'amount', transaction_row.amount);
END $$;

REVOKE EXECUTE ON FUNCTION public.settle_exchange_transaction(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_exchange_transaction(uuid, uuid, text, text, text) TO service_role;

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;