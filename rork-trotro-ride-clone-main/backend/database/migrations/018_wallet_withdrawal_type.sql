-- Driver payout/withdrawal requests are recorded as wallet_transactions too,
-- but 'ride_payment'/'driver_payment'/'top_up'/'refund' don't fit semantically.
alter type transaction_type add value if not exists 'withdrawal';
