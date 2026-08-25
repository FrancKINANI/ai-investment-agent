# PAIA v0.4 Foundation

Ledgerline adopts the **PAIA v0.4** direction as a configuration-driven personal investment research operating system. This implementation starts with the safe foundation rather than with execution: an owner-defined IPS governs a protected agent fabric, a capability registry describes permitted research tools, and the append-only journals preserve action, justification, outcome, and evolutionary awareness.

> **Current implementation phase:** configuration, research, evaluation, and paper simulation. Ledgerline does not accept private keys, exchange credentials, signing authority, withdrawal permissions, or live order instructions.

## Current Architecture Mapping

| PAIA concept | Ledgerline implementation | Current boundary |
|---|---|---|
| Policy before intelligence | Owner-scoped IPS, deterministic proposal checks, mandate limits | Simulation and read-only modes only |
| Specialized agents | Protected TradingAgents roles plus bounded optional specialists | Models are configurable; scopes remain safe |
| Capability Registry | Validated JSON manifest with versioned capabilities and role bindings | No active MCP servers or execution adapters |
| Four awareness layers | Action, justification, result, and evolutionary records | Journaled owner and simulation events only |
| Strategy lineage and hard gates | Versioned lineage, evaluations, outcomes, and promotion gates | Promotion stops before real execution |
| Supervisor | Delegates and summarizes bounded research | Cannot change permissions or execute actions |

## Capability Registry

The manifest at `shared/capabilityManifest.json` is deliberately narrow. It describes capabilities through a stable identifier, version, type, tags, safe scopes, state, and explicit role bindings. Startup validation rejects malformed references, duplicate identifiers, unknown binding targets, and any scope outside the research and paper-proposal allowlist.

The initial registry contains public market evidence, public on-chain evidence, a simulated portfolio snapshot, and a paper-proposal composer. It currently registers **zero MCP capabilities**. A future MCP integration must go through a separate security review, be explicitly bound to a role, remain owner-visible, record capability identifiers and versions in the journal, and preserve the execution seal.

## Planned Progression

| Stage | Safe deliverable | Go/no-go condition |
|---|---|---|
| Foundation | Validated registry, protected roles, IPS, audit records | No execution authority exists |
| Research maturity | More evidence adapters and lineage evaluation | Evidence quality and policy review pass |
| Simulation maturity | Richer paper outcomes and supervised variation | Hard evaluation gates pass |
| Integration review | Separate review for constrained external integrations | Independent security, product, and owner approval |

The PAIA proposal references on-chain and CEX execution concepts. These remain **explicitly excluded** from Ledgerline’s current scope. Any future consideration requires a new written architecture review and cannot be enabled by a configuration edit alone.

## Configuration Contract

The registry is configuration data, not a credential store. Secrets remain environment-only and never enter JSON manifests, owner preferences, logs, or activity records. Editing a manifest can alter only declared safe capabilities and bindings after validation; it cannot grant custody, signing, live execution, or credential access.
