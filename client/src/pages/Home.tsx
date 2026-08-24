/*
 * Ledgerline Agent Fabric — AI-native/Web3-oriented command center.
 * The interface exposes model and tool choices while preserving a hard policy-to-execution boundary.
 */
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDotDashed,
  Command,
  Cpu,
  Database,
  FileCheck2,
  FlaskConical,
  Globe2,
  Hexagon,
  Layers3,
  LockKeyhole,
  Network,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const logoUrl = "/manus-storage/ledger-logo_5877e9f6.png";

type AgentState = "active" | "review" | "paused";

const baseAgents: Array<{ id: string; name: string; role: string; provider: string; model: string; state: AgentState; icon: typeof BrainCircuit; scopes: string[] }> = [
  { id: "research", name: "Atlas", role: "Research synthesis", provider: "OpenAI", model: "gpt-5-mini", state: "active", icon: BrainCircuit, scopes: ["market.read", "proposal.write"] },
  { id: "onchain", name: "Nexus", role: "On-chain observer", provider: "Google", model: "gemini-3-flash-preview", state: "active", icon: Hexagon, scopes: ["chain.read", "portfolio.read"] },
  { id: "risk", name: "Sentinel", role: "Risk adjudication", provider: "Anthropic", model: "claude-sonnet-4-6", state: "review", icon: ShieldCheck, scopes: ["portfolio.read", "policy.veto"] },
  { id: "supervisor", name: "Orion", role: "Trajectory supervisor", provider: "Provider-agnostic", model: "rules + review", state: "active", icon: CircleDotDashed, scopes: ["evidence.read", "proposal.hold"] },
];

const initialEvents = [
  { time: "10:24:18", title: "Sentinel held a candidate", detail: "Protocol-health variance requires an evidence review.", tone: "review" },
  { time: "10:23:04", title: "Atlas refreshed thesis map", detail: "3 source clusters normalized into a paper proposal.", tone: "pass" },
  { time: "10:21:55", title: "Nexus observed chain state", detail: "Read-only observation complete. No wallet authority present.", tone: "pass" },
];

function StateTag({ state }: { state: AgentState }) {
  return <span className={`agent-state state-${state}`}><span />{state}</span>;
}

function Node({ label, sublabel, active = false, icon: Icon }: { label: string; sublabel: string; active?: boolean; icon: typeof Bot }) {
  return <div className={`loop-node ${active ? "loop-node-active" : ""}`}><div className="loop-icon"><Icon size={16} /></div><div><strong>{label}</strong><span>{sublabel}</span></div></div>;
}

