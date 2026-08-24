# Agent Workspace Information Architecture

## Visual system

Ledgerline will use a **blue intelligence canvas** rather than the previous green operations palette. Both themes use the same hierarchy and interaction states.

| Token | Dark mode | Light mode | Use |
| --- | --- | --- | --- |
| Canvas | Ink / midnight blue | Ice / near-white | Primary application background |
| Surface | Layered navy | White | Panels, chat, forms, and tables |
| Primary | Electric blue | Royal blue | Primary actions, active agent state, and focus |
| Evidence | Cyan | Deep cyan | Source-bound research and read-only capability |
| Review | Amber | Amber | Owner review and unresolved uncertainty |
| Blocked | Rose | Rose | Policy, risk, and execution blocks |

The theme selector sits in global chrome and persists the owner’s choice. Contrast and focus states must remain legible in both modes.

## Command Center

The command center is split into four operational surfaces.

| Surface | Owner experience | Persistence |
| --- | --- | --- |
| Supervisor chat | The owner converses with the supervisor, sees the selected agent delegation plan, and receives a source-bound answer. | Conversation turns and resulting agent evolution records. |
| Fabric evolution | A live, chronological graph/timeline shows which protected and optional agents ran, their assigned task, model, source status, conclusion, uncertainty, and outcome. | Awareness/evolution records. |
| Watchlist cockpit | Owners add or remove monitored assets and set the discovery scope; candidates carry source freshness and policy state. | Owner watchlist records and discovery findings. |
| Proposal queue | Fund-manager-gated paper proposals retain their existing approval/rejection/settlement lifecycle. | Proposal and operator-action records. |

## Settings

Settings becomes four real configuration panels rather than a summary.

| Panel | Controls |
| --- | --- |
| Agent fabric | Model route per protected role, status, tools, protected marker, and optional subagent capacity. |
| Supervisor subagents | Add, pause, and retire optional subagents; every action is logged. Protected roles never show a delete action. |
| Watchlists & discovery | Watchlist scope, daily deep discovery or six-hour signal scanner choice, disabled/active state, last run, and next run. |
| Constitution & authority | Existing IPS, wallet mandates, venue state, and global pause controls. |

## Schedule activation

The discovery configuration can be saved before deployment. The activation control remains disabled with an explanation until the site is deployed. Once deployed, enabling a schedule invokes the owner-scoped scheduler and persists its task identifier. The scheduled endpoint produces evolution records and simulation candidates only.
