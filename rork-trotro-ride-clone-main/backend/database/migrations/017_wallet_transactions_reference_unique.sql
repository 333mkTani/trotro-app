-- Enforce reference uniqueness so a Paystack transaction can never be
-- verified/credited twice (multiple NULLs remain allowed for non-gateway
-- transactions such as ride_payment/driver_payment).
alter table public.wallet_transactions
  add constraint wallet_transactions_reference_key unique (reference);
