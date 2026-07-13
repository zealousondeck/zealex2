-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- WALLETS
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'NGN',
  balance numeric(18,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);
grant select, insert, update, delete on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "Users can read own wallet" on public.wallets for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own wallet" on public.wallets for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own wallet" on public.wallets for update to authenticated using (auth.uid() = user_id);

-- TRANSACTIONS
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'buy',
  category text not null default 'crypto',
  asset text not null,
  amount numeric(18,2) not null default 0,
  quantity numeric(24,8),
  status text not null default 'pending',
  reference text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "Users can read own transactions" on public.transactions for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.transactions for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions for update to authenticated using (auth.uid() = user_id);
create index transactions_user_created_idx on public.transactions (user_id, created_at desc);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'system',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Users can read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own notifications" on public.notifications for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- NEW USER TRIGGER
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.wallets (user_id, currency, balance) values (new.id, 'NGN', 0);
  insert into public.notifications (user_id, title, body, category)
  values (new.id, 'Welcome to ZEAlex Exchange', 'Your account is ready. Complete your first exchange to see it here.', 'system');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- REALTIME
alter table public.transactions replica identity full;
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.notifications;