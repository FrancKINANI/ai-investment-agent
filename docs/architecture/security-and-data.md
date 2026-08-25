# Security and Data Boundaries

Ledgerline's core product rule is simple: **authority expands more slowly than observability**.

## Prohibited capabilities

The application must not accept, retain, reveal, or derive wallet seed phrases, private keys, or custody control. The agent never holds private keys — all signing happens via WalletConnect or Sailor Protocol mandates.

## Permitted capabilities

Ledgerline may read public evidence, persist owner-scoped policy and research records, create simulation-only proposal states, record immutable activity, render capability boundaries, manage encrypted platform API keys, surface security alerts, connect wallets via WalletConnect v2, execute on-chain transactions via Sailor mandates, and trade on CEXs via encrypted API keys.

## KMS — Key Management Service

Platform API secrets are encrypted at rest using AES-256-GCM:

- **Algorithm:** AES-256-GCM with random 12-byte IV and 16-byte auth tag
- **Key derivation:** Master key from `ENCRYPTION_KEY` env var (64-char hex or passphrase → scrypt)
- **Format:** base64(iv + authTag + ciphertext)
- **Tamper detection:** Auth tag verification rejects corrupted data
- **Dev fallback:** When `ENCRYPTION_KEY` is unset, a development key is used with a console warning

Production deployments must set `ENCRYPTION_KEY` to a 64-character hex string or a strong passphrase. For cloud deployments, replace with a dedicated KMS (AWS KMS, GCP KMS, HashiCorp Vault).

## WalletConnect v2 — On-chain Wallet Connection

Wallet connection uses WalletConnect v2 for secure, non-custodial wallet linking:

- **Session flow:** Owner scans QR code → wallet approves → session stored server-side
- **Supported chains:** Ethereum, Polygon, Arbitrum, Optimism, Base
- **Security:** Private keys never leave the wallet. The agent only receives the address and chain.
- **Transaction signing:** Transaction requests go through WalletConnect → wallet signs → agent broadcasts
- **Revocation:** Owner can disconnect any session immediately

The agent can read balances and request transaction signatures, but cannot sign transactions itself.

## Sailor Protocol — Non-custodial Mandates

Sailor Protocol provides on-chain mandate contracts that define what the agent can do:

- **Mandate scopes:** swap, add_liquidity, remove_liquidity, stake, claim, transfer
- **Value caps:** Per-transaction and daily limits enforced on-chain
- **Token/protocol allowlists:** Mandates can restrict which tokens and protocols are used
- **Activation:** Owner signs the mandate contract with their wallet via WalletConnect
- **Revocation:** Owner can revoke any mandate at any time. Revocation is immediate and on-chain.

The agent can only execute transactions within the active mandate's scope and limits. Every execution attempt is validated against the mandate before submission.

## API key security

Platform API keys are stored with the following protections:

- **Encrypted secrets:** API secrets are encrypted with AES-256-GCM via the KMS module.
- **Masked prefixes:** Only the first 4 and last 4 characters of the API key are stored for identification. The full key is never retrievable after initial entry.
- **Permission warnings:** Keys with withdrawal permissions trigger a critical security alert.
- **Per-platform limits:** Max order size, allocated capital, and daily trade limits are configurable per key.

## Agent execution pipeline

Agents (Bull, Bear, Supervisor, Trader) can execute through two paths:

### CEX execution (Binance)
1. Agent proposes a trade based on research
2. Live adapter validates against active mandate limits
3. Order submitted via Binance REST API with HMAC-SHA256 signing
4. Result logged to Activity record with alert

### On-chain execution (Sailor)
1. Agent proposes a swap/stake/liquidity action
2. Live adapter validates against Sailor mandate scope and value caps
3. Transaction sent via WalletConnect for owner signature
4. Owner signs in their wallet → transaction broadcast
5. Result logged to Activity record with alert

Both paths enforce:
- Active mandate required (real or armed mode)
- Order/value caps checked against mandate limits
- All attempts logged to immutable Activity record
- Critical alerts for fills, rejections, and revocations

## Data discipline

Owner-scoped records use the authenticated identity supplied by the server context. Browser-local preferences contain display, density, and shortcut choices only. The read marker for Activity is browser-local and must never modify source event data.

## UI truthfulness

Never fabricate balances, venue connections, fills, ratings, testimonials, agent actions, or market evidence. Loading skeletons must communicate pending data, while empty and error states must remain explicit.

## Owner security signals

The Activity workspace projects **only actual immutable owner-scoped records** into security signals. The Security Alerts page provides a dedicated surface for security-relevant events. Both alerts and Activity entries are owner-scoped and immutable.
