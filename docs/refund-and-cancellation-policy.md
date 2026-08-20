# Refund and cancellation policy implementation register

This document is a product-policy baseline that requires finance, operations, and legal approval before publication. Customer-facing amounts, deadlines, and exceptions must match the deployed configuration and Paystack reconciliation behavior.

## Policy decisions to approve

| Scenario | Current product state or path | Policy decision required | Owner |
|---|---|---|---|
| Passenger cancels before the configured cutoff | Booking cancellation endpoint and cancellation window | Refund amount, fee, and eligibility | Finance/legal |
| Passenger cancels after cutoff | Cancellation may be restricted or non-refundable | Displayed warning and exception handling | Operations/legal |
| Driver cancels or withdraws | Driver request/operational cancellation paths | Passenger remedy and driver consequences | Operations |
| Vehicle unavailable or trip cancelled | Schedule/driver operational failure | Automatic refund or rebooking rules | Operations/finance |
| No-show | Arrival/boarding/no-show lifecycle | Passenger refund, driver compensation, evidence standard | Operations/finance |
| Deposit payment mismatch/failure | Payment ledger failure and mismatch events | Customer notification, retry, and dispute route | Finance |
| Refund pending or failed | Refund reconciliation states | SLA, escalation, and manual reconciliation owner | Finance |
| Wallet withdrawal failure | Withdrawal is refunded to wallet after provider failure | Customer communication and retry policy | Finance/support |

## Customer-facing requirements

Before a passenger confirms payment, the app must show the fare, deposit or balance amount, cancellation cutoff, refund method, expected processing time, and support route. After cancellation, the booking detail must show the decision, amount, status, and provider reference in a privacy-safe form. A `refund_pending` state must not be presented as completed until reconciliation confirms it.

## Reconciliation and dispute workflow

Finance reviews mismatches, pending refunds, duplicate callbacks, and stuck withdrawals from the payment ledger and provider dashboard. Every manual correction requires an incident or reconciliation ID, two-person approval for balance changes, before/after amounts, provider evidence, and a customer notification decision. Never resolve a mismatch by editing a ledger row without an auditable compensating transaction.

## Acceptance criteria

The policy is ready for launch only after legal/finance approval, UI copy matches the configured cancellation constants, automated tests cover each state, live Paystack test-mode acceptance covers initialization/verification/webhook replay/refund paths, support has an escalation SLA, and reconciliation dashboards or reports identify every pending or mismatched transaction.

## References

[1]: https://paystack.com/docs/payments/verify-payments/ "Paystack payment verification documentation"

[2]: https://paystack.com/docs/payments/webhooks/ "Paystack webhook documentation"
