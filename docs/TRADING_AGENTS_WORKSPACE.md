# TradingAgents Workspace

## Purpose

Ledgerline now provides a **chat-first, simulation-only multi-agent workspace** inspired by the TradingAgents role topology. The owner talks to a Supervisor, sees protected specialists and their real working-note events, configures model routes, maintains a bounded discovery universe, and reviews immutable activity records.

The workspace is an operating and research environment. It is not an autonomous live-trading system. No wallet key, exchange credential, signing interface, or execution endpoint is exposed.

## Protected hierarchy and optional extensions

The Supervisor and the following TradingAgents-inspired roles are created per owner as protected nodes: Fundamental Analyst, Sentiment Analyst, Technical Analyst, News Analyst, Bull Researcher, Bear Researcher, Trader, Risk Guardians, and Fund Manager. Protected nodes cannot be deleted. Each has an owner-configurable **provider and model route**. Updating a route is recorded as an immutable operator action and does not change the node’s tool scope or authority.

The Supervisor may create bounded optional subagents below an active parent node. Every optional node has a parent, an explicit model route, read-only/simulation-safe tool scopes, and an evolution record. Owners may retire optional nodes; protected nodes remain intact.

## Supervisor chat and evolution

An authenticated owner message creates or continues a persisted conversation thread. The runtime supplies recent thread history to each delegated specialist, stores each specialist’s source-limited working note, then asks the Supervisor to synthesize only the thread and those notes. The visible evolution feed is therefore backed by persisted **delegated**, **completed**, **blocked**, **created**, and **retired** events, not a decorative animation.

Specialist output deliberately names uncertainty when no factual evidence is supplied. It does not claim live market retrieval, give personalized investment advice, request credentials, or recommend a live order. A separate evidence-bound ERC-20 research flow remains available for public Blockscout and DexScreener evidence.

## Watchlists and discovery

Watchlists bound where future discovery may look. Owners create named lists, add labels and optional Ethereum contract addresses, select a `strict` or `balanced` evidence standard, and evaluate candidate state against the saved IPS.

| Item condition | Persisted state | Meaning |
| --- | --- | --- |
| Valid contract included in the IPS approved universe | `candidate` | May proceed to research and paper-proposal review; not an order. |
| No saved IPS or no contract address | `review` | More owner policy or identifying evidence is required. |
| Contract outside the IPS approved universe | `blocked` | Discovery may record the item, but it cannot advance. |

## Scheduled discovery lifecycle

Two schedules can be configured: a daily deep-discovery job and a six-hour signal scanner. Both are **stored inactive by default**. A development preview cannot activate either job. After deployment, the authenticated owner must separately activate an individual schedule; this provisions an authenticated scheduler callback and stores the task identifier in the owner’s schedule record. The owner can pause it at any time.

The callback is cron-authenticated, validates that its scheduler task is known and enabled, applies the owner IPS, reads only public Blockscout and DexScreener token data where a contract exists, and writes a source-bound finding plus an immutable audit event. Finding identifiers are deterministic per schedule/item/cadence window, making callback retries idempotent. The callback cannot create a wallet connection, sign a transaction, request a live order, or move a mandate into real mode.

## Themes and validation

The blue visual system supports persistent dark and light modes from the global navigation control. Both visual treatments were checked across Command, Agent & Policy, Wallets & Mandates, Connections, and Activity Log; command and configuration layouts were also checked at a 390 px mobile viewport. A rendered DOM test clicks the shipped `DashboardLayout` theme control, confirming that it changes the root theme class and persists the owner preference.

Automated verification at this milestone: **14 test files / 50 tests**, `pnpm check`, and `pnpm build` all passed. Browser validation of private owner mutations and deployed scheduler activation remains dependent on an authenticated owner session and a published deployment, respectively.
