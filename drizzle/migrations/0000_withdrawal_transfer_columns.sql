ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS transfer_recipient_code text,
  ADD COLUMN IF NOT EXISTS transfer_code text,
  ADD COLUMN IF NOT EXISTS transfer_reference text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_name text;

COMMENT ON COLUMN public.withdrawal_requests.transfer_recipient_code IS 'Paystack transfer recipient code, set when the admin approval sends a real transfer';
COMMENT ON COLUMN public.withdrawal_requests.transfer_code IS 'Paystack transfer code returned by the transfer initiation';
COMMENT ON COLUMN public.withdrawal_requests.transfer_reference IS 'Zealex-generated unique reference sent to Paystack for the transfer';
COMMENT ON COLUMN public.withdrawal_requests.bank_name IS 'Snapshot of the destination bank name at approval time';
COMMENT ON COLUMN public.withdrawal_requests.account_number IS 'Snapshot of the destination account number at approval time';
COMMENT ON COLUMN public.withdrawal_requests.account_name IS 'Snapshot of the destination account name at approval time';