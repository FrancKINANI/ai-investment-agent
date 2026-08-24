# Changelog

This public changelog records meaningful Ledgerline improvements. It focuses on operator experience, engineering quality, and simulation-first safety boundaries rather than internal task history.

## Current release — Performance and public experience

Ledgerline now lazy-loads workspace routes and splits shared framework, data, UI, motion, icon, and vendor code into stable chunks. Primary navigation and public entry links prefetch the selected route on pointer or keyboard intent. A top loading indicator appears while an uncached lazy route is resolving.

The welcome screen supports light, dark, and follow-system theme preferences before sign-in. A public changelog route, improved README, release screenshots, GitHub community links, and an open-source demo dataset policy support the project’s eventual public release.

## Foundation — Simulation-first operating workspace

Ledgerline includes Command, Chat, Wallets, Connections, Settings, and Activity workspaces for bounded research and paper proposals. It maintains an explicit no-custody, no-credential, no-signing, and no-live-execution boundary. The real-mandate path remains server-blocked.

## Foundation — Open-source readiness

The repository is MIT licensed and includes contributor, security, environment, engineering, release, roadmap, and demo-data documentation. CI validates tests, TypeScript, and production builds. The connected GitHub repository remains private until the owner changes its visibility.
