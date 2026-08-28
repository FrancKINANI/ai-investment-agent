# Security and Data Boundaries

Ledgerline’s operating rule is that **authority expands more slowly than observability**. The product may help an authenticated owner inspect research, agent work, policy context, paper proposals, and immutable records. It must fail closed rather than claim access, balances, memory, or execution results that are unavailable.

## Explicit exclusions

The application must not accept, retain, reveal, derive, or use wallet seed phrases, private keys, recovery phrases, signing authority, custody control, withdrawal permissions, real venue mutations, on-chain broadcasts, or autonomous capital deployment. Binance, Sailor, WalletConnect, and MCP mutation paths are not enabled product capabilities.

`LIVE_VENUE_MUTATIONS_SEALED = true` is a compile-time execution boundary. It cannot be lifted by an environment flag, owner preference, API key, mandate, route input, configuration file, or model output. The live adapter guard is evaluated before key decryption, authority reads, mandate reads, or venue I/O.

## Owner scope and agent memory

All conversations, tasks, activity, memory entries, and memory actions are retrieved through authenticated server procedures scoped to the owner ID. An individual thread must belong to both the owner and the selected agent. Private memory is filtered to that exact agent ID; the system does not broaden a missing private match into shared context.

Memory promotion is deliberate. An owner request places a private entry into `pending_promotion` while retaining private scope. Only an administrator may approve or reject the request. Each transition increments the memory revision and writes an append-only memory action. Pending, expired, superseded, and redacted entries are excluded from context assembly.

## Prompt and secret handling

Stored memory is considered untrusted reference material. The model-facing prompt explicitly denies it authority to override policy, invoke tools, reveal secrets, modify configuration, or create execution behaviour. The server screens entries for common private-key blocks, mnemonic/recovery phrases, credential-like values, and cookies before saving them. It also bounds entry length and context count.

The secret screen cannot prove that arbitrary text is safe. Operators must never place real credentials, database URLs, personal information, account material, wallet data, or unredacted confidential documents in a memory entry or chat message.

## Error, audit, and migration controls

External errors must be classified into stable public codes and must not expose raw URLs, signed query strings, response bodies, stack traces, key material, or database details. Owner-relevant actions are recorded with bounded structured metadata. An audit record is not evidence that a transaction, venue account, wallet, or balance exists.

Schema migrations are reviewed on an isolated branch and applied only to a specifically identified environment. They must be verified structurally without seeding demo records. Current memory storage was introduced through the additive `0011_agent_memory_workspace` migration. Future staging and production environments must remain distinct; neither can be assumed from a branch name or a project preview.

## Residual risk

The active product remains a research and simulation workspace. It does not satisfy the conditions for real-capital operation. A future unsealing programme must separately complete security design, infrastructure isolation, secrets management, reconciliation, testing, operational controls, legal review, small-capital pilot governance, and written owner approval before any GO decision.
