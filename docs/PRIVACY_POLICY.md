# Quickhire - Privacy Policy

**Effective Date**: [Insert Date]

## 1. Introduction

This Privacy Policy explains how Quickhire ("we", "us", "our") collects, uses, and protects your personal information when you use our Service.

## 2. Information We Collect

### Information You Provide
- **Account information**: Name, email address (via LinkedIn OAuth)
- **Profile data**: LinkedIn profile information you authorize us to access
- **Job preferences**: Target roles, locations, salary ranges, excluded companies
- **Resumes and cover letters**: Documents you upload for applications
- **Feedback**: Feedback submissions, survey responses, feature votes

### Information Collected Automatically
- **Usage data**: Pages visited, features used, time spent
- **Device information**: Browser type, operating system, screen resolution
- **Log data**: IP address, timestamps, API request details
- **Cookies**: Session cookies for authentication (see Cookie section)

### Information from Third Parties
- **LinkedIn**: Profile data authorized through OAuth (name, email, profile picture)

## 3. How We Use Your Information

- **Core service**: Match jobs, submit applications, track status
- **Communication**: Send notifications about applications and account activity
- **Improvement**: Analyze usage patterns to improve the Service
- **Security**: Detect and prevent fraud and abuse
- **Legal**: Comply with legal obligations

We do not sell your personal data to third parties.

## 4. Data Storage and Security

- Data stored in encrypted PostgreSQL databases (AWS RDS)
- Sensitive fields encrypted with AES-256-GCM
- All data transmitted over TLS 1.3
- Access restricted to authorized personnel
- Regular security audits and penetration testing
- See [SECURITY.md](./SECURITY.md) for technical details

## 5. Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Account data | Until account deletion |
| Job search data | 90 days |
| Application data | 1 year |
| Usage analytics | 2 years (aggregated) |
| Logs | 90 days |

## 6. Your Rights (GDPR)

You have the right to:
- **Access**: Request a copy of your personal data
- **Rectification**: Correct inaccurate personal data
- **Erasure**: Request deletion of your data ("right to be forgotten")
- **Portability**: Export your data in a machine-readable format
- **Restriction**: Limit how we process your data
- **Objection**: Object to data processing for specific purposes

To exercise these rights, contact privacy@quickhire.ai or use the in-app settings.

## 7. Cookies

We use the following cookies:

| Cookie | Type | Purpose | Duration |
|--------|------|---------|----------|
| session_id | Essential | Authentication | 7 days |
| csrf_token | Essential | Security | Session |
| preferences | Functional | User preferences | 1 year |

We do not use third-party tracking cookies.

## 8. Third-Party Services

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| LinkedIn | Authentication & job data | OAuth tokens |
| AWS | Infrastructure hosting | All data (encrypted) |

## 9. International Transfers

Data may be transferred to and processed in the United States (AWS US regions). We use appropriate safeguards (Standard Contractual Clauses) for international transfers.

## 10. Children's Privacy

The Service is not intended for users under 18 years of age. We do not knowingly collect data from children.

## 11. Changes to This Policy

We will notify you of material changes via email or in-app notification at least 30 days before they take effect.

## 12. Contact

- **Privacy inquiries**: privacy@quickhire.ai
- **Data protection officer**: dpo@quickhire.ai
- **General support**: support@quickhire.ai

---

**Last Updated**: 2026-03-09
