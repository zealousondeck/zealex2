alter table public.sogo_provider_records
  add column if not exists provider_transaction_id text,
  add column if not exists last_event_id text,
  add column if not exists last_event_at timestamptz;

create unique index if not exists sogo_provider_records_event_unique
  on public.sogo_provider_records (last_event_id)
  where last_event_id is not null;

create unique index if not exists sogo_provider_records_provider_transaction_unique
  on public.sogo_provider_records (provider_transaction_id)
  where provider_transaction_id is not null;

create or replace function public.reconcile_sogo_transaction(
  _event_id text,
  _provider_reference text,
  _provider_transaction_id text,
  _provider_status text,
  _verified_status text,
  _amount numeric,
  _currency text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_row public.sogo_provider_records%rowtype;
  transaction_row public.transactions%rowtype;
  wallet_row public.wallets%rowtype;
  normalized_provider_status text;
  normalized_verified_status text;
  n_amount numeric;
  n_currency text;
begin
  if _event_id is null or btrim(_event_id) = '' then raise exception 'Missing Sogo event id'; end if;
  if _provider_reference is null or btrim(_provider_reference) = '' then raise exception 'Missing Sogo provider reference'; end if;
  if _provider_status is null or btrim(_provider_status) = '' then raise exception 'Missing Sogo provider status'; end if;

  normalized_provider_status := lower(btrim(_provider_status));
  normalized_verified_status := lower(btrim(coalesce(_verified_status, '')));
  n_amount := _amount;
  n_currency := upper(coalesce(_currency, ''));

  select * into provider_row from public.sogo_provider_records
  where provider_reference = btrim(_provider_reference) for update;
  if provider_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'provider_reference_not_found');
  end if;

  if _provider_transaction_id is not null and btrim(_provider_transaction_id) <> '' then
    if provider_row.provider_transaction_id is null then
      update public.sogo_provider_records
      set provider_transaction_id = btrim(_provider_transaction_id), updated_at = now()
      where id = provider_row.id;
    elsif provider_row.provider_transaction_id <> btrim(_provider_transaction_id) then
      return jsonb_build_object('ok', false, 'reason', 'provider_transaction_id_mismatch');
    end if;
  end if;

  if provider_row.last_event_id = btrim(_event_id) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'reason', 'event_already_processed');
  end if;

  update public.sogo_provider_records
  set provider_status = btrim(_provider_status),
      provider_transaction_id = coalesce(provider_row.provider_transaction_id, nullif(btrim(_provider_transaction_id), '')),
      last_event_id = btrim(_event_id),
      last_event_at = now(),
      updated_at = now()
  where id = provider_row.id;

  if provider_row.transaction_id is null then
    return jsonb_build_object('ok', true, 'duplicate', false, 'reconciled', false, 'reason', 'no_transaction_linked');
  end if;

  select * into transaction_row from public.transactions
  where id = provider_row.transaction_id for update;
  if transaction_row.id is null then
    return jsonb_build_object('ok', true, 'duplicate', false, 'reconciled', false, 'reason', 'transaction_missing');
  end if;

  if normalized_provider_status in ('pending', 'processing', 'failed', 'cancelled', 'refunded', 'reversed', 'error', 'expired') then
    update public.transactions
    set status = case when normalized_provider_status = 'failed' then 'rejected' else normalized_provider_status end,
        stage = 'reviewed',
        reviewed_at = now()
    where id = transaction_row.id and status not in ('completed', 'cancelled', 'rejected', 'refunded');
    return jsonb_build_object('ok', true, 'duplicate', false, 'reconciled', true, 'credit_allowed', false, 'status', normalized_provider_status, 'verified_status', normalized_verified_status);
  end if;

  if normalized_provider_status <> 'completed' or normalized_verified_status <> 'completed' then
    return jsonb_build_object('ok', true, 'duplicate', false, 'reconciled', true, 'credit_allowed', false, 'status', normalized_provider_status, 'verified_status', normalized_verified_status);
  end if;

  if n_currency <> 'NGN' or n_amount is null or n_amount <= 0 or transaction_row.wallet_settled_at is not null or transaction_row.type <> 'sell' then
    return jsonb_build_object('ok', true, 'duplicate', false, 'reconciled', true, 'credit_allowed', false, 'status', normalized_provider_status, 'verified_status', normalized_verified_status);
  end if;

  select * into wallet_row from public.wallets
  where user_id = transaction_row.user_id and currency = 'NGN' for update;
  if wallet_row.id is null then raise exception 'Wallet not found'; end if;

  update public.wallets set balance = balance + n_amount, updated_at = now() where id = wallet_row.id;
  update public.transactions
  set amount = n_amount, status = 'completed', stage = 'paid', wallet_settled_at = now(), reviewed_at = now()
  where id = transaction_row.id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'reconciled', true, 'credit_allowed', true, 'status', normalized_provider_status, 'verified_status', normalized_verified_status);
end;
$$;

revoke execute on function public.reconcile_sogo_transaction(text, text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.reconcile_sogo_transaction(text, text, text, text, text, numeric, text) to service_role;
