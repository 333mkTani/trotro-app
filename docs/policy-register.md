# Trotro policy and documentation register

Issue #35 is implemented as a documentation baseline. These documents are intentionally written as approval-ready registers rather than final legal advice; the designated owners must complete the open decisions before public launch.

| Document | Primary owner | Required reviewers | Launch blocker |
|---|---|---|---|
| [Privacy and data protection](privacy-and-data-protection.md) | Privacy/security owner | Counsel, operations, Firebase/provider owners | Final notice, retention periods, deletion workflow, and support request channel |
| [Refund and cancellation](refund-and-cancellation-policy.md) | Finance owner | Counsel, operations, Paystack/reconciliation owner | Approved fees, deadlines, refund states, SLAs, and matching UI copy |
| [Driver onboarding and support](driver-onboarding-and-support.md) | Operations owner | Compliance, finance, security, support | Verification evidence, suspension/expiry process, support SLAs, and escalation drill |

## Cross-document acceptance checklist

Before launch, Trotro must publish the approved privacy notice, terms, refund/cancellation policy, driver terms, and support contacts. The product configuration must match the public wording. Retention and deletion jobs must be implemented and monitored. Finance must be able to reconcile payments, refunds, and withdrawals. Operations must be able to suspend drivers, review expiring documents, and respond to active safety incidents. Counsel must approve jurisdiction-specific language and provider/data-processing terms.

## Change control

Each approved policy must have a version, effective date, owner, reviewer, and change note. Product changes affecting collection, location, payments, cancellation, onboarding, or support require a policy-impact review before release. Never treat this register as a substitute for legal, tax, employment, transportation, or financial advice.

## References

[1]: https://www.nist.gov/privacy-framework "NIST Privacy Framework"

[2]: https://www.iso.org/standard/27001.html "ISO/IEC 27001 information security management systems"
