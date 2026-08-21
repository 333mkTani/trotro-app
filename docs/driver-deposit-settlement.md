# Driver deposit settlement

> **Financial policy notice:** the settlement percentage, timing, cancellation treatment, and no-show treatment require finance and legal approval before production activation.

## Implemented behavior

After Paystack verifies a booking deposit, the service performs the following actions in one database transaction:

1. Locks the payment and booking records.
2. Confirms that the deposit amount and currency match the provider response.
3. Reserves the bus seat.
4. Confirms the booking and creates the boarding code.
5. Credits the assigned driver wallet according to `DRIVER_DEPOSIT_SETTLEMENT_PERCENT`.
6. Writes one `driver_payment` wallet transaction with reference `DRIVER_DEPOSIT_<booking_id>`.

The default configuration is 100 percent of the recorded deposit. The value is bounded from 0 to 100 and must be explicitly reviewed before production use.

## Idempotency

A partial unique index permits only one completed `driver_payment` transaction for a booking and driver. Replayed Paystack callbacks lock the existing payment and return the already-processed result without reserving a seat, creating another boarding code, or crediting the driver again.

## Reversals

If a credited booking is cancelled or expires into a no-show path, the service locks the original settlement, debits the same amount from the driver wallet, and records an auditable `refund` transaction with reference `DRIVER_DEPOSIT_REVERSAL_<booking_id>`. Reversal is idempotent and does not edit the original ledger row.

A refund or reversal must never be completed by mutating an existing ledger entry. It must be represented by a compensating transaction and reconciled against the Paystack payment and booking state.

## Release gates

Before enabling this in production, finance must approve the settlement percentage and the treatment of cancellations, vehicle failures, no-shows, and boarded-ride recovery. Staging must verify duplicate callback replay, concurrent verification, cancellation reversal, no-show reversal, wallet balance reconciliation, and failure rollback. Support must be able to explain the driver settlement and reversal references without exposing payment secrets.
