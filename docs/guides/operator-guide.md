# Operator Guide

Ledgerline is designed for deliberate operator control. Its workflows are evidence-led, owner-scoped, and simulation-only.

## Command

Create a bounded watchlist, set the evidence standard, and inspect a public Ethereum contract through the Evidence Lab. Watchlist and evidence outputs may create a paper proposal, but neither action connects an account or executes an order. The proposal queue exposes explicit owner approval, rejection, and simulated settlement states.

## Chat

Use the dedicated supervisor conversation for a concrete research brief. The Bull and Bear views make disagreement legible; the Fund Manager review records a bounded synthesis. Confidence labels describe note completeness, not expected return or a forecast. The composer supports a newline with Enter and a send action with Command/Control+Enter.

## Wallets and Connections

Wallet screens describe purpose and mandate state. The Wallets page now supports wallet connection through WalletConnect and injected providers. Connected address, network, and provider info are displayed. Disconnect is immediate and logged.

Mode management introduces a three-tier progression: Simulation (default) → Paper → Live. Each step requires owner approval and is logged. Live mode activation is intentional, logged, and reversible. The mode selector is visual and requires explicit confirmation before enabling live mode.

Connections declare intended capability and revocation expectations. No screen accepts a private key, a seed phrase, a venue secret, or a signing request.

## Platforms and API Keys

The Platforms page manages exchange API keys (Binance, OKX, Coinbase, Kraken, Polymarket). Each key has a label, masked prefix, permissions, and per-platform limits.

**Adding a key:** Enter the API key and secret. The secret is encrypted at rest and never shown in full after initial entry. Select permissions (trading-only recommended). Withdrawal permissions trigger a critical security alert and are strongly discouraged.

**Managing keys:** Test connection, disable, or delete keys. Disabling a key prevents it from being used but preserves the record. Deletion is permanent and requires confirmation.

**Per-platform limits:** Set max order size (USD), allocated capital (USD), and daily trade limit per key. These limits are enforced at the configuration level and logged to the immutable Activity record.

**Security warnings:** Keys with withdrawal permissions generate a critical alert. The alert is visible in the topbar badge, the Security Alerts page, and the Activity log.

## Security Alerts

The Security Alerts page surfaces critical, warning, and info-level events. A persistent badge in the topbar and sidebar shows unacknowledged alert counts.

**Alert levels:**
- **Critical:** Transaction failures, unexpected mandate revocation, permission violations, limit breaches, withdrawal permission enabled.
- **Warning:** Unusual activity, overly broad permissions detected, connection issues, high latency.
- **Info:** Mode changes, new mandate created, wallet connected, key added/removed, connection test passed.

**Acknowledging alerts:** Click "Acknowledge" to mark an alert as resolved. Acknowledged alerts move to the Resolved section. All alerts are structured, timestamped, and linked to the Decision Journal when relevant.

## Settings and Activity

Settings exposes protected model routes, optional read-only specialists, inactive discovery schedules, and browser-local owner preferences. The Activity page is the durable review surface; "Mark all as read" only changes the owner browser's local read marker and never edits the immutable event record.

## Interpreting loading states

Skeletons indicate a request is pending. Empty states indicate no record was returned. Errors are separate from both. This distinction prevents an operator from mistaking delayed data for a safe policy, a disconnected venue, or a completed simulation.
