# Ledgerline

Ledgerline is a **simulation-first personal investment operations workspace**. It helps an owner define policy, evaluate public evidence, coordinate bounded research agents, and record simulation activity. It is not a live trading product.

> **Safety boundary:** Ledgerline does not store wallet keys, venue credentials, signing authority, custody, live orders, or real execution capability.

## Documentation

| Document | Use it for |
| --- | --- |
| [Getting started](docs/guides/getting-started.md) | Local setup and the first safe workflow. |
| [Operator guide](docs/guides/operator-guide.md) | Day-to-day Command, Chat, Wallets, Connections, Settings, and Activity use. |
| [System overview](docs/architecture/system-overview.md) | Current routes, services, agent runtime, and data flow. |
| [Security and data](docs/architecture/security-and-data.md) | Non-negotiable safety, authority, and data-handling boundaries. |
| [Engineering and operations](docs/maintainers/engineering-and-operations.md) | Tests, release checks, CSS tokens, and maintenance conventions. |
| [Open-source release](docs/maintainers/open-source-release.md) | Public-repository hygiene and secure deployment posture. |
| [Roadmap](docs/product/roadmap.md) | Directional milestones; capability expands more slowly than observability. |

## Current product surface

The **Command** workspace is the research and paper-proposal cockpit. **Chat** is the dedicated supervisor conversation with Bull/Bear/Supervisor filters and a bounded research composer. **Wallets** and **Connections** explain role and venue boundaries without accepting secrets. **Settings** configures policy-adjacent agent model routes, optional read-only specialists, inactive discovery schedules, and local owner preferences. **Activity** records immutable owner-scoped events.

The interface supports blue/cyan light and dark themes, responsive mobile navigation, reduced-motion-safe motion, and accessible loading skeletons. All data-heavy visual states must distinguish loading from an actual empty result.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and [SECURITY.md](SECURITY.md) before reporting a vulnerability. Follow the [environment configuration guide](docs/maintainers/environment-configuration.md) and never commit populated credentials.

## Public release note

Ledgerline is distributed under the [MIT License](LICENSE). The connected GitHub repository remains private at the owner’s request; changing visibility is a separate owner-controlled action.
