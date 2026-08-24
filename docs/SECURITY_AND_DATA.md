# Security and Data Boundaries

## Security posture

Ledgerline’s security model is defined by **authority reduction**, not by a promise that an AI model is infallible. The current product has no live execution path, no wallet integration, and no signing flow. Its core aim is to make the path from an owner’s policy to a paper record inspectable and constrained.

| Security invariant | Enforcement point |
| --- | --- |
| Only authenticated owners can write private records. | `protectedProcedure` procedures and owner-scoped database queries. |
| No live execution is accessible. | No wallet, exchange, signer, or execution adapter is implemented. |
| IPS limits are validated deterministically. | Shared Zod schema with concentration/reserve and transaction/daily-mandate checks. |
| No synthetic public metric is shown as fact. | External data is sourced live/cached or rendered unavailable. |
| External calls do not originate from the browser. | Server-side on-chain adapter. |
| History is owner-scoped. | Each durable record carries `userId`; list queries filter by it. |

## Scope model

The public data viewer declares exactly two read-only scopes.

| Scope | Meaning | Available now |
| --- | --- | --- |
| `chain.read` | Read public Ethereum ERC-20 metadata and explorer-level figures. | Yes |
| `market.read` | Read public DEX pair metrics. | Yes |
| `portfolio.read` | Read a personal wallet or portfolio. | No |
| `proposal.write` | Write a proposal artifact. | Reserved for a future bounded agent feature. |
| `execution.request` | Request a real transaction. | **No** |

The on-chain viewer does not ask for a wallet address, private key, signature, exchange credential, or approval transaction.

## Public data source behavior

Blockscout supplies Ethereum token metadata and explorer figures. DexScreener supplies DEX pool metrics. Both are public-source dependencies and should be treated as best-effort data, not as an authoritative valuation service.[1] [2]

| Condition | Current product behavior |
| --- | --- |
| Explorer source unavailable | Reject the token view and show an unavailable error. |
| DEX source unavailable | Show valid token metadata but render market metrics unavailable. |
| Several DEX pools returned | Select the pool with the highest reported USD liquidity and show its DEX identity. |
| Missing value | Render `Unavailable`; never substitute a demo metric. |
| Repeated lookup of the same contract | Return a bounded 30-second server-side cache result and label it `cached`. |

The adapter is intentionally on-demand and bounded to 50 cache entries per server instance. That is appropriate for a low-volume personal control plane; it is not a high-availability market-data service. DexScreener documents a 300-requests-per-minute limit for the token-pair endpoint family used by the application.[2]

## Data handling and privacy

Private ownership, policy, simulation, research, and review records reside in the project database. External public token queries are not persisted for anonymous users. For an authenticated owner, a successful token view may become an operator action record. The browser never receives server-side data-provider credentials because the MVP uses public endpoints, and future secrets must remain server-side.

## Extension controls

Before adding a wallet, an exchange, Binance Agent OS, MCP tools, or a paid data provider, the implementation must add a capability-specific server adapter, a documented revocation mechanism, explicit owner authorization, an audit event, policy evaluation before action, and a new threat review. Do not add credentials, private keys, or unscoped tools to the frontend.

## References

[1] [Blockscout API documentation](https://docs.blockscout.com/devs/apis)

[2] [DexScreener API reference](https://docs.dexscreener.com/api/reference)
