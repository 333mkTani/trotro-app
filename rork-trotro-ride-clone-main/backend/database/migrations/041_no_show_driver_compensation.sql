alter type reservation_payment_status add value if not exists 'deposit_forfeited';
alter type transaction_type add value if not exists 'no_show_compensation';
