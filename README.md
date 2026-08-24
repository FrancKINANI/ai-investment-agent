# Ledgerline

Ledgerline is a **simulation-first personal investment operations workspace**. It helps an owner define policy, evaluate public evidence, coordinate bounded research agents, and record simulation activity. It is not a live trading product.

> **Safety boundary:** Ledgerline does not store wallet keys, venue credentials, signing authority, custody, live orders, or real execution capability.

## Documentation

| Document | Use it for |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Local setup and the first safe workflow. |
| [Architecture](docs/ARCHITECTURE.md) | Current routes, services, agent runtime, and data flow. |
| [Operator guide](docs/OPERATOR_GUIDE.md) | Day-to-day Command, Chat, Wallets, Connections, Settings, and Activity use. |
| [Security and data](docs/SECURITY_AND_DATA.md) | Non-negotiable safety, authority, and data-handling boundaries. |
| [Engineering and operations](docs/ENGINEERING_AND_OPERATIONS.md) | Tests, release checks, CSS tokens, and maintenance conventions. |
| [Roadmap](docs/ROADMAP.md) | Directional milestones; capability expands more slowly than observability. |

## Current product surface

The **Command** workspace is the research and paper-proposal cockpit. **Chat** is the dedicated supervisor conversation with Bull/Bear/Supervisor filters and a bounded research composer. **Wallets** and **Connections** explain role and venue boundaries without accepting secrets. **Settings** configures policy-adjacent agent model routes, optional read-only specialists, inactive discovery schedules, and local owner preferences. **Activity** records immutable owner-scoped events.

The interface supports blue/cyan light and dark themes, responsive mobile navigation, reduced-motion-safe motion, and accessible loading skeletons. All data-heavy visual states must distinguish loading from an actual empty result.

