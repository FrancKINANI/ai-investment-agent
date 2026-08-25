# Changelog

This public changelog records meaningful Ledgerline improvements. It focuses on operator experience, engineering quality, and simulation-first safety boundaries rather than internal task history.

## Current release — Real-mode foundation: wallet connection, API keys, security alerts

Ledgerline adds the UI and data-layer foundation for real-mode capabilities while preserving the simulation-first safety boundary.

**Wallet connection:** The Wallets page now supports wallet connection through WalletConnect and injected providers. Connected address, network, and provider info are displayed. Disconnect is immediate and logged. Mode management introduces a three-tier progression: Simulation (default) → Paper → Live. Live mode requires explicit owner confirmation, is logged to the immutable Activity record, and is reversible.

**Platform API keys:** A new Platforms & API Keys page provides full CRUD for exchange API keys (Binance, OKX, Coinbase, Kraken, Polymarket). Keys are stored encrypted with the secret never shown after initial entry. Permission warnings flag withdrawal access as a security risk. Per-platform limits (max order size, allocated capital, daily trade limit) are configurable. Every key operation—add, test, disable, delete—is logged to the immutable Activity record.

**Security alerts:** A dedicated Security Alerts page surfaces critical, warning, and info-level events. A persistent badge in the topbar and sidebar shows unacknowledged alert counts. Alerts cover transaction failures, permission violations, limit breaches, connection issues, mode changes, and key operations. All alerts are structured, timestamped, and linked to the Decision Journal when relevant. Operators can acknowledge and resolve alerts.

**New data layer:** Two new database tables (`securityAlerts`, `platformApiKeys`) extend the schema. The `operatorActions` kind enum gains entries for platform key, wallet, mode, and alert operations. A new `securityRouter` tRPC router provides alerts and platforms sub-routers.

**Safety maintained:** No private keys are stored. Withdrawal permissions trigger critical alerts. Live mode is blocked by default and requires explicit confirmation. Encrypted secret storage uses a placeholder (real KMS integration marked with `ponytail:` comments). All actions are logged to the immutable Activity record. No execution paths are added.

## Previous release — Performance and public experience

Ledgerline now lazy-loads workspace routes and splits shared framework, data, UI, motion, icon, and vendor code into stable chunks. Primary navigation and public entry links prefetch the selected route on pointer or keyboard intent. A top loading indicator appears while an uncached lazy route is resolving.

The welcome screen supports light, dark, and follow-system theme preferences before sign-in. A public changelog route, improved README, release screenshots, GitHub community links, and an open-source demo dataset policy support the project's eventual public release.

## Foundation — Simulation-first operating workspace

Ledgerline includes Command, Chat, Wallets, Connections, Settings, and Activity workspaces for bounded research and paper proposals. It maintains an explicit no-custody, no-credential, no-signing, and no-live-execution boundary. The real-mandate path remains server-blocked.

## Foundation — Open-source readiness

The repository is MIT licensed and includes contributor, security, environment, engineering, release, roadmap, and demo-data documentation. CI validates tests, TypeScript, and production builds. The connected GitHub repository remains private until the owner changes its visibility.
