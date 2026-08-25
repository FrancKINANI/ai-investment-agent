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
pnpm ledgerline doctor
```

All commands print read-only JSON. `pnpm ledgerline doctor` summarizes YAML parsing, the simulation-only boundary, disabled authority flags, declarative MCP posture, static research sources, and protected bindings. It does not open a network connection, invoke an MCP server, mutate configuration, or grant authority. The command intentionally refuses unsupported mutating verbs such as `mcp add`, `mcp enable`, `bind`, `unbind`, `flags enable`, `venues enable`, or any execution command.

## Binding-change approval workflow

The Settings workflow keeps an intended binding separate from the active runtime manifest:

| Step | Record | Effect |
| --- | --- | --- |
| 1. Validate | A staged candidate is checked against the registry, protected roles, safe scope, and simulation boundary. | Invalid drafts are blocked; valid drafts remain non-active. |
| 2. Submit | The owner supplies a rationale of at least 12 characters and a `pending` request is stored. | An immutable activity event records provenance, rationale, and the candidate. |
| 3. Review | An administrator records an approval or rejection with a review note of at least 8 characters. | The decision is journaled; no runtime capability is activated. |
| 4. Apply later | A maintainer may prepare a separately reviewed manifest change. | This is outside Phase 0 and requires another validation cycle. |

An approved request is evidence of governance review, **not** execution authority, an active MCP binding, a secret, a signer, a venue connection, or a live order permission.

## Safe evolution path

Use the Settings **YAML configuration contract** card to inspect the same validated summary in the operator workspace. Use the staged Binding Editor to check an intended manifest binding; it creates an immutable review record but does not alter the active registry.

Adding an external MCP, venue, credential, remote endpoint, local command, signer, or execution adapter requires a separate written security and product review. It is not a Phase 0 configuration change.
