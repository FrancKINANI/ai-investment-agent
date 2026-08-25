# Security Policy

## Supported posture

Ledgerline is maintained as a **simulation-first** application with optional live execution capabilities. The core security posture includes:

- **No private keys stored:** All signing happens via WalletConnect v2 or Sailor Protocol mandates
- **Encrypted secrets:** API keys encrypted with AES-256-GCM (KMS module)
- **Mandate-based execution:** All trades require active mandates with scope and value caps
- **Immutable audit trail:** Every action logged to owner-scoped Activity record
- **Security alerts:** Critical/warning/info levels with persistent badge and acknowledge/resolve
- **Rate limiting:** Sliding window per userId + IP
- **Input sanitization:** Dangerous characters stripped, length limits enforced
- **Error classification:** Internal details never exposed to users

## Security features

### KMS — Key Management Service

- AES-256-GCM encryption with random IVs and auth tags
- Master key derived from `ENCRYPTION_KEY` env var via scrypt
- Tamper detection rejects corrupted data
- Production must use 64-char hex key or strong passphrase

### WalletConnect v2

- Non-custodial wallet connection
- Private keys never leave the wallet
- Session management with immediate disconnect
- Multi-chain support (Ethereum, Polygon, Arbitrum, Optimism, Base)

### Sailor Protocol Mandates

- Scope-based authority (swap, liquidity, stake, claim, transfer)
- Per-transaction and daily value caps
- Token/protocol allowlists
- Immediate revocation

### Rate Limiting

- 60 requests/minute default per user/IP
- 10r/s for API endpoints, 5r/s for auth
- HTTP 429 with Retry-After header

### Input Sanitization

- Dangerous characters: `<>'"&;(){}/\` stripped
- Length limit: 1000 characters
- Recursive object sanitization
- Schema-based validation with Zod

### Error Handling

- Validation errors: 400
- Auth errors: 403 (audit logged)
- Not found: 404
- Rate limit: 429
- External service: 502
- Internal: 500 (audit logged, no details exposed)

### Security Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, credential exposure, authentication bypass, data-isolation failure, or execution-boundary weakness. Contact the repository maintainer privately through the contact method listed in the repository profile and provide a minimal reproduction, affected version, impact, and any suggested mitigation. Do not include secrets or personal data in the report.

## What to report

Report owner-data leakage, authentication or authorization errors, unsafe storage behavior, secret exposure, policy-bypass paths, schedule activation flaws, dependency vulnerabilities with a credible impact, or UI behavior that falsely implies a live connection or execution.

Also report:
- KMS weaknesses (key derivation, encryption/decryption issues)
- WalletConnect session vulnerabilities
- Sailor mandate bypasses
- Rate limiting bypasses
- Input sanitization escapes
- Error information leakage
- Monitoring data exposure
- CI/CD pipeline vulnerabilities
- Docker security issues

## Public disclosures

Please allow maintainers reasonable time to validate and remediate a report before public disclosure. The project should acknowledge good-faith reports when the reporter permits attribution.

## Security checklist for contributors

When submitting a pull request that touches security-relevant code:

- [ ] No secrets, API keys, or credentials committed
- [ ] Input validation added for new user inputs
- [ ] Error messages don't leak internal details
- [ ] New endpoints have rate limiting
- [ ] Audit logging added for security-relevant actions
- [ ] Tests cover security boundaries
- [ ] Documentation updated for security changes
