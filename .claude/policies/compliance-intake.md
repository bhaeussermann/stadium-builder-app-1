# Compliance & Regulatory Intake Policy

## Core Principle

Compliance requirements fundamentally shape application architecture — they cannot be bolted on later. **Never skip compliance during INTAKE.** Features that handle sensitive data (payments, personal information, health records) must have their regulatory obligations surfaced early, even when the user hasn't mentioned them.

The applicable domains are **inferred** during INTAKE and **confirmed by the user at the INTAKE approval**; the domain-specific implementation details flow into `project.md` §Compliance as `[INFERRED]` entries the user reviews there.

---

## Mandatory Rules

1. **Infer the applicable domains during INTAKE.** `intake-agent` matches the [Keyword Triggers](#keyword-triggers) against `documentation/`, the project description and the user's answers, and records each matching domain in `project.md` §Compliance before the INTAKE approval.

2. **Never assume compliance is not applicable.** When no domain is found, the INTAKE approval says so and asks the user to tell you if the app takes payments, stores personal information or handles health records (`start.md` Step 8b).

3. **Never carry design compliance shortcuts into production.** Designs routinely include payment forms, user registration screens, and data collection flows without any compliance considerations. These are acceptable in a demo but must be flagged during INTAKE for the production spec.

4. **Implementation details fold to `project.md` §Compliance.** Once the applicable domains are established, the agent generates `[INFERRED]` entries describing how those domains typically constrain the app (third-party payment fields, right-to-erasure, audit log, tenant isolation, etc.). These entries are derived from industry-standard practice for the domain — not from a vacuum. The user reviews them at the INTAKE approval and edits any that don't fit their context.

---

## Keyword Triggers

`intake-agent` records a domain when any of its keywords appear in `documentation/`, the project description or the user's answers:

| Keywords | Compliance Domain | Manifest ID | Key Concern |
|----------|------------------|-------------|-------------|
| payment, checkout, billing, invoice, card, credit card, debit card, subscription, pricing, charge | **PCI-DSS** | `pci-dss` | Never store card numbers or CVVs; use tokenisation via certified payment provider (Stripe, Adyen, etc.); no card data in logs |
| user profile, registration, sign-up, email, phone, address, name, date of birth, personal data | **Data Protection (GDPR / POPIA / CCPA)** | `gdpr`, `popia`, or `ccpa` | Consent management, data minimisation, right to erasure, privacy policy, cookie consent |
| patient, health, medical, diagnosis, prescription, clinical, vitals | **HIPAA** | `hipaa` | PHI handling, access controls, audit trails, encryption at rest and in transit |
| tenant, multi-tenant, SaaS, customer data, B2B | **SOC 2** | `soc2` | Data isolation, access controls, audit logging, incident response |
| location, GPS, tracking, geolocation | **Data Protection + ePrivacy** | `gdpr`, `popia`, or `ccpa` | Location data is sensitive personal data; requires explicit consent |
| file upload, document, attachment | **Data Protection** | `gdpr`, `popia`, or `ccpa` | File type validation, malware scanning, storage encryption, retention policies |
| audit, log, trail, history | **Multiple** | *(use the domain-specific ID)* | Immutable audit trails may be required by PCI-DSS, HIPAA, SOC 2, or industry-specific regulations |

**Data-protection region:** use the region the documents or answers name (`gdpr` for EU/UK, `popia` for South Africa, `ccpa` for California). When none is named, use `gdpr` (most restrictive) and say so in §Compliance so the user can correct it at the INTAKE approval.

---

## Per-Domain `[INFERRED]` Entries

Once the domains are inferred, the agent populates `project.md` §Compliance with the following entries — **one block per domain**. Each entry is `[INFERRED]` because the agent is applying domain knowledge (industry-standard obligations for the domain), not falling back to defaults in the absence of source.

### PCI-DSS

```markdown
- `[INFERRED]` Payment handling: third-party hosted payment fields (Stripe / Adyen / PayFast pattern); no raw card data (PAN, CVV, magnetic stripe) on our servers
- `[INFERRED]` Payment-related errors MUST NOT include card numbers or sensitive payment details in error messages or logs
- `[INFERRED]` Payment pages served over HTTPS with TLS 1.2+
```

### Data Protection (GDPR / POPIA / CCPA)

```markdown
- `[INFERRED]` Personal data collection includes a clear purpose statement and user consent mechanism
- `[INFERRED]` Right to erasure: users can request deletion of their personal data via the Profile page
- `[INFERRED]` Personal data encrypted at rest and in transit
- `[INFERRED]` Privacy policy link visible on all data-collection forms
```

### HIPAA

```markdown
- `[INFERRED]` All access to PHI logged in an immutable audit trail
- `[INFERRED]` PHI never appears in error messages, logs, or client-side state
- `[INFERRED]` PHI encrypted at rest (AES-256) and in transit (TLS 1.2+)
- `[INFERRED]` Session timeouts enforced on screens displaying PHI
```

### SOC 2

```markdown
- `[INFERRED]` Tenant data isolated — no cross-tenant data access
- `[INFERRED]` All data access logged with user identity, action, and timestamp
```

### Accessibility (Always Applied — Industry Default)

Accessibility is always present in `project.md` §Baseline NFRs (`NFR-base-1`) because WCAG 2.1 AA is legally required in many jurisdictions (ADA in the US, EAA in the EU, PAIA in South Africa).

```markdown
- `[DEFAULT]` Accessibility: WCAG 2.1 Level AA baseline
```

---

## CR Generation Inside the Brief

The `intake-agent` writes `[INFERRED]` compliance entries directly into `project.md` §Compliance as testable constraints, one bullet per obligation.

If the user **edits** a compliance entry during the INTAKE approval (e.g., strikes "tenant data isolated" because the app is single-tenant), only the surviving entries remain in §Compliance.

If no compliance domains apply, §Compliance reads: "No compliance domains were identified during intake screening."
