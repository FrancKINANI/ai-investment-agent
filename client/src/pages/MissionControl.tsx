import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { agentRoleDescriptions, getAgentMissionState, readableRole, taskBucket } from "@/lib/missionControl";
import { Activity, ArrowRight, Bot, BrainCircuit, CheckCircle2, ClipboardCheck, LockKeyhole, MessagesSquare, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import "../styles/missionControl.css";

function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MissionControl() {
  const { isAuthenticated } = useAuth();
  const navigate = useLocation()[1];
  const agentsQuery = trpc.agentFabric.nodes.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const evolutionQuery = trpc.agentFabric.evolution.useQuery({}, { enabled: isAuthenticated, retry: false });
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const proposalsQuery = trpc.autonomy.proposals.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const connectionsQuery = trpc.autonomy.connections.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });

  const agents = useMemo(() => (agentsQuery.data ?? []).filter((agent) => agent.state !== "retired"), [agentsQuery.data]);
  const evolution = evolutionQuery.data ?? [];
  const taskEvents = useMemo(() => evolution.filter((event) => event.state !== "created" && event.state !== "retired"), [evolution]);
  const activeTasks = useMemo(() => taskEvents.filter((event) => taskBucket(event.state) === "now").slice(0, 4), [taskEvents]);
  const completedTasks = useMemo(() => taskEvents.filter((event) => taskBucket(event.state) === "completed").slice(0, 3), [taskEvents]);
  const blockedTasks = useMemo(() => taskEvents.filter((event) => taskBucket(event.state) === "blocked").slice(0, 2), [taskEvents]);
  const reviewProposals = useMemo(() => (proposalsQuery.data ?? []).filter((proposal) => proposal.status === "review").slice(0, 3), [proposalsQuery.data]);
  const latestActivity = historyQuery.data?.slice(0, 4) ?? [];
  const connections = connectionsQuery.data ?? [];

  return <div className="mission-control-page">
    <section className="mission-hero">
      <div>
        <span className="mission-kicker"><Sparkles size={14} /> MISSION CONTROL</span>
        <h1>Your investment office,<br /><em>in motion.</em></h1>
        <p>See the research team, the work they are doing, and the decisions that need you. Ledgerline keeps every visible action source-aware, policy-bound, and honest about what is not connected.</p>
        <div className="mission-hero-actions"><Button className="mission-primary-action" onClick={() => navigate("/chat")}><MessagesSquare size={16} /> Talk to the supervisor</Button><Button variant="outline" onClick={() => navigate("/tasks")}>Open task board <ArrowRight size={15} /></Button></div>
      </div>
      <aside className="mission-safety-card" aria-label="Execution safety status"><div><LockKeyhole size={17} /><span>OPERATING BOUNDARY</span></div><strong>Simulation · sealed</strong><p>Research and paper review may be recorded. Venue mutations remain unavailable.</p><button type="button" onClick={() => navigate("/portfolio")}>View portfolio posture <ArrowRight size={13} /></button></aside>
    </section>

    <section className="mission-posture-strip" aria-label="Portfolio and research posture">
      <article><span><WalletCards size={15} /> ACCOUNT POSTURE</span><strong>{!isAuthenticated ? "Sign in to view accounts" : connections.length ? `${connections.length} configured ${connections.length === 1 ? "connection" : "connections"}` : "No account connected"}</strong><small>{!isAuthenticated ? "Account posture is owner-scoped and loads only after sign-in." : connections.length ? "Connection records are available in Portfolio. Balances appear only when server-verified." : "Connect a read-only venue when you are ready to view verified account data."}</small></article>
      <article><span><ShieldCheck size={15} /> INVESTMENT POLICY</span><strong>{!isAuthenticated ? "Sign in to view policy" : policyQuery.data ? `${policyQuery.data.name} · v${policyQuery.data.version}` : "No IPS on file"}</strong><small>{!isAuthenticated ? "Policy scope is owner-scoped and loads only after sign-in." : policyQuery.data ? "Research remains subject to the active policy scope." : "Research can continue; advancement remains constrained until an IPS is saved."}</small></article>
      <article><span><BrainCircuit size={15} /> TEAM STATUS</span><strong>{!isAuthenticated ? "Sign in to view team" : agentsQuery.isLoading ? "Loading team…" : `${agents.length} agents available`}</strong><small>{!isAuthenticated ? "Your protected agent roster loads only after sign-in." : activeTasks.length ? `${activeTasks.length} active research ${activeTasks.length === 1 ? "thread" : "threads"} are visible below.` : "No active research task is recorded yet."}</small></article>
    </section>

    {!isAuthenticated ? <section className="mission-auth-card"><LockKeyhole size={21} /><div><strong>Your private investment office is ready.</strong><span>Sign in to load your protected team, conversations, account posture, and immutable activity.</span></div><Button onClick={() => navigate("/chat")}>Sign in to begin</Button></section> : <section className="mission-grid">
      <aside className="mission-panel mission-agent-roster" aria-label="Agent team">
        <header><div><span className="mission-label">AGENT TEAM</span><h2>Your research desk</h2></div><span className="mission-count">{agents.length}</span></header>
        <div className="mission-agent-list">{agentsQuery.isLoading ? <p className="mission-empty">Preparing your protected agent team…</p> : agents.map((agent) => {
          const state = getAgentMissionState(agent.agentId, evolution);
          return <button type="button" key={agent.agentId} className={`mission-agent-row is-${state.label}`} title={agentRoleDescriptions[agent.roleKey] ?? "Open the protected Agent Room context."} onClick={() => navigate("/chat")}><span className="mission-agent-avatar"><Bot size={14} /></span><span><strong>{agent.name}</strong><small>{readableRole(agent.roleKey)}</small></span><i aria-label={state.label} /><em>{state.label}</em></button>;
        })}{!agentsQuery.isLoading && !agents.length && <div className="mission-empty"><Bot size={19} /><strong>No agent team is loaded.</strong><span>Open Agent Room to initialize your protected research roles.</span></div>}</div>
        <footer><span>Each role has a bounded purpose and its own working context.</span><Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>Configure team <ArrowRight size={13} /></Button></footer>
      </aside>

      <section className="mission-panel mission-live-work" aria-label="Current mission work">
        <header><div><span className="mission-label">CURRENT MISSION</span><h2>{activeTasks.length ? "Research is in progress." : "Start a research mission."}</h2></div><Button variant="outline" size="sm" onClick={() => navigate("/chat")}>New brief <ArrowRight size={13} /></Button></header>
        <div className="mission-work-main">{activeTasks.length ? activeTasks.map((event) => <article className="mission-work-item" key={event.eventId}><span className={`mission-state-dot ${event.state}`} /><div><small>{event.agentId ? agents.find((agent) => agent.agentId === event.agentId)?.name ?? "Agent" : "Supervisor"} · {event.state}</small><strong>{event.summary}</strong><p>Recorded {formatTime(event.createdAt)} · evidence and handoffs are available in Agent Room.</p></div><button type="button" onClick={() => navigate("/chat")} aria-label="Open the relevant agent conversation"><ArrowRight size={16} /></button></article>) : <div className="mission-work-empty"><BrainCircuit size={30} /><strong>No active task is recorded.</strong><p>Give the supervisor a concrete question to create a source-bound research brief for the team.</p><Button onClick={() => navigate("/chat")}>Start with the supervisor <ArrowRight size={14} /></Button></div>}</div>
        <div className="mission-evidence-note"><ShieldCheck size={15} /><span><strong>How this stays useful:</strong> Ledgerline shows recorded tasks and source-bound work. It does not fabricate research, balances, confidence, or trade outcomes.</span></div>
      </section>

      <aside className="mission-panel mission-task-rail" aria-label="Tasks and decisions">
        <header><div><span className="mission-label">TASKS & DECISIONS</span><h2>Needs attention</h2></div><Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>All tasks <ArrowRight size={13} /></Button></header>
        <div className="mission-task-section"><span>NOW</span>{activeTasks.length ? activeTasks.slice(0, 2).map((task) => <article key={task.eventId}><i className="working" /><div><strong>{task.summary}</strong><small>{task.agentId ? agents.find((agent) => agent.agentId === task.agentId)?.name ?? "Agent" : "Supervisor"}</small></div></article>) : <p>No active research task.</p>}</div>
        <div className="mission-task-section"><span>WAITING FOR YOU</span>{reviewProposals.length ? reviewProposals.map((proposal) => <article key={proposal.proposalId}><i className="review" /><div><strong>{proposal.title}</strong><small>Paper review · {proposal.venue}</small></div></article>) : <p>No decision is awaiting review.</p>}</div>
        <div className="mission-task-section"><span>BLOCKED</span>{blockedTasks.length ? blockedTasks.map((task) => <article key={task.eventId}><i className="blocked" /><div><strong>{task.summary}</strong><small>Resolve the stated policy or data constraint first.</small></div></article>) : <p>No blocked task is recorded.</p>}</div>
        <footer><Button variant="outline" onClick={() => navigate("/decisions")}>Open decision desk <ClipboardCheck size={14} /></Button></footer>
      </aside>
    </section>}

    <section className="mission-lower-grid">
      <article className="mission-panel mission-completed"><header><div><span className="mission-label">RECENTLY COMPLETED</span><h2>Work with a trail</h2></div><CheckCircle2 size={19} /></header>{!isAuthenticated ? <div className="mission-quiet-empty">Sign in to view completed research and owner actions.</div> : completedTasks.length ? <div>{completedTasks.map((task) => <span key={task.eventId}><i /><strong>{task.summary}</strong><small>{formatTime(task.createdAt)}</small></span>)}</div> : <div className="mission-quiet-empty">Completed research and owner actions will appear here after the first brief.</div>}</article>
      <article className="mission-panel mission-activity"><header><div><span className="mission-label">AUDIT TRACE</span><h2>What changed</h2></div><Button variant="ghost" size="sm" onClick={() => navigate("/activity")}>Activity <ArrowRight size={13} /></Button></header>{!isAuthenticated ? <div className="mission-quiet-empty"><Activity size={17} /> Sign in to view your immutable owner activity.</div> : latestActivity.length ? <div>{latestActivity.map((item) => <span key={item.actionId}><i className={item.status} /><div><strong>{item.subject}</strong><small>{item.detail}</small></div><time>{formatTime(item.createdAt)}</time></span>)}</div> : <div className="mission-quiet-empty"><Activity size={17} /> No immutable owner activity has been recorded yet.</div>}</article>
    </section>

    <section className="mission-next-step"><div><span className="mission-label">ONE CLEAR NEXT STEP</span><strong>{isAuthenticated ? "Ask the supervisor what evidence is missing before a thesis can be reviewed." : "Sign in to initialize your private research workspace."}</strong><p>The supervisor coordinates protected specialists; it does not receive venue authority.</p></div><Button className="mission-primary-action" onClick={() => navigate("/chat")}>{isAuthenticated ? "Open Agent Room" : "Sign in"} <ArrowRight size={15} /></Button></section>
  </div>;
}