export default function Home() {
  const catalogQuery = trpc.agentRuntime.catalog.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [activeSection, setActiveSection] = useState("Mission control");
  const [selectedAgent, setSelectedAgent] = useState("risk");
  const [paused, setPaused] = useState(false);
  const [runCount, setRunCount] = useState(28);
  const [events, setEvents] = useState(initialEvents);

  const agents = useMemo(() => baseAgents.map((agent) => agent.id === selectedAgent ? { ...agent, selected: true } : { ...agent, selected: false }), [selectedAgent]);
  const modelFamilies = catalogQuery.data?.providers ?? [
    { id: "openai", label: "OpenAI", models: ["gpt-5-mini", "gpt-5"] },
    { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6"] },
    { id: "google", label: "Google", models: ["gemini-3-flash-preview"] },
    { id: "custom", label: "MCP / custom", models: ["bring-your-own-agent"] },
  ];

  const runCycle = () => {
    if (paused) {
      toast.error("Runtime paused", { description: "Resume the agent fabric before a paper cycle can start." });
      return;
    }
    const next = runCount + 1;
    setRunCount(next);
    setEvents((items) => [{ time: "Now", title: `Supervised paper cycle AVO-${String(next).padStart(3, "0")}`, detail: "Observe → hypothesize → simulate → evaluate completed. Execution capability remained sealed.", tone: "pass" }, ...items]);
    toast.success("Paper cycle completed", { description: `AVO-${String(next).padStart(3, "0")} produced an inspectable simulation record.` });
  };

  const requestExecution = () => {
    setEvents((items) => [{ time: "Now", title: "Execution request rejected", detail: "The simulation-first runtime never grants execution.request to an AI agent.", tone: "block" }, ...items]);
    toast.error("Hard block enforced", { description: "Live execution is not an available capability in this workspace." });
  };

  const navItems = [
    { label: "Mission control", icon: Command },
    { label: "Agent mesh", icon: Network },
    { label: "Tool scopes", icon: Layers3 },
    { label: "Evidence ledger", icon: FileCheck2 },
  ];

  return (
    <div className="fabric-shell">
      <aside className="fabric-sidebar">
        <div className="fabric-brand"><div className="fabric-mark"><img src={logoUrl} alt="Ledgerline" /></div><div><strong>ledgerline</strong><span>agent fabric</span></div></div>
        <div className="network-status"><span className="status-ring"><Radio size={12} /></span><div><span>runtime online</span><strong>SIMULATION / EVM</strong></div></div>
        <div className="sidebar-label">Control surface</div>
        <nav className="fabric-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveSection(label)} className={activeSection === label ? "fabric-nav-active" : ""}><Icon size={16} /><span>{label}</span>{activeSection === label && <ChevronRight size={15} />}</button>)}</nav>
        <div className="sidebar-spacer" />
        <div className="sealed-block"><LockKeyhole size={15} /><div><strong>Execution sealed</strong><span>No wallet signature path</span></div></div>
        <button className="sidebar-foot" onClick={() => toast.message("Configuration is currently local and simulation-only.")}><Sparkles size={15} /> Runtime configuration</button>
      </aside>

      <main className="fabric-main">
        <header className="fabric-topbar"><div className="trail"><span>ledgerline</span><ChevronRight size={13} /><strong>{activeSection}</strong></div><div className="topbar-badges"><span className="chain-badge"><Globe2 size={13} /> EVM / read-only</span><span className="proof-badge"><span /> policy hash verified</span><Button variant="outline" size="sm" onClick={() => catalogQuery.refetch()}><RefreshCw size={13} /> Sync catalog</Button></div></header>

        <div className="fabric-content">
          <section className="fabric-hero">
            <div className="orbit-backdrop"><span className="orbit o1" /><span className="orbit o2" /><span className="orbit o3" /><span className="orbit-dot d1" /><span className="orbit-dot d2" /><span className="orbit-dot d3" /></div>
            <div className="hero-signal"><div className="hero-kicker"><Zap size={13} /> PROVIDER-AGNOSTIC AGENT RUNTIME · AVO-{String(runCount).padStart(3, "0")}</div><h1>Intelligence that<br /><em>stays provable.</em></h1><p>Choose the strongest current model for each specialist role. The fabric preserves memory, evaluates evidence, and lets a deterministic policy layer veto every candidate.</p><div className="hero-buttons"><Button className="run-button" onClick={runCycle}><Play size={15} fill="currentColor" /> Run supervised paper cycle</Button><Button variant="ghost" className="evidence-button" onClick={() => setActiveSection("Evidence ledger")}><FileCheck2 size={15} /> Inspect evidence</Button></div></div>
            <div className="hero-metrics"><div><span>Agent roles</span><strong>04</strong><small>specialized</small></div><div><span>Tool authority</span><strong>00</strong><small>execution scopes</small></div><div><span>Model families</span><strong>{String(modelFamilies.length).padStart(2, "0")}</strong><small>routable</small></div></div>
          </section>

          <section className="runtime-strip"><div><span className={`runtime-dot ${paused ? "runtime-paused" : ""}`} />{paused ? "Operator pause active" : "Supervisor monitoring trajectory"}</div><span className="strip-sep" /><div>Persistent state <strong>evidence-led</strong></div><span className="strip-sep" /><div>Execution <strong className="blocked-copy">hard-disabled</strong></div><button onClick={() => setPaused((value) => !value)}>{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? "Resume fabric" : "Pause fabric"}</button></section>

          <div className="fabric-grid">
            <section className="fabric-panel mesh-panel"><div className="panel-cap"><div><span>Multi-agent topology</span><h2>Supervised reasoning loop</h2></div><div className="avo-label">AVO PATTERN <ArrowUpRight size={13} /></div></div><div className="reasoning-loop"><Node label="Observe" sublabel="chain + market" active icon={Activity} /><div className="loop-link" /><Node label="Hypothesize" sublabel="specialists" active icon={BrainCircuit} /><div className="loop-link" /><Node label="Simulate" sublabel="paper only" icon={FlaskConical} /><div className="loop-link" /><Node label="Evaluate" sublabel="policy gate" active icon={ShieldCheck} /></div><div className="supervisor-line"><CircleDotDashed size={16} /><span><strong>Orion</strong> monitors stagnation, divergent evidence, and repeated failure modes.</span><span className="supervisor-state">active</span></div></section>

            <section className="fabric-panel policy-panel"><div className="panel-cap"><div><span>Non-negotiable boundary</span><h2>Policy before intelligence</h2></div><ShieldAlert className="policy-icon" size={20} /></div><div className="policy-stack"><div><span className="policy-number">01</span><p>Agents may observe, reason, and write proposals.</p><Check size={15} /></div><div><span className="policy-number">02</span><p>Risk and policy checks may hold or block a candidate.</p><Check size={15} /></div><div className="policy-hard"><span className="policy-number">03</span><p>AI agents cannot receive an <code>execution.request</code> scope.</p><XCircle size={16} /></div></div><button className="block-test" onClick={requestExecution}>Test execution boundary <LockKeyhole size={14} /></button></section>
          </div>

          <section className="fabric-panel agent-panel"><div className="panel-cap"><div><span>Role routing</span><h2>Agent mesh</h2></div><div className="catalog-status"><span className={catalogQuery.isFetching ? "catalog-pulse" : "catalog-pulse catalog-ready"} />{catalogQuery.isFetching ? "syncing current catalog" : "current model catalog available"}</div></div><div className="agent-grid">{agents.map((agent) => { const Icon = agent.icon; return <button key={agent.id} className={`agent-card ${agent.selected ? "agent-selected" : ""}`} onClick={() => setSelectedAgent(agent.id)}><div className="agent-card-top"><div className="agent-identity"><div className="agent-icon"><Icon size={18} /></div><div><strong>{agent.name}</strong><span>{agent.role}</span></div></div><StateTag state={agent.state} /></div><div className="agent-model"><span>{agent.provider}</span><strong>{agent.model}</strong></div><div className="scope-row">{agent.scopes.map((scope) => <span key={scope}>{scope}</span>)}</div></button>; })}</div></section>

          <div className="fabric-grid lower-grid">
            <section className="fabric-panel provider-panel"><div className="panel-cap"><div><span>Model plane</span><h2>Current provider families</h2></div><Cpu size={19} className="muted-icon" /></div><div className="provider-list">{modelFamilies.map((family) => <div className="provider-row" key={family.id}><div className={`provider-glyph glyph-${family.id}`}><Bot size={15} /></div><div><strong>{family.label}</strong><span>{family.models.slice(0, 2).join(" · ")}</span></div><span className="provider-route">routable <ChevronRight size={14} /></span></div>)}</div><div className="provider-note"><Database size={14} /> Model selection is a role-level routing decision. Secrets never enter the browser.</div></section>

            <section className="fabric-panel event-panel"><div className="panel-cap"><div><span>Evidence ledger</span><h2>Latest runtime events</h2></div><Button variant="ghost" size="sm" onClick={() => setActiveSection("Evidence ledger")}>Full trace <ArrowUpRight size={13} /></Button></div><div className="event-list">{events.slice(0, 4).map((event, index) => <div className="event-row" key={`${event.title}-${index}`}><span className={`event-dot event-${event.tone}`} /><span className="event-time">{event.time}</span><div><strong>{event.title}</strong><p>{event.detail}</p></div></div>)}</div></section>
          </div>

          <section className="fabric-panel account-panel"><div className="panel-cap"><div><span>Web3 account context · simulated</span><h2>Read-only mandate envelope</h2></div><span className="account-proof"><span /> no signing authority</span></div><div className="account-grid"><div className="account-identity"><div className="account-avatar"><Wallet size={19} /></div><div><strong>Research subaccount</strong><span>0x7D3A···19F2 · simulated identity</span></div></div><div className="account-stat"><span>Network</span><strong>Ethereum / EVM</strong><small>read-only chain adapter</small></div><div className="account-stat"><span>Authority</span><strong>Observe + propose</strong><small>execution.request omitted</small></div><div className="account-stat"><span>Paper context</span><strong>$100,842 NAV</strong><small>42% stablecoin reserve</small></div></div></section>

          <section className="web3-band"><div className="web3-symbol"><Wallet size={20} /></div><div><span>Web3 readiness, without premature custody</span><h3>Read the chain. Simulate the intent. Keep authority revocable.</h3><p>Future MCP or exchange adapters belong behind dedicated, permissioned tool boundaries. No Binance, wallet, or exchange connector is active in this workspace.</p></div><Button variant="outline" onClick={() => toast.message("No external connector is configured", { description: "A future MCP adapter must be user-authorized, capability-scoped, and revocable." })}>View connector posture <ChevronRight size={15} /></Button></section>

          <footer className="fabric-footer"><span>LEDGERLINE AGENT FABRIC / BUILD 0.2.0</span><span>SIMULATION-FIRST · POLICY-ENFORCED · EXECUTION-SEALED</span></footer>
        </div>
      </main>
    </div>
  );
}
