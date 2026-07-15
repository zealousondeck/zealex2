CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref_code text := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  ref_by uuid;
BEGIN
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
  VALUES (new.id, 'Welcome to Zealex Exchange',
          'Your account is ready. Complete your first exchange to see it here.', 'system');
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;

  IF ref_by IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id) VALUES (ref_by, new.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new;
END $function$;