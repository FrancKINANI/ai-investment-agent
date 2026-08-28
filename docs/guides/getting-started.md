# Getting Started

Ledgerline is a **private research and simulation workspace**. It helps you operate a specialist research team, maintain a visible evidence trail, and review paper decisions. It does not connect wallets, sign transactions, send orders, or move real capital.

## Prerequisites and local run

Use Node.js **24.x LTS**, pnpm, a MySQL-compatible database, and the required OAuth configuration. Keep all credentials and personal data outside the repository.

```bash
git clone https://github.com/FrancKINANI/ai-investment-agent.git
cd ai-investment-agent
pnpm install --frozen-lockfile
pnpm dev
```

Then open `/welcome` for the introduction or `/` for Mission Control. Sign in to access owner-scoped data.

```bash
pnpm test
pnpm check
pnpm build
pnpm audit --prod
pnpm drizzle-kit check
```

## First research workflow

Open **Mission Control** and look first at team posture, the current mission, tasks, decision attention, and audit trace. Open **Agent Room**, choose the Supervisor or a research specialist, and give a concrete question. Treat every result as a research record to check—not a financial recommendation, price forecast, or trade instruction.

When Agent Room storage is available, the memory panel distinguishes **team-shared context** from **private context for the selected specialist**. Create a private note when it should guide only one role. Request sharing only when that note belongs in the team’s common research context; it remains private until an administrator approves the promotion.

Use **Tasks** to examine recorded work, **Decision Desk** to inspect paper-review status, **Portfolio** to view truthful available posture, and **Activity** to review the owner-scoped immutable trail. Empty states mean no matching owner record exists. They never mean an account, balance, connection, policy pass, or execution result was inferred.

## Database changes

Update `drizzle/schema.ts`, generate and review a migration in a branch, and open a pull request. Before application, name the target database explicitly and obtain approval for that environment. Verify table structure without inserting sample data. Do not use a branch name, local preview, or managed project identity as evidence of a database environment.

See the [Operator Guide](operator-guide.md), [System Overview](../architecture/system-overview.md), and [Security and Data Boundaries](../architecture/security-and-data.md) for the complete operating model.
