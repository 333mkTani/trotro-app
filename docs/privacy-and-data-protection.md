# Privacy and data protection implementation register

This document is an implementation baseline, not legal advice. Before public launch, the operator must have counsel review the final notice against the jurisdictions in which Trotro operates, the actual Firebase/Paystack/Mapbox/Render contracts, and the final support contact.

## Data inventory and purpose

| Data category | Examples in Trotro | Purpose | Primary systems | Access owner |
|---|---|---|---|---|
| Account and profile | Name, phone, role, driver profile | Authentication, safety, service delivery | API database, Firebase Auth | Product and support |
| Location and route telemetry | Passenger foreground location, driver GPS, route progress | Nearby stops, navigation, live bus operations, safety | Device local cache, API database, Redis/realtime | Operations |
| Booking and boarding | Route, stops, seat, QR/code state, timestamps | Reservation, boarding verification, dispute handling | API database | Operations and finance |
| Payment and wallet | Paystack references, amounts, ledger, withdrawals | Collections, refunds, reconciliation, payouts | API database, Paystack | Finance |
| Device and notification | Push token, app/version, delivery metadata | Service alerts and operational notifications | API database, Firebase | Product |
| Support and audit | Case notes, incident IDs, admin audit events | Support, fraud review, incident response | Support system and API audit store | Support and security |

## Retention baseline

The operator must approve exact retention periods before launch. Until approved, teams must not invent retention promises in user-facing copy. The following register is the decision record to complete:

| Record | Proposed operational minimum | Deletion/anonymization trigger | Approver |
|---|---:|---|---|
| Account/profile | Active account plus an approved post-closure period | Verified deletion request or expiry | Privacy owner |
| Location telemetry | Short operational window | Automatic scheduled purge | Operations/security |
| Booking and payment ledger | Finance/legal retention period | Restricted archive or approved legal deletion | Finance/counsel |
| Push tokens | Until logout, invalidation, or expiry | Token removal | Product |
| Support cases | Approved support/audit period | Case retention expiry | Support/privacy |
| Backups | Backup rotation policy | Backup expiry; legal hold exception | Infrastructure |

## User rights and operational workflow

Support must provide a verified request path for access, correction, deletion, restriction, and objection where applicable. Identity verification must happen before disclosure or deletion. Each request receives an ID, owner, due date, status, affected systems, and completion evidence. Deletion must cover the API database, Redis/cache data, device secure/local storage, push-token records, and provider-side data where Trotro controls the request; payment and safety records may require restricted retention under counsel-approved rules.

Security incidents must be triaged through the incident process, with the event time, affected data classes, containment action, notification decision, and owner recorded. Secrets, bearer tokens, raw payment payloads, and unredacted personal data must never be attached to tickets or logs.

## Acceptance criteria

The policy is ready for launch only after counsel approves the final notice, the support channel is published, retention jobs are implemented and monitored, account deletion is tested end to end, provider data-processing terms are recorded, and the mobile apps link to the approved notice and terms.

## References

[1]: https://www.oecd.org/en/topics/policy-issues/privacy-and-data-protection.html "OECD privacy and data protection principles"

[2]: https://firebase.google.com/support/privacy "Firebase privacy and security documentation"
