# PStack and Ponytail Research Notes

> **Status: preliminary compatibility assessment.** These tools are being evaluated as developer-workflow aids, not as wallet, exchange, signing, custody, or live-execution integrations.

## Initial findings

| Tool | Primary-source indication | Ledgerline relevance | Runtime integration decision |
| --- | --- | --- | --- |
| PStack | Cursor’s PStack plugin is a development skill/workflow collection. Its `poteto-mode` routes engineering tasks through investigation, bug-fix, refactoring, verification, and review playbooks. [1] | Its verification-oriented workflow may inform contributor and maintainer practices. | **Do not embed in the Ledgerline application runtime.** |
| Ponytail | Ponytail is a coding-agent skill/plugin with a “minimum necessary code” ladder; it explicitly keeps validation, error handling, security, and accessibility outside the simplification budget. [2] | Its subtract-before-add and boundary-validation themes may inform code-review heuristics. | **Do not embed in the Ledgerline application runtime.** |

Neither source establishes a wallet, exchange, transaction-signing, secret-management, or investment-agent runtime role. Any future adoption should be limited to the **development process**, reviewed as third-party tooling, and isolated from production credentials and deployment authority. In particular, no plugin hook, model-routing rule, or third-party automation should receive Ledgerline production secrets, browser sessions, wallet material, or deployment authority.

## Recommended use

PStack is best evaluated as an optional contributor workflow for structured investigation, review, and verification. Ponytail is best evaluated as an optional review lens for deletion, smallest-correct-change, boundary validation, and preserving error handling. Neither belongs in the deployed web application, agent fabric, CLI runtime, or capability registry. A maintainer can adopt selected principles manually without installing either plugin.

## Sources

[1] [Cursor Plugins — PStack](https://github.com/cursor/plugins/tree/main/pstack)

[2] [DietrichGebert — Ponytail](https://github.com/dietrichgebert/ponytail)
