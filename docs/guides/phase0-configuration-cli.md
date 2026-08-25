# Safe Phase 0 Configuration and CLI

Ledgerline’s Phase 0 configuration makes the current **simulation-only** posture inspectable without converting configuration into financial authority. The YAML documents under `config/` are versioned project configuration: they are not a secret store, connection profile, credential vault, or execution recipe.

> **Phase 0 boundary:** all declared MCP servers are disabled and declarative only. The CLI never launches a local command, contacts an MCP endpoint, stores a token, signs a message, connects a wallet, or sends a market order.

## Configuration layout

| File | Purpose | Write authority in Phase 0 |
| --- | --- | --- |
| `config/default.yaml` | Safe global flags, owner-journal and lineage settings, execution boundary | Maintainer-reviewed file change only |
| `config/system.yaml` | Named safe profile and override policy | Maintainer-reviewed file change only |
| `config/capabilities/research-sources.yaml` | Static public-evidence declarations linked to registered safe capabilities | Maintainer-reviewed file change only |
| `config/capabilities/mcp-servers.yaml` | Future-integration declarations such as Sailor and Binance Agent OS | Disabled, connection-free, and read-only |
| `config/bindings/protected-roles.yaml` | Role-to-capability mapping for protected TradingAgents roles | Validated before a maintainer review |

The server validates schema versions, fixed safe flags, public-source capability references, disabled MCP state, `not-configured` transports, declarative-only registration, and each protected-role binding’s scope fit. A configuration that attempts to enable CEX execution, live execution, or MCP activation is rejected.

## Inspection-only commands

Run the CLI from the repository root through pnpm.

```bash
pnpm ledgerline config validate
pnpm ledgerline config show
pnpm ledgerline config show capabilities
pnpm ledgerline capabilities list
pnpm ledgerline capabilities list --type mcp_server
pnpm ledgerline capabilities list --agent risk_guardians
pnpm ledgerline bindings show
pnpm ledgerline bindings show risk_guardians
pnpm ledgerline mcp list
```

All commands print read-only JSON. The command intentionally refuses unsupported mutating verbs such as `mcp add`, `mcp enable`, `bind`, `unbind`, `flags enable`, `venues enable`, or any execution command.

## Safe evolution path

Use the Settings **YAML configuration contract** card to inspect the same validated summary in the operator workspace. Use the staged Binding Editor to check an intended manifest binding; it creates an immutable review record but does not alter the active registry.

Adding an external MCP, venue, credential, remote endpoint, local command, signer, or execution adapter requires a separate written security and product review. It is not a Phase 0 configuration change.
