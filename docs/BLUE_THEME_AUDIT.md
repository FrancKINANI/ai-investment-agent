# Blue Theme Audit

Ledgerline retains older stylesheet blocks for backward compatibility with prior workspace iterations. The active autonomous-OS routes are explicitly overridden by the current `--ll-*` design tokens. General operating state uses **blue or cyan**; red and amber are retained only when they communicate a blocking or review condition.

| Active route | Active selector coverage | Operating accent | Validation evidence |
| --- | --- | --- | --- |
| Command | `.command-page-next`, `.command-hero-next`, `.chat-workbench`, `.watchlist-cockpit`, `.evidence-lab`, `.proposal-panel` | `--ll-blue`, `--ll-cyan` | Desktop capture and global theme-toggle tests. |
| Chat | `.solo-chat-page`, `.solo-chat-shell`, `.chat-filter-group`, `.chat-message`, `.fund-manager-summary`, `.chat-evolution-timeline` | `--ll-blue`, `--ll-cyan`; red remains Bear-risk semantics | Desktop and 390 px capture; rendered dark-to-light mounting test. |
| Wallets | `.wallet-role`, `.wallet-glyph`, `.mode-control`, `.mode-choice` | `--ll-blue` | Desktop and 390 px capture; rendered dark-to-light mounting test. |
| Connections | `.connection-card`, `.connection-icon`, `.scope-chips`, `.connection-warning` | `--ll-blue`, `--ll-cyan` | Desktop capture after scope-chip override. |
| Agent & Policy | `.settings-next`, `.settings-card`, `.model-route-row`, `.cadence-options` | `--ll-blue`, `--ll-cyan` | Desktop capture and shared token toggle coverage. |
| Activity | `.activity-log`, `.log-list`, `.activity-contract`, `.activity-search` | `--ll-blue`, `--ll-cyan` | Desktop capture and shared token toggle coverage. |

The root semantic variables are aligned with the same palette for both themes so standard buttons, inputs, focus rings, and legacy component fallbacks do not inherit the retired mint primary color. This audit does not reinterpret **warning**, **blocked**, or **Bear-case** cues as general branding; those deliberately retain their semantic colors and text labels.

> Theme coverage validates that the shipped toggle changes the document’s dark-mode class and preserves the Chat and Wallets structures in both modes. Route-level audit assertions also cover all six active workspace selector groups and their blue/cyan tokens. The public captures show light mode; owner-session message creation and deployed schedule activation remain separately deferred.
