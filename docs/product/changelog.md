# Changelog

This public changelog records meaningful Ledgerline improvements. It focuses on operator experience, engineering quality, and safety boundaries rather than internal task history.

## Current release — Live execution: Binance trading, KMS encryption, WalletConnect v2, Sailor mandates

Ledgerline now supports real execution through encrypted CEX API keys and non-custodial on-chain mandates.

**Binance live trading:** Real-time account balances, 24h ticker data, and order placement (MARKET/LIMIT, BUY/SELL) through the Platforms page. Orders are validated against active mandate limits before submission. All orders are logged to the immutable Activity record with alerts for fills and rejections.

**AES-256-GCM KMS:** API secrets are now encrypted with AES-256-GCM using random IVs and auth tags. The master key is derived from `ENCRYPTION_KEY` env var via scrypt. The base64 placeholder has been replaced. Tamper detection rejects corrupted data.

**WalletConnect v2:** On-chain wallet connection via WalletConnect v2. Supported chains: Ethereum, Polygon, Arbitrum, Optimism, Base. Session management with connect/disconnect and transaction signing flow. The agent never sees private keys.

**Sailor Protocol mandates:** Non-custodial on-chain mandate contracts. Mandates define scopes (swap, liquidity, stake, claim, transfer), per-transaction and daily value caps, and token/protocol allowlists. Owner signs mandates with their wallet. Revocation is immediate and on-chain.

**Agent execution pipeline:** Agents can now execute through two paths — CEX (Binance API) and on-chain (Sailor via WalletConnect). Both paths require active mandates, enforce value caps, and log everything to the immutable Activity record.

**Safety maintained:** No private keys stored. AES-256-GCM encryption for all secrets. WalletConnect handles signing. Sailor mandates define scope and limits. All operations audit-logged with alerts.

## Previous release — Real-mode foundation: wallet connection, API keys, security alerts

**Wallet connection:** WalletConnect/injected provider support with address display, network info, and disconnect. Mode management: Simulation → Paper → Live with confirmation dialog.

**Platform API keys:** Full CRUD for exchange keys with encrypted storage, permission warnings, per-platform limits, test/disable/delete.

**Security alerts:** Dedicated alerts page with critical/warning/info levels, persistent badge, acknowledge/resolve.

**New data layer:** `securityAlerts` and `platformApiKeys` tables. Extended `operatorActions` enum. `securityRouter` tRPC router.

## Earlier releases

**Performance and public experience:** Lazy-loaded routes, stable chunks, prefetch on intent, theme support, changelog route.

**Simulation-first operating workspace:** Command, Chat, Wallets, Connections, Settings, Activity workspaces. No-custody, no-credential, no-signing boundary.

**Open-source readiness:** MIT license, contributor/security/engineering documentation, CI validation.
