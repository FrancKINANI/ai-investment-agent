# Ledgerline MVP Design Direction

## Three candidate approaches

### Theme Name: Ledgerline Command Center
Very brief intro: A quiet, editorial operations interface that treats portfolio state like a living ledger: warm paper, strong ink, measured green signals, and visible provenance. The emotional intent is calm control rather than excitement.
Probability: 0.07

### Theme Name: Signal Room
Very brief intro: A dark, high-contrast monitoring room with restrained chart colors and bright alert states. The emotional intent is vigilance and fast anomaly recognition.
Probability: 0.03

### Theme Name: Field Notes
Very brief intro: A tactile research notebook interface with modular evidence cards, annotations, and a more human review rhythm. The emotional intent is curiosity, reflection, and disciplined learning.
Probability: 0.08

## Selected approach: Ledgerline Command Center

### Design Movement
Contemporary editorial brutalism softened by Swiss information design and archival financial ledgers. The interface should feel like an instrument panel built by a careful operator, not a generic SaaS dashboard.

### Core Principles
1. Make policy, status, and provenance visible at the point of action.
2. Prefer asymmetric composition and strong alignment lines over centered marketing layouts.
3. Use restrained color to distinguish healthy, review-needed, paused, and blocked states.
4. Let whitespace and material texture communicate confidence and patience.

### Color Philosophy
Warm ivory is the working surface: it makes the product feel deliberate and readable over long review sessions. Ink black is used for structure and high-confidence hierarchy. Ledger green means an action or state is within policy; burnt amber means human review or uncertainty; muted red is reserved for hard stops. The signature brand color is **ledger green #487A61**, chosen to feel like an annotation in a long-lived investment journal rather than a trading terminal flash.

### Layout Paradigm
A persistent left rail anchors the product like a physical binder spine. The main workspace uses an offset two-column composition: a wide operational canvas for portfolio and policy state, and a narrower evidence rail for recent decisions and system health. Major sections are organized by horizontal rules, datum labels, and staggered cards rather than uniform rounded grids.

### Signature Elements
- A vertical green ledger spine that marks the active navigation state and important policy boundaries.
- Small uppercase datum labels with monospaced metadata, used for timestamps, policy versions, and simulation IDs.
- Thin contour-line textures and annotation dots that connect the visual language to monitoring and audit trails.

### Interaction Philosophy
Every interaction should make the system’s state more explicit. Buttons use plain-language outcomes such as “Run simulation” and “Review policy,” not vague growth language. Destructive or irreversible concepts are not visually glamorized; in this MVP, live execution is visibly disabled and routes to a clear explanation.

### Animation
Use short, quiet transitions under 240ms for navigation, filters, and state changes. New evidence rows should enter with a small opacity/translate transition, never a bouncing effect. The “simulation complete” state may use a single restrained green pulse. Respect reduced-motion preferences and never animate numerical values in a way that implies certainty.

### Typography System
Use Fraunces for large display headings and section titles, paired with IBM Plex Sans for body copy and controls. Use IBM Plex Mono for IDs, timestamps, policy versions, and quantitative metadata. Headlines should be slightly condensed by scale and generous line-height; body text should stay compact and highly legible.

### Brand Essence
Ledgerline is a simulation-first command center for a careful owner who wants AI-assisted investing without surrendering policy control or auditability. Personality: **measured, inspectable, quietly ambitious**.

### Brand Voice
Headlines are concise and operational. CTAs describe the next safe action. Microcopy explains why a state exists and what evidence supports it.

Example lines:
- “Run the next paper cycle.”
- “No live orders. Every decision remains inside the simulator.”

### Wordmark & Logo
The mark is a vertical ledger spine with a single ascending notch, rendered as a compact geometric symbol. The wordmark uses Fraunces with a slightly tight tracking treatment; it should never be replaced by a default system font logo.

### Signature Brand Color
Ledger green: `#487A61`.

## Style Decisions
- Use warm ivory, graphite, ledger green, and burnt amber as the primary visual system.
- Keep live execution visibly disabled in the MVP.
- Favor asymmetric operational layouts over centered dashboard compositions.
- Use generated visual assets only where they reinforce the evidence and audit themes.
