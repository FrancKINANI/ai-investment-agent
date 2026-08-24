# Operator Guide

## Before you begin

Ledgerline is a simulation-first tool. Use it to record a mandate, inspect public token data, and produce reviewable paper artifacts. It does not place trades or connect to a wallet.

## 1. Sign in to your private workspace

The public token viewer works without authentication. Sign in before saving an IPS, starting a paper simulation, creating research records, or reviewing private history. A signed-in owner without an IPS should see **No saved IPS**; this is the expected empty state.

## 2. Create an Investment Policy Statement

Provide a policy name and specify limits in basis points. Add only full Ethereum ERC-20 contract addresses to the approved asset universe.

| Field | Interpretation |
| --- | --- |
| Max concentration | Maximum permitted concentration for a single candidate. |
| Minimum reserve | Minimum amount that remains reserved under the policy. |
| Max transaction | Upper limit for a single paper proposal. |
| Daily mandate | Aggregate daily paper-simulation limit. |
| Approved asset universe | Contracts eligible for inspection as policy candidates. |

The editor rejects an individual transaction limit above the daily mandate and rejects a concentration plus reserve combination above 100%.

## 3. Inspect a public token

Paste an ERC-20 Ethereum contract into **Read-only Ethereum token viewer**. Ledgerline displays sourced metadata, public DEX price/liquidity/volume data when available, the selected DEX identity, fetch time, and whether the result is `live` or `cached`. No wallet data is requested.

## 4. Start a paper simulation

After an IPS has been saved, select **Start policy-bound simulation**. The result is stored as a durable paper run with an operator-history record and an Action-awareness record. It remains simulation-only even if the policy result passes.

## 5. Maintain a research lifecycle

Use **Research records** to create:

| Record | What to capture |
| --- | --- |
| Strategy lineage | A thesis or strategy branch, its stage, generation, and rationale. |
| Hard evaluation | A version, gate result, evidence coverage, complexity penalty, and justification. |
| Outcome review | Expected and realized paper basis points, deviation state, and observation narrative. |

Each record is presented in its corresponding review panel after saving. The panels are private to the authenticated owner.

## 6. Use the history responsibly

The history page is an audit trail, not a performance guarantee. Review source freshness, outcome deviation, policy version, and why a research record was created before acting elsewhere. Ledgerline does not make personal investment recommendations.

## Troubleshooting

| Symptom | Explanation and action |
| --- | --- |
| “No saved IPS” | Expected for a new owner. Sign in and create an IPS. |
| Token view is unavailable | Verify the ERC-20 address; then retry later if Blockscout is temporarily unavailable. |
| Market metric is unavailable | The contract metadata may be valid while no public DEX pair is returned. |
| `cached` freshness label | A recent public-source result was served from the bounded server cache. Retry later for a live refresh. |
| Cannot save a record | Ensure the owner session is authenticated and check the mandatory fields. |
