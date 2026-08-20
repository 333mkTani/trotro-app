# Driver onboarding and support implementation register

## Driver onboarding

A driver must not receive active trip or live-location duties until the following checks are complete and recorded: identity verification, licence and vehicle documentation, ownership or authorization to operate the vehicle, background/safety review where required, payout-account verification, training acknowledgement, emergency contact, and acceptance of driver terms. Each document needs an expiry date and a re-verification owner. Expired or rejected documentation must disable the relevant operational capability without deleting historical trip or payout records.

| Check | Evidence | Status owner | Renewal trigger |
|---|---|---|---|
| Identity and phone | Verified account and identity record | Compliance | Change or review interval |
| Licence and vehicle | Approved document references and expiry | Operations | Expiry or vehicle change |
| Safety training | Versioned acknowledgement | Operations | Policy revision |
| Payout account | Verified destination and test/reconciliation result | Finance | Account change |
| Operational capability | Driver mode, availability, GPS, and boarding access | Dispatch | Suspension, expiry, or incident |

## Support model

Publish one passenger support channel and one driver support channel, with an emergency route for active safety incidents. Every case must include a case ID, requester role, booking or trip ID when relevant, category, severity, owner, first-response SLA, resolution SLA, data-access restriction, and closure reason. Support agents should see only the minimum data needed for the case and must not request passwords, full payment credentials, or bearer tokens.

Severity 1 covers active safety, account takeover, or broad service outage and requires immediate escalation to operations and security. Severity 2 covers payment loss, failed boarding, or a trip-critical issue and requires same-day ownership. Severity 3 covers ordinary booking, wallet, or profile questions and follows the published support SLA.

## Acceptance criteria

This register is complete only when operations approves onboarding evidence requirements, finance approves payout verification, support publishes channels and SLAs, the admin dashboard can record approval/suspension state, expired documentation is tested, incident escalation is rehearsed, and the passenger/driver apps expose the approved support route.

## References

[1]: https://www.iso.org/standard/27001.html "ISO/IEC 27001 information security management systems"

[2]: https://www.nist.gov/privacy-framework "NIST Privacy Framework"
