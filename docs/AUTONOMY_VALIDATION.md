# Autonomous Operating System Validation

**Validated build:** multi-page autonomous operating-system redesign with simulated mandates, venue adapters, proposal lifecycle, and append-only audit events.

## Automated validation

The project test suite passed with **9 test files and 38 tests**. The TypeScript check and production build also passed after the autonomy data models and route changes.

| Surface | Evidence verified |
| --- | --- |
| Research → proposal | A protected research request creates an agent run, `agentProposals` record, `proposal_created` audit event, and justification awareness record. |
| Simulation mandate | The authenticated owner can create a persisted simulation-only trading or investment mandate; creation writes a `mandate_created` event. |
| Venue adapter | The authenticated owner can register a persisted simulated Binance, EVM, or Polymarket adapter; registration writes a `venue_configured` event and no credentials are stored. |
| Approval branch | A policy-passing proposal in review can be approved for simulation only; its approval writes `proposal_approved`. |
| Rejection branch | A reviewed proposal can be rejected; `proposal_rejected` is ordered after proposal creation and settlement is refused afterwards. |
| Simulated settlement | Only an approved proposal may settle; settlement writes `simulation_settled` plus result awareness. |
| Real-mode block | The `setMandateMode` procedure rejects a request for `real` mode because no verified live adapter, arming ceremony, or execution gateway exists. |
| General regression suite | Existing policy, research, on-chain aggregation/cache, owner persistence, and frontend rendering tests continue to pass. |

## Visual validation

Desktop screenshots verified the following routes: Command Center, Wallets & Mandates, Connections, Agent & Policy, and Activity Log. The visible product contains no fabricated account balance, fill, venue connection, or live execution state. Disconnected and simulation-only status are explicit.

Mobile screenshots verified all five workspaces at 390 px width: Command Center, Wallets & Mandates, Connections, Agent & Policy, and Activity Log. Navigation collapses to a compact top bar; command, wallet, venue, configuration, and activity content remain vertically readable without horizontal overflow in the checked views.

## Deferred owner-session check

An end-to-end owner-browser pass remains **deferred by the owner’s earlier Cloudflare-login constraint**. When the session is available, the owner should perform this specific test:

1. Save an IPS with at least one approved asset.
2. Enable a simulated venue adapter and create each wallet mandate.
3. Run an evidence-bound token research cycle using an approved contract.
4. Approve one proposal, settle it in the simulated adapter, and verify the ordered events in Activity Log.
5. Run a second research cycle, reject its proposal, and verify the simulator refuses settlement.
6. Attempt to select `real` mode and verify it remains blocked with no credential, signing, order, or transaction surface.

This deferral does **not** mean that a live adapter is ready. Ledgerline remains a simulation-only product until the execution-readiness gates in [Autonomy and Execution Contract](AUTONOMY_AND_EXECUTION_CONTRACT.md) are independently completed.
