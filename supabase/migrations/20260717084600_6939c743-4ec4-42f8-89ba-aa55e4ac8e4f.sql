
-- Helper for multi-role checks
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- ============ crypto_rates ============
CREATE TABLE public.crypto_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  network text NOT NULL DEFAULT '',
  buy_rate numeric(18,2) NOT NULL DEFAULT 0,
  sell_rate numeric(18,2) NOT NULL DEFAULT 0,
  change_24h numeric(6,2) NOT NULL DEFAULT 0,
  min_amount numeric(18,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.crypto_rates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.crypto_rates TO authenticated;
GRANT ALL ON public.crypto_rates TO service_role;
ALTER TABLE public.crypto_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active crypto rates" ON public.crypto_rates
  FOR SELECT TO anon, authenticated USING (is_active OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));
CREATE POLICY "Finance manages crypto rates" ON public.crypto_rates
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));
CREATE TRIGGER trg_crypto_rates_updated BEFORE UPDATE ON public.crypto_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ giftcard_rates ============
CREATE TABLE public.giftcard_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  category text NOT NULL DEFAULT 'Retail',
  currency text NOT NULL DEFAULT 'USD',
  card_type text NOT NULL DEFAULT 'Physical',
  buy_rate numeric(18,2) NOT NULL DEFAULT 0,
  sell_rate numeric(18,2) NOT NULL DEFAULT 0,
  min_amount numeric(18,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (brand, currency, card_type)
);
GRANT SELECT ON public.giftcard_rates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.giftcard_rates TO authenticated;
GRANT ALL ON public.giftcard_rates TO service_role;
ALTER TABLE public.giftcard_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active giftcard rates" ON public.giftcard_rates
  FOR SELECT TO anon, authenticated USING (is_active OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));
CREATE POLICY "Finance manages giftcard rates" ON public.giftcard_rates
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));
CREATE TRIGGER trg_giftcard_rates_updated BEFORE UPDATE ON public.giftcard_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ transactions review columns ============
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reviewer_notes text,
  ADD COLUMN IF NOT EXISTS proof_path text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Allow finance/support to also read transactions
DROP POLICY IF EXISTS "Admins read all transactions" ON public.transactions;
CREATE POLICY "Staff read all transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance','support']::app_role[]));
DROP POLICY IF EXISTS "Admins update all transactions" ON public.transactions;
CREATE POLICY "Staff update all transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));

-- Broaden deposit/withdrawal read access to finance/support (keep existing owner + admin policies intact)
CREATE POLICY "Staff read deposits" ON public.deposit_requests
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance','support']::app_role[]));
CREATE POLICY "Staff read withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance','support']::app_role[]));

-- Referrals: allow admin/finance to view all and update earnings
CREATE POLICY "Staff read all referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));
CREATE POLICY "Staff update referrals" ON public.referrals
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','finance']::app_role[]));

-- Admin notifications read (for history search)
CREATE POLICY "Admins read all notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

-- Seed defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('referral_percent', '5'::jsonb),
  ('site_name', '"Zealex"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed initial rates
INSERT INTO public.crypto_rates (symbol, name, network, buy_rate, sell_rate, change_24h) VALUES
  ('BTC','Bitcoin','Bitcoin', 104250000, 103200000, 2.41),
  ('ETH','Ethereum','ERC20', 5420000, 5360000, 1.12),
  ('USDT','Tether','TRC20', 1615, 1600, 0.05),
  ('BNB','BNB','BEP20', 1010000, 1000000, -0.83),
  ('SOL','Solana','Solana', 235000, 232000, 3.67),
  ('LTC','Litecoin','Litecoin', 168000, 166000, 0.94),
  ('DOGE','Dogecoin','Dogecoin', 285, 280, -1.24)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO public.giftcard_rates (brand, category, currency, card_type, buy_rate, sell_rate) VALUES
  ('Amazon','E-commerce','USD','Physical', 1180, 1150),
  ('Apple / iTunes','Entertainment','USD','Physical', 1240, 1210),
  ('Steam','Gaming','USD','Physical', 1320, 1290),
  ('Google Play','Apps','USD','Physical', 1090, 1060),
  ('Sephora','Retail','USD','Physical', 990, 960),
  ('Razer Gold','Gaming','USD','Physical', 1270, 1240),
  ('Nordstrom','Retail','USD','Physical', 1050, 1020),
  ('eBay','E-commerce','USD','Physical', 1010, 980)
ON CONFLICT (brand, currency, card_type) DO NOTHING;
