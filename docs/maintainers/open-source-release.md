# Open-Source Release Guide

Ledgerline is suitable for an open-source release as a **simulation-first research and paper-trading workspace**. The repository must never imply that it can execute live orders or accept sensitive trading credentials.

## Public repository contents

Keep the application source, schema, migrations, tests, package metadata, source-level patches, and the maintained documentation set. The public documentation should explain setup, architecture, operator workflows, security boundaries, engineering practices, and the roadmap.

## Excluded materials

Historical milestone notes, one-off validation reports, sample decision journals, sample lineage JSON, generated build output, logs, local configuration, environment files, editor settings, and internal prompt libraries do not belong in the public repository. These materials are either stale, redundant, generated, environment-specific, or not needed to build and review the software.

## Secure release checks

Before making the repository public, search the complete history and current tree for credentials, URLs with embedded tokens, personal details, private keys, seed phrases, venue API secrets, database URLs, and environment exports. Verify the production build, test suite, licensing, repository metadata, and issue templates. A public release does not authorize live trading, custody, signing, or real execution.

## Release posture

Production deployment should inject secrets only through the host environment. Use the default simulation-only configuration, keep discovery schedules inactive until a documented owner action, and retain the server-side real-mandate block. Contributors should never add secrets, real balances, fabricated trades, or credential handling to fixtures or examples.
