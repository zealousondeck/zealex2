create table if not exists public.sogo_provider_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  operation_type text not null,
  provider_reference text not null,
  idempotency_key text,
  provider_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_reference),
  unique (idempotency_key)
);

create index if not exists sogo_provider_records_user_created_idx
  on public.sogo_provider_records (user_id, created_at desc);
create index if not exists sogo_provider_records_transaction_idx
  on public.sogo_provider_records (transaction_id);

alter table public.sogo_provider_records enable row level security;
create policy "Users read own Sogo provider records"
  on public.sogo_provider_records for select to authenticated
  using (auth.uid() = user_id);

grant select on public.sogo_provider_records to authenticated;
grant all on public.sogo_provider_records to service_role;

create trigger sogo_provider_records_set_updated
  before update on public.sogo_provider_records
  for each row execute function public.set_updated_at();
