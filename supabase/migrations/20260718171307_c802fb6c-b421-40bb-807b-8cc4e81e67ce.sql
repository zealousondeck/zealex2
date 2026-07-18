
-- Prevent negative wallet balances
ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_balance_nonneg,
  ADD CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0);

-- Restrict transaction status values (adds processing + cancelled)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check,
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending','processing','completed','rejected','cancelled'));

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_positive,
  ADD CONSTRAINT transactions_amount_positive CHECK (amount >= 0);

-- Deposit/withdrawal amount + status guards
ALTER TABLE public.deposit_requests
  DROP CONSTRAINT IF EXISTS deposit_requests_amount_positive,
  ADD CONSTRAINT deposit_requests_amount_positive CHECK (amount > 0);

ALTER TABLE public.deposit_requests
  DROP CONSTRAINT IF EXISTS deposit_requests_status_check,
  ADD CONSTRAINT deposit_requests_status_check
    CHECK (status IN ('pending','approved','rejected','cancelled'));

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_positive,
  ADD CONSTRAINT withdrawal_requests_amount_positive CHECK (amount > 0);

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check,
  ADD CONSTRAINT withdrawal_requests_status_check
    CHECK (status IN ('pending','approved','paid','rejected','cancelled'));
