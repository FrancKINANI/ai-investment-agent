# Contributing to Ledgerline

Ledgerline welcomes improvements to simulation-first research workflows, accessibility, documentation, tests, and operator experience. Contributions must preserve the project’s strict no-custody, no-credential, and no-live-execution boundaries.

## Local workflow

1. Follow the environment configuration guide and set values only in your local environment or deployment host.
2. Install dependencies with `pnpm install` and start the project with `pnpm dev`.
3. Keep the change focused. Add or update Vitest coverage for behavior changes.
4. Run `pnpm test`, `pnpm check`, and `pnpm build` before opening a pull request.

## Contribution rules

Do not commit secrets, API keys, database URLs, owner data, logs, generated builds, screenshots, seed phrases, wallet keys, venue credentials, or private prompt material. Do not fabricate balances, market data, trades, reviews, or connected venues. A visual change must preserve loading, empty, error, keyboard, dark-theme, and reduced-motion behavior where applicable.

## Demo and fixture data

Read the [demo dataset policy](docs/maintainers/demo-dataset-policy.md) before proposing a fixture, screenshot, story, seed, or example flow. Ledgerline examples must make their synthetic nature obvious, omit customer and account data, and never create a misleading impression of live execution, market truth, connected venues, or actual investment performance.

## Scope boundaries

The project may support public-evidence research, policy checks, paper proposals, simulations, and owner-scoped activity. It must not request or store signing authority, custody material, withdrawal permissions, live venue credentials, or a real order path. Proposals and examples remain explicitly simulation-only.

## Pull requests

Explain the user-visible change, the safety impact, and the validation performed. If a change modifies policy, authority, storage, authentication, or external integration behavior, include the data-flow and rollback implications in the pull request description.
