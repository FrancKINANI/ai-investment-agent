<div align="center">

# 🏗️ Ledgerline Architecture

**A private, owner-controlled multi-agent investment research workspace**

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Phase](https://img.shields.io/badge/phase-research%20%26%20simulation-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D24-orange)

---

*Observability grows before authority. The product explains what the team knows and why, without claiming it can move real capital.*

</div>

## 🎯 Overview

Ledgerline is an **AI investment operating system** for research, review, and simulation. It helps an owner operate a specialist research team, maintain visible evidence trails, and review paper decisions.

| Aspect | Status |
|--------|--------|
| **Real Capital** | 🚫 **NO-GO** — Compile-time sealed |
| **Research & Simulation** | ✅ Active |
| **Agent Memory** | ✅ Active (shared + private scopes) |
| **Live Venue Mutation** | 🔒 Sealed (`LIVE_VENUE_MUTATIONS_SEALED = true`) |

---

## 🏠 Application Routes

| Route | Purpose | Description |
|-------|---------|-------------|
| `/` | **Mission Control** | Research desk, current work, tasks, decision attention, policy/account posture, audit trace |
| `/chat` | **Agent Room** | Supervisor and specialist conversations with inspectable shared/private context |
| `/tasks` | **Tasks** | Current, completed, and blocked owner-scoped agent work |
| `/decisions` | **Decision Desk** | Paper-proposal review and policy context |
| `/portfolio` | **Portfolio** | Truthful account, connection, and policy posture |
| `/activity` | **Activity** | Immutable owner-scoped activity and security signals |
| `/settings` | **Configure** | Models, protected roles, specialists, policy, schedules, preferences |

---

## 🧩 System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        MC[Mission Control]
        AR[Agent Room]
        TK[Tasks]
        DD[Decision Desk]
        PF[Portfolio]
        AC[Activity]
        CF[Configure]
    end

    subgraph API["🔌 API Layer"]
        TRPC[tRPC + React Query]
    end

    subgraph Server["⚙️ Server Layer"]
        AF[Agent Fabric Router]
        AM[Agent Memory Router]
        PL[Policy Router]
        RV[Research Router]
        HR[History Router]
        LR[Live Router]
    end

    subgraph Services["🔧 Service Layer"]
        PRO[Protected Roles]
        MEM[Memory Store]
        IPS[IPS Store]
        EVID[Evidence Adapters]
    end

    subgraph Database["🗄️ Database Layer"]
        DRIZZLE[Drizzle ORM]
        DB[(MySQL/TiDB)]
    end

    MC & AR & TK & DD & PF & AC & CF --> TRPC
    TRPC --> AF & AM & PL & RV & HR & LR
    AF --> PRO
    AM --> MEM
    PL --> IPS
    RV --> EVID
    AF & AM & PL & RV & HR & LR --> DRIZZLE
    DRIZZLE --> DB

    style Client fill:#e3f2fd,stroke:#1976d2
    style API fill:#fce4ec,stroke:#c62828
    style Server fill:#fff3e0,stroke:#f57c00
    style Services fill:#f3e5f5,stroke:#7b1fa2
    style Database fill:#e8f5e9,stroke:#388e3c
```

---

## 🤖 Agent Architecture

### Protected TradingAgents Roles

Server-defined roles that cannot be removed from the interface:

| Role Type | Description | Memory Access |
|-----------|-------------|---------------|
| **Supervisor** | Coordinates specialist roles | Shared context |
| **Research Specialists** | Focused research conversations | Shared + Private |
| **Execution Roles** | ⚠️ **Excluded from conversations** | ❌ No access |

### Context Assembly Flow

```mermaid
flowchart TD
    A[Authenticated Owner] --> B[Select Active Research Agent]
    B --> C[Server-Derived Bounded Context]
    
    C --> D[Policy Context]
    C --> E[Active Shared Memory]
    C --> F[Active Private Memory]
    C --> G[Recent Messages]
    
    D & E & F & G --> H[Model Response]
    H --> I[Labelled as Research Context]
    I --> J[Owner-Scoped Records]
    
    style A fill:#e3f2fd,stroke:#1976d2
    style J fill:#e8f5e9,stroke:#388e3c
```

---

## 💾 Memory System

### Scopes

| Scope | Intended Content | Visibility |
|-------|------------------|------------|
| **Shared** | Owner-approved constraints, verified facts, evidence references, team decisions | Eligible research agents for same owner |
| **Private** | Specialist working notes, focused questions, role-specific constraints | Selected specialist + owner only |

### Promotion Workflow

```mermaid
flowchart TD
    A[Private Note Active] --> B[Owner Requests Promotion]
    B --> C[Pending Promotion]
    C --> D{Administrator Review}
    D -->|Approve| E[Shared Active]
    D -->|Reject| F[Private Active]
    
    E --> G[Cleared Agent Target]
    E --> H[Increment Revision]
    E --> I[Audit Action]
    
    F --> J[Retained Agent Target]
    F --> K[Increment Revision]
    F --> L[Audit Action]
    
    style A fill:#fff3e0,stroke:#f57c00
    style E fill:#e8f5e9,stroke:#388e3c
    style F fill:#ffebee,stroke:#c62828
```

### Memory Tables

| Table | Purpose |
|-------|---------|
| `agentIndividualConversations` | Focused individual conversations |
| `agentMemoryEntries` | Shared and private memory entries |
| `agentMemoryActions` | Promotion and lifecycle audit trail |

---

## 🔒 Security Boundaries

### Compile-Time Sealed Boundary

```typescript
LIVE_VENUE_MUTATIONS_SEALED = true  // Cannot be lifted by config
```

### What's Sealed

| Capability | Status | Enforcement |
|------------|--------|-------------|
| Wallet Signing | 🚫 Sealed | Compile-time |
| On-Chain Action | 🚫 Sealed | Compile-time |
| Custody | 🚫 Sealed | Compile-time |
| Withdrawal | 🚫 Sealed | Compile-time |
| Binance Orders | 🚫 Sealed | Service boundary |
| MCP Activation | 🚫 Sealed | Manager rejects |

### Owner Scope

All data is owner-scoped:
- Conversations, tasks, activity, memory entries, memory actions
- Individual threads belong to both owner AND selected agent
- Private memory filtered to exact agent ID (no broadening)

### Secret Handling

- Memory screened for private-key blocks, mnemonics, credentials
- Model prompt explicitly denies authority to override policy
- Stored memory = **untrusted reference material**

---

## 🛠️ Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **tRPC** | Type-safe API layer |
| **TanStack Query** | Server state management |
| **Tailwind CSS** | Styling |
| **Radix UI** | Accessible components |
| **Framer Motion** | Animations |
| **wouter** | Routing |

### Backend

| Technology | Purpose |
|------------|---------|
| **Express 5** | HTTP server |
| **tRPC** | Type-safe RPC |
| **Drizzle ORM** | Database access |
| **MySQL/TiDB** | Database |
| **jose** | JWT handling |
| **Zod** | Schema validation |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Nginx** | Reverse proxy |
| **Prometheus** | Metrics |
| **Grafana** | Dashboards |
| **GitHub Actions** | CI/CD |

---

## 📊 Data Flow

### Request Processing Flow

```mermaid
flowchart TD
    A[Owner Action] --> B[Authenticated Request]
    B --> C[JWT + Owner Scope Validation]
    C --> D[Policy Check IPS]
    D --> E{Allowed?}
    E -->|Yes| F[Agent Context Assembly]
    E -->|No| G[Access Denied]
    
    F --> H[Policy Context]
    F --> I[Shared Memory]
    F --> J[Private Memory]
    F --> K[Thread History]
    
    H & I & J & K --> L[Model Response]
    L --> M[Labelled as Research Context]
    M --> N[Immutable Activity Record]
    N --> O[Owner-Scoped Storage]
    
    style A fill:#e3f2fd,stroke:#1976d2
    style G fill:#ffebee,stroke:#c62828
    style O fill:#e8f5e9,stroke:#388e3c
```

### Memory Promotion Flow

```mermaid
flowchart LR
    subgraph Private["🔒 Private Scope"]
        P1[Private Note]
    end
    
    subgraph Promotion["📤 Promotion Request"]
        PR[Owner Request]
    end
    
    subgraph Review["👁️ Admin Review"]
        AR{Decision}
    end
    
    subgraph Shared["🌐 Shared Scope"]
        S1[Shared Note]
    end
    
    P1 --> PR
    PR --> AR
    AR -->|Approve| S1
    AR -->|Reject| P1
    
    style Private fill:#fff3e0,stroke:#f57c00
    style Shared fill:#e8f5e9,stroke:#388e3c
```

### Security Boundary Flow

```mermaid
flowchart TD
    A[Incoming Request] --> B{Request Type}
    
    B -->|Research| C[Policy Check]
    B -->|Memory| D[Scope Validation]
    B -->|Live Mutation| E[🚨 SEALED]
    
    C --> F[Execute Research]
    D --> G[Memory Operation]
    E --> H[❌ REJECTED]
    
    F --> I[Immutable Record]
    G --> I
    
    style E fill:#ffebee,stroke:#c62828
    style H fill:#ffebee,stroke:#c62828
    style I fill:#e8f5e9,stroke:#388e3c
```

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose | Scope |
|-------|---------|-------|
| `users` | Owner accounts | Owner |
| `agents` | TradingAgents roles | Owner |
| `conversations` | Agent conversations | Owner |
| `messages` | Conversation messages | Owner + Agent |
| `agentIndividualConversations` | Focused individual conversations | Owner + Agent |
| `agentMemoryEntries` | Shared and private memory | Owner + Scope |
| `agentMemoryActions` | Memory lifecycle audit | Owner |
| `policies` | Investment Policy Statements | Owner |
| `tasks` | Agent work items | Owner |
| `decisions` | Paper proposals | Owner |
| `activity` | Immutable activity trail | Owner |

### Migration Strategy

- Additive migrations only (no destructive changes)
- Target environment must be explicitly named
- No sample data creation as side effect
- Review through branch → PR → staging workflow

---

## 🔧 Development

### Quick Start

```bash
git clone https://github.com/FrancKINANI/ai-investment-agent.git
cd ai-investment-agent
pnpm install --frozen-lockfile
pnpm dev
```

### Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm test` | Run test suite |
| `pnpm check` | TypeScript type check |
| `pnpm build` | Production build |
| `pnpm audit --prod` | Security audit |
| `pnpm drizzle-kit check` | Schema validation |

### Branch Workflow

```mermaid
flowchart LR
    A[feat/* or fix/*] --> B[Pull Request]
    B --> C[Staging]
    C --> D[Green CI]
    D --> E[Separate Approval]
    E --> F[Main]
    
    style A fill:#e3f2fd,stroke:#1976d2
    style F fill:#e8f5e9,stroke:#388e3c
```

---

## 📚 Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [Getting Started](../guides/getting-started.md) | New operators | Run workspace, first research loop |
| [Operator Guide](../guides/operator-guide.md) | Operators | Mission Control, Agent Room, tasks |
| [System Overview](./system-overview.md) | Developers | Routes, services, data scopes |
| [Agent Memory](./agent-memory-workspace.md) | Memory reviewers | Context construction, promotion |
| [Security](./security-and-data.md) | Security reviewers | No-go controls, privacy |
| [Contributing](../../CONTRIBUTING.md) | Contributors | Workflow, safety constraints |

---

## 🚨 Important Notes

> **Real-capital status: NO-GO**
>
> Creating configuration records, changing a feature flag, adding a key, or editing a mandate **cannot** lift the compiled execution seal. A separately authorised unsealing programme is required before any real-capital capability can be considered.

> **Memory is untrusted reference material**
>
> Stored memory is labelled as untrusted in model prompts. It cannot override policy, invoke tools, reveal secrets, or create execution behaviour.

---

<div align="center">

**Built with ❤️ for research-first investing**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/FrancKINANI/ai-investment-agent)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

</div>
