CREATE OR REPLACE FUNCTION public.process_withdrawal_approval(
  _withdrawal_id uuid,
  _admin_id uuid,
  _target_status text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  withdrawal_row record;
  wallet_row record;
BEGIN
  IF _target_status NOT IN ('pending', 'approved', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal status';
  END IF;

  SELECT * INTO withdrawal_row
  FROM public.withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF withdrawal_row IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF _target_status = 'rejected' THEN
    IF withdrawal_row.status = 'rejected' THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', withdrawal_row.status, 'amount', withdrawal_row.amount);
    END IF;

    UPDATE public.withdrawal_requests
    SET status = 'rejected',
        stage = 'under_review',
        note = COALESCE(_note, note),
        updated_at = now()
    WHERE id = _withdrawal_id;

    INSERT INTO public.notifications(user_id, title, body, category)
    VALUES (
      withdrawal_row.user_id,
      'Withdrawal rejected',
      'Your withdrawal of ₦' || withdrawal_row.amount::text || ' was rejected.' ||
      CASE WHEN _note IS NOT NULL AND _note <> '' THEN ' Note: ' || _note ELSE '' END,
      'withdrawal'
    );

    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', 'rejected', 'amount', withdrawal_row.amount);
  END IF;

  IF _target_status IN ('approved', 'paid') THEN
    IF withdrawal_row.status IN ('approved', 'paid') THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', withdrawal_row.status, 'amount', withdrawal_row.amount);
    END IF;

    IF withdrawal_row.status <> 'pending' THEN
      RAISE EXCEPTION 'Withdrawal is no longer pending';
    END IF;

    SELECT * INTO wallet_row
    FROM public.wallets
    WHERE user_id = withdrawal_row.user_id
      AND currency = 'NGN'
    FOR UPDATE;

    IF wallet_row IS NULL THEN
      RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF wallet_row.balance < withdrawal_row.amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    UPDATE public.wallets
    SET balance = wallet_row.balance - withdrawal_row.amount,
        updated_at = now()
    WHERE id = wallet_row.id;

    INSERT INTO public.transactions(user_id, type, category, asset, amount, status, stage, reference)
    VALUES (
      withdrawal_row.user_id,
      'debit',
      'withdrawal',
      'NGN',
      withdrawal_row.amount,
      'completed',
      CASE WHEN _target_status = 'paid' THEN 'paid' ELSE 'approved' END,
      withdrawal_row.reference
    );

    UPDATE public.withdrawal_requests
    SET status = _target_status,
        stage = CASE WHEN _target_status = 'paid' THEN 'paid' ELSE 'approved' END,
        note = COALESCE(_note, note),
        updated_at = now()
    WHERE id = _withdrawal_id;

    INSERT INTO public.notifications(user_id, title, body, category)
    VALUES (
      withdrawal_row.user_id,
      'Withdrawal approved',
      'Your withdrawal of ₦' || withdrawal_row.amount::text || ' has been approved and sent for processing.',
      'withdrawal'
    );

    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', _target_status, 'amount', withdrawal_row.amount);
  END IF;

  RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', withdrawal_row.status, 'amount', withdrawal_row.amount);
END $$;

REVOKE EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, uuid, text, text) TO service_role;
