
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- KYC
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  address text NOT NULL,
  id_type text NOT NULL,
  id_number text NOT NULL,
  id_document_path text,
  selfie_path text,
  proof_of_address_path text,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own KYC" ON public.kyc_submissions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own KYC" ON public.kyc_submissions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pending KYC" ON public.kyc_submissions FOR UPDATE TO authenticated
USING ((auth.uid() = user_id AND status = 'pending') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER kyc_set_updated BEFORE UPDATE ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payment methods (banks + wallets)
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type text NOT NULL, -- 'bank' | 'wallet'
  label text NOT NULL,
  bank_name text,
  account_number text,
  account_name text,
  wallet_address text,
  wallet_network text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own methods" ON public.payment_methods FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Deposit requests
CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  proof_path text,
  note text,
  stage text NOT NULL DEFAULT 'submitted', -- submitted|under_review|approved|paid
  status text NOT NULL DEFAULT 'pending',
  reference text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deposits" ON public.deposit_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own deposits" ON public.deposit_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update deposits" ON public.deposit_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER dep_set_updated BEFORE UPDATE ON public.deposit_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  note text,
  stage text NOT NULL DEFAULT 'submitted',
  status text NOT NULL DEFAULT 'pending',
  reference text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own withdrawals" ON public.withdrawal_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update withdrawals" ON public.withdrawal_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wd_set_updated BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Transactions: add progress stage
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'submitted';

-- Referrals
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  earnings numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own referrals" ON public.referrals FOR SELECT TO authenticated
USING (referrer_id = auth.uid() OR referred_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System insert referrals" ON public.referrals FOR INSERT TO authenticated
WITH CHECK (referred_user_id = auth.uid());

-- Leaderboard view (aggregate only, no PII)
CREATE OR REPLACE VIEW public.referral_leaderboard
WITH (security_invoker=on) AS
SELECT
  r.referrer_id,
  COALESCE(p.full_name, 'Anonymous') AS display_name,
  COUNT(*) AS referrals_count,
  COALESCE(SUM(r.earnings), 0) AS total_earnings
FROM public.referrals r
LEFT JOIN public.profiles p ON p.id = r.referrer_id
GROUP BY r.referrer_id, p.full_name
ORDER BY total_earnings DESC, referrals_count DESC;
GRANT SELECT ON public.referral_leaderboard TO authenticated;

-- Loosen profiles read for leaderboard names (names only, restricted)
CREATE POLICY "Read display names for leaderboard" ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.referrals r WHERE r.referrer_id = profiles.id));

-- Announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'update', -- maintenance|promotion|update
  active boolean NOT NULL DEFAULT true,
  published_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All signed-in read active announcements" ON public.announcements FOR SELECT TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ann_set_updated BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reads" ON public.announcement_reads FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bootstrap: default new users to 'user' role and give them a referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code text := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  ref_by uuid;
BEGIN
  -- Optional: raw_user_meta_data->>'referred_by_code'
  IF new.raw_user_meta_data ? 'referred_by_code' THEN
    SELECT id INTO ref_by FROM public.profiles
      WHERE referral_code = upper(new.raw_user_meta_data->>'referred_by_code') LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, avatar_url, referral_code, referred_by)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    ref_code,
    ref_by
  );
  INSERT INTO public.wallets (user_id, currency, balance) VALUES (new.id, 'NGN', 0);
  INSERT INTO public.notifications (user_id, title, body, category)
  VALUES (new.id, 'Welcome to ZEAlex Exchange',
          'Your account is ready. Complete your first exchange to see it here.', 'system');
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;

  IF ref_by IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id) VALUES (ref_by, new.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new;
END $$;

-- Backfill referral codes for existing profiles
UPDATE public.profiles SET referral_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
WHERE referral_code IS NULL;
