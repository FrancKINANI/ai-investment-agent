/*
 * Ledgerline v0.2 operator console.
 * Every UI action is simulation-only and exposes action, justification, result, or evolutionary state.
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
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { evaluatePromotionGate } from "@shared/agentRuntime";
import { nextPromotionStage, outcomeStatus, type PromotionStage } from "@/lib/workflow";
import { toast } from "sonner";

const logoUrl = "/manus-storage/ledger-logo_5877e9f6.png";
type AgentState = "active" | "review" | "paused";
type Section = "Mission control" | "Agent mesh" | "Tool scopes" | "Evidence ledger";
type EventTone = "pass" | "review" | "block" | "evolution";

const v02Agents: Array<{ id: string; name: string; role: string; provider: string; model: string; state: AgentState; icon: typeof BrainCircuit; scopes: string[]; remit: string }> = [
  { id: "macro", name: "Atlas", role: "Macro / regime", provider: "OpenAI", model: "gpt-5-mini", state: "active", icon: BrainCircuit, scopes: ["market.read", "proposal.write"], remit: "Classifies broad regimes and filters narrative noise before a strategy is considered." },
  { id: "onchain", name: "Nexus", role: "On-chain / fundamentals", provider: "Google", model: "gemini-3-flash-preview", state: "active", icon: Hexagon, scopes: ["chain.read", "portfolio.read"], remit: "Normalizes protocol health, yield, liquidity, and wallet-state evidence." },
  { id: "variation", name: "Forge", role: "Strategy variation", provider: "OpenAI", model: "gpt-5", state: "review", icon: Sparkles, scopes: ["market.read", "proposal.write"], remit: "Proposes versioned research variations; it cannot modify a live policy or mandate." },
  { id: "risk", name: "Sentinel", role: "Risk veto", provider: "Anthropic", model: "claude-sonnet-4-6", state: "review", icon: ShieldCheck, scopes: ["portfolio.read", "policy.veto"], remit: "Runs independent risk scrutiny and may block a candidate without negotiation." },
  { id: "evaluator", name: "Ledger", role: "Hard evaluator", provider: "Google", model: "gemini-3.1-pro-preview", state: "active", icon: Scale, scopes: ["evidence.read", "proposal.write"], remit: "Scores regime coverage, robustness, complexity, and simulation evidence against hard gates." },
  { id: "decision", name: "Vector", role: "Decision synthesis", provider: "Anthropic", model: "claude-haiku-4-5", state: "paused", icon: Target, scopes: ["portfolio.read", "proposal.write"], remit: "Synthesizes a bounded paper proposal only after risk and evaluator evidence are present." },
  { id: "supervisor", name: "Orion", role: "Trajectory supervisor", provider: "Rules + LLM", model: "lineage monitor", state: "active", icon: CircleDotDashed, scopes: ["evidence.read", "proposal.hold"], remit: "Detects stagnation, overfitting, unproductive cycles, and missing regime coverage." },
];

const initialEvents: Array<{ time: string; title: string; detail: string; tone: EventTone; awareness: string }> = [
  { time: "10:24:18", title: "Sentinel held a candidate", detail: "Protocol-health variance exceeds the evidence tolerance and requires owner review.", tone: "review", awareness: "Justification" },
  { time: "10:23:04", title: "Forge registered STRAT-ETH-YIELD v0.3", detail: "A research variation was created from v0.2; no promotion state changed.", tone: "evolution", awareness: "Evolutionary" },
  { time: "10:21:55", title: "Nexus observed chain state", detail: "Read-only observation complete. No wallet authority is present.", tone: "pass", awareness: "Action" },
  { time: "Yesterday", title: "Outcome tracker updated", detail: "Expected yield range remains unverified; attribution review is still open.", tone: "review", awareness: "Result" },
];

const awarenessItems: Array<{ label: string; copy: string; icon: typeof Activity }> = [
  { label: "Action", copy: "What is running now?", icon: Activity },
  { label: "Justification", copy: "Why is it allowed?", icon: FileCheck2 },
  { label: "Result", copy: "Did reality match?", icon: TrendingUp },
  { label: "Evolutionary", copy: "What changed over time?", icon: Sparkles },
];

function StateTag({ state }: { state: AgentState }) { return <span className={`agent-state state-${state}`}><span />{state}</span>; }
function GateTag({ state }: { state: "pass" | "review" | "block" }) { return <span className={`gate-tag gate-${state}`}>{state}</span>; }

function Node({ label, sublabel, active = false, icon: Icon }: { label: string; sublabel: string; active?: boolean; icon: typeof Bot }) {
  return <div className={`loop-node ${active ? "loop-node-active" : ""}`}><div className="loop-icon"><Icon size={16} /></div><div><strong>{label}</strong><span>{sublabel}</span></div></div>;
}

export default function Home() {
  const catalogQuery = trpc.agentRuntime.catalog.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [activeSection, setActiveSection] = useState<Section>("Mission control");
  const [selectedAgent, setSelectedAgent] = useState("risk");
  const [paused, setPaused] = useState(false);
  const [runCount, setRunCount] = useState(29);
  const [events, setEvents] = useState(initialEvents);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [variation, setVariation] = useState("v0.3");
  const [evaluation, setEvaluation] = useState<"pass" | "review" | "block">("review");
  const [toolCheck, setToolCheck] = useState("No scope check run yet.");
  const [promotionStage, setPromotionStage] = useState<PromotionStage>("research");
  const [outcomeRecorded, setOutcomeRecorded] = useState(false);
  const [simulationEvidence, setSimulationEvidence] = useState(false);

  const agents = useMemo(() => v02Agents.map((agent) => agent.id === selectedAgent ? { ...agent, selected: true } : { ...agent, selected: false }), [selectedAgent]);
  const selectedAgentData = agents.find((agent) => agent.id === selectedAgent) ?? agents[0];
  const modelFamilies = catalogQuery.data?.providers ?? [
    { id: "openai", label: "OpenAI", models: ["gpt-5-mini", "gpt-5"] },
    { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6"] },
    { id: "google", label: "Google", models: ["gemini-3-flash-preview"] },
    { id: "custom", label: "MCP / custom", models: ["bring-your-own-agent"] },
  ];
  const gate = evaluatePromotionGate({ policyResult: "pass", simulationPassed: simulationEvidence, ownerPauseActive: paused, lineageCoverage: simulationEvidence ? 0.82 : 0.62, complexityPenalty: 0.18 });

  const navigate = (section: Section, anchor: string) => {
    setActiveSection(section);
    window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const addEvent = (event: { title: string; detail: string; tone: EventTone; awareness: string }) => setEvents((items) => [{ time: "Now", ...event }, ...items]);
  const runCycle = () => {
    if (paused) return toast.error("Runtime paused", { description: "Resume the agent fabric before a paper cycle can start." });
    const next = runCount + 1;
    setRunCount(next);
    addEvent({ title: `Supervised paper cycle AVO-${String(next).padStart(3, "0")}`, detail: "Observe → reason → evaluate → record completed. The execution boundary remained sealed.", tone: "pass", awareness: "Action" });
    toast.success("Paper cycle recorded", { description: `AVO-${String(next).padStart(3, "0")} appears in the evidence ledger.` });
  };
  const togglePause = () => {
    setPaused((value) => !value);
    addEvent({ title: paused ? "Owner resumed the fabric" : "Owner pause engaged", detail: paused ? "Paper proposals may be evaluated again." : "All promotion and paper-cycle actions are now blocked.", tone: paused ? "pass" : "block", awareness: "Action" });
  };
  const syncCatalog = async () => {
    await catalogQuery.refetch();
    toast.success("Model catalog refreshed", { description: "Provider families were re-read server-side; no provider credentials entered the browser." });
  };
  const createVariation = () => {
    const next = variation === "v0.3" ? "v0.4" : "v0.5";
    setVariation(next);
    setEvaluation("review");
    addEvent({ title: `Forge created STRAT-ETH-YIELD ${next}`, detail: "Lineage branch is research-only and awaiting hard evaluation gates.", tone: "evolution", awareness: "Evolutionary" });
    toast.message("Variation created", { description: `${next} is a research record, not a deployable strategy.` });
  };
  const evaluateVariation = () => {
    setEvaluation(gate.state);
    addEvent({ title: `Hard gates reviewed ${variation}`, detail: `${gate.reason} Promotion remains limited to the decision layer after additional evidence.`, tone: "review", awareness: "Justification" });
    if (gate.state === "pass") toast.success("Hard gate passed", { description: gate.reason });
    else toast.warning("Evaluation requires review", { description: gate.reason });
  };
  const completeSimulationEvidence = () => {
    setSimulationEvidence(true);
    addEvent({ title: "Simulation evidence completed", detail: "Regime coverage reached 82% across the current paper window. The evaluator may now reassess the candidate.", tone: "pass", awareness: "Result" });
    toast.success("Simulation evidence recorded", { description: "The candidate remains simulation-only until the evaluation gate passes." });
  };
  const advancePromotion = () => {
    const transition = nextPromotionStage(promotionStage, evaluation);
    if (transition.action === "hold") return toast.warning("Promotion held", { description: "A review gate must be cleared before the strategy can advance." });
    setPromotionStage(transition.next);
    addEvent({ title: `Promotion moved to ${transition.next}`, detail: "The strategy entered the next supervised research stage. Execution remains unavailable.", tone: "evolution", awareness: "Evolutionary" });
    toast.success("Promotion state updated", { description: `Strategy is now in ${transition.next}; no live execution path exists.` });
  };
  const recordOutcome = () => {
    setOutcomeRecorded(true);
    const deviation = outcomeStatus(430, 310);
    addEvent({ title: "Interim outcome recorded", detail: `Expected +430 bps versus realized +310 bps; classified ${deviation} pending attribution review.`, tone: "review", awareness: "Result" });
    toast.message("Outcome tracker updated", { description: "The realized result and attribution placeholders are now visible." });
  };
  const requestExecution = () => {
    addEvent({ title: "Execution request rejected", detail: "The v0.2 runtime never grants execution.request to an AI agent or supervisor.", tone: "block", awareness: "Justification" });
    toast.error("Hard block enforced", { description: "Live execution is not an available capability in this workspace." });
  };
  const runToolCheck = () => {
    const text = `${selectedAgentData.name}: ${selectedAgentData.scopes.join(" · ")} — execution.request absent.`;
    setToolCheck(text);
    addEvent({ title: "Tool-scope check completed", detail: text, tone: "pass", awareness: "Justification" });
  };

  const navItems: Array<{ label: Section; icon: typeof Command; anchor: string }> = [
    { label: "Mission control", icon: Command, anchor: "mission-control" },
    { label: "Agent mesh", icon: Network, anchor: "agent-mesh" },
    { label: "Tool scopes", icon: Layers3, anchor: "tool-scopes" },
    { label: "Evidence ledger", icon: FileCheck2, anchor: "evidence-ledger" },
  ];

  return <div className="fabric-shell">
    <aside className="fabric-sidebar">
      <div className="fabric-brand"><div className="fabric-mark"><img src={logoUrl} alt="Ledgerline" /></div><div><strong>ledgerline</strong><span>agent fabric · v0.2</span></div></div>
      <div className="network-status"><span className="status-ring"><Activity size={12} /></span><div><span>runtime online</span><strong>SIMULATION / EVM</strong></div></div>
      <div className="sidebar-label">Control surface</div>
      <nav className="fabric-nav">{navItems.map(({ label, icon: Icon, anchor }) => <button key={label} onClick={() => navigate(label, anchor)} className={activeSection === label ? "fabric-nav-active" : ""}><Icon size={16} /><span>{label}</span>{activeSection === label && <ChevronRight size={15} />}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sealed-block"><LockKeyhole size={15} /><div><strong>Execution sealed</strong><span>No wallet signature path</span></div></div>
      <button className="sidebar-foot" onClick={() => setSettingsOpen(true)}><Sparkles size={15} /> Runtime configuration</button>
    </aside>

    <main className="fabric-main">
      <header className="fabric-topbar"><div className="trail"><span>ledgerline</span><ChevronRight size={13} /><strong>{activeSection}</strong></div><div className="topbar-badges"><span className="chain-badge"><Globe2 size={13} /> EVM / read-only</span><span className="proof-badge"><span /> policy hash verified</span><Button variant="outline" size="sm" onClick={syncCatalog} disabled={catalogQuery.isFetching}><RefreshCw size={13} /> {catalogQuery.isFetching ? "Syncing" : "Sync catalog"}</Button></div></header>

      <div className="fabric-content">
        <section id="mission-control" className="fabric-hero">
          <div className="orbit-backdrop"><span className="orbit o1" /><span className="orbit o2" /><span className="orbit o3" /><span className="orbit-dot d1" /><span className="orbit-dot d2" /><span className="orbit-dot d3" /></div>
          <div className="hero-signal"><div className="hero-kicker"><Zap size={13} /> AWARENESS-CENTRIC RUNTIME · AVO-{String(runCount).padStart(3, "0")}</div><h1>Intelligence that<br /><em>stays accountable.</em></h1><p>Every material act carries a justification, outcome context, and lineage history. Models can generate research; policy and owner control remain constitutional.</p><div className="hero-buttons"><Button className="run-button" onClick={runCycle}><Play size={15} fill="currentColor" /> Run paper cycle</Button><Button variant="ghost" className="evidence-button" onClick={() => navigate("Evidence ledger", "evidence-ledger")}><FileCheck2 size={15} /> Inspect evidence</Button></div></div>
          <div className="hero-metrics"><div><span>Agent roles</span><strong>07</strong><small>specialized</small></div><div><span>Awareness</span><strong>04</strong><small>explicit layers</small></div><div><span>Tool authority</span><strong>00</strong><small>execution scopes</small></div></div>
        </section>

        <div className="runtime-strip"><div><span className={`runtime-dot ${paused ? "runtime-paused" : ""}`} />{paused ? "Owner pause active" : "Supervisor monitoring trajectory"}</div><span className="strip-sep" /><div>Run state <strong>evidence-led</strong></div><span className="strip-sep" /><div>Execution <strong className="blocked-copy">hard-disabled</strong></div><button onClick={togglePause}>{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? "Resume fabric" : "Pause fabric"}</button></div>

        <section className="awareness-ribbon" aria-label="Operational awareness"><div className="awareness-lead"><span>V0.2 awareness model</span><strong>Four states the system must retain</strong></div>{awarenessItems.map(({ label, copy, icon: Icon }) => <button key={label} onClick={() => navigate("Evidence ledger", "evidence-ledger")}><Icon size={15} /><div><strong>{label}</strong><span>{copy}</span></div><ChevronRight size={14} /></button>)}</section>

        <div className="fabric-grid">
          <section className="fabric-panel mesh-panel"><div className="panel-cap"><div><span>Supervised control loop</span><h2>Observe, reason, gate, record</h2></div><div className="avo-label">AVO-INSPIRED <ArrowUpRight size={13} /></div></div><div className="reasoning-loop"><Node label="Observe" sublabel="markets + chain" active icon={Activity} /><div className="loop-link" /><Node label="Reason" sublabel="specialists" active icon={BrainCircuit} /><div className="loop-link" /><Node label="Evaluate" sublabel="hard gates" icon={Scale} /><div className="loop-link" /><Node label="Record" sublabel="lineage + outcome" active icon={FileCheck2} /></div><div className="supervisor-line"><CircleDotDashed size={16} /><span><strong>Orion</strong> detects stagnation, overfitting, repeated failure, and missing regime coverage.</span><span className="supervisor-state">recommend only</span></div></section>
          <section className="fabric-panel policy-panel"><div className="panel-cap"><div><span>Non-negotiable boundary</span><h2>Policy before intelligence</h2></div><ShieldAlert className="policy-icon" size={20} /></div><div className="policy-stack"><div><span className="policy-number">01</span><p>Agents may observe, reason, and write bounded proposals.</p><Check size={15} /></div><div><span className="policy-number">02</span><p>Risk and evaluator agents may hold or reject a candidate.</p><Check size={15} /></div><div className="policy-hard"><span className="policy-number">03</span><p>Evolution never modifies policy, capital, or permissions directly.</p><XCircle size={16} /></div></div><button className="block-test" onClick={requestExecution}>Test execution boundary <LockKeyhole size={14} /></button></section>
        </div>

        <section id="agent-mesh" className="fabric-panel agent-panel"><div className="panel-cap"><div><span>Reasoning & research topology</span><h2>Seven bounded specialist roles</h2></div><div className="catalog-status"><span className={catalogQuery.isFetching ? "catalog-pulse" : "catalog-pulse catalog-ready"} />{catalogQuery.isFetching ? "syncing catalog" : "current provider catalog"}</div></div><div className="agent-grid seven-agent-grid">{agents.map((agent) => { const Icon = agent.icon; return <button key={agent.id} className={`agent-card ${agent.selected ? "agent-selected" : ""}`} onClick={() => setSelectedAgent(agent.id)}><div className="agent-card-top"><div className="agent-identity"><div className="agent-icon"><Icon size={18} /></div><div><strong>{agent.name}</strong><span>{agent.role}</span></div></div><StateTag state={agent.state} /></div><div className="agent-model"><span>{agent.provider}</span><strong>{agent.model}</strong></div><div className="scope-row">{agent.scopes.map((scope) => <span key={scope}>{scope}</span>)}</div></button>; })}</div><div className="agent-detail"><div className="agent-detail-mark"><selectedAgentData.icon size={19} /></div><div><span>Selected role · {selectedAgentData.name}</span><strong>{selectedAgentData.remit}</strong></div><button onClick={() => navigate("Tool scopes", "tool-scopes")}>Inspect scopes <ChevronRight size={14} /></button></div></section>

        <section id="tool-scopes" className="fabric-grid tool-grid"><section className="fabric-panel provider-panel"><div className="panel-cap"><div><span>Model plane</span><h2>Current provider families</h2></div><Cpu size={19} className="muted-icon" /></div><div className="provider-list">{modelFamilies.map((family) => <div className="provider-row" key={family.id}><div className={`provider-glyph glyph-${family.id}`}><Bot size={15} /></div><div><strong>{family.label}</strong><span>{family.models.slice(0, 2).join(" · ") || "No supported model detected"}</span></div><span className="provider-route">routable <ChevronRight size={14} /></span></div>)}</div><div className="provider-note"><Database size={14} /> Catalog selection is server-side. Secrets never enter the browser.</div></section>
          <section className="fabric-panel scope-panel"><div className="panel-cap"><div><span>Scoped tool registry</span><h2>Inspectable permissions</h2></div><Layers3 size={19} className="muted-icon" /></div><div className="scope-checker"><div className="scope-check-agent"><div className="agent-icon"><selectedAgentData.icon size={17} /></div><div><strong>{selectedAgentData.name}</strong><span>{selectedAgentData.role}</span></div></div><div className="scope-set">{selectedAgentData.scopes.map((scope) => <span key={scope}>{scope}</span>)}<span className="scope-denied">execution.request denied</span></div><p>{toolCheck}</p><Button variant="outline" onClick={runToolCheck}><ShieldCheck size={14} /> Run scope check</Button></div></section></section>

        <section id="evidence-ledger" className="evidence-layout"><section className="fabric-panel event-panel"><div className="panel-cap"><div><span>Decision journal + outcome tracker</span><h2>Awareness ledger</h2></div><Button variant="ghost" size="sm" onClick={() => toast.message("Full trace is already loaded", { description: "Each entry declares its awareness layer and visible evidence summary." })}>Full trace <ArrowUpRight size={13} /></Button></div><div className="event-list">{events.slice(0, 7).map((event, index) => <button className="event-row event-button" key={`${event.title}-${index}`} onClick={() => toast.message(event.awareness + " awareness", { description: event.detail })}><span className={`event-dot event-${event.tone}`} /><span className="event-time">{event.time}</span><div><strong>{event.title}</strong><p>{event.detail}</p></div><span className="awareness-tag">{event.awareness}</span></button>)}</div></section>
          <section className="fabric-panel lineage-panel"><div className="panel-cap"><div><span>Strategy lineage · supervised only</span><h2>STRAT-ETH-YIELD</h2></div><GateTag state={evaluation} /></div><div className="promotion-path"><button className={promotionStage === "research" ? "promotion-active" : ""} onClick={() => setPromotionStage("research")}>01 <span>Research</span></button><ChevronRight size={13} /><button className={promotionStage === "simulation" ? "promotion-active" : ""} onClick={() => promotionStage === "simulation" && setPromotionStage("simulation")}>02 <span>Simulation</span></button><ChevronRight size={13} /><button className={promotionStage === "decision" ? "promotion-active" : ""} disabled>03 <span>Decision review</span></button><LockKeyhole size={13} /></div><div className="lineage-tree"><div className="lineage-node root"><span>v0.1</span><strong>Base thesis</strong><small>accepted for simulation</small></div><div className="lineage-branch" /><div className="lineage-node"><span>v0.2</span><strong>Liquidity filter</strong><small>coverage {simulationEvidence ? "82" : "62"}% · {simulationEvidence ? "ready to evaluate" : "review"}</small></div><div className="lineage-branch" /><div className="lineage-node current"><span>{variation}</span><strong>Variation candidate</strong><small>stage: {promotionStage} · never executable</small></div></div><div className="lineage-scores"><div><span>Robustness</span><strong>0.71</strong></div><div><span>Regime coverage</span><strong>{simulationEvidence ? "0.82" : "0.62"}</strong></div><div><span>Complexity</span><strong>0.18</strong></div></div><div className="lineage-actions"><Button variant="outline" onClick={createVariation}><Sparkles size={14} /> Create variation</Button><Button variant="outline" onClick={completeSimulationEvidence} disabled={simulationEvidence || promotionStage !== "simulation"}><FlaskConical size={14} /> {simulationEvidence ? "Evidence complete" : "Complete paper evidence"}</Button><Button className="evaluate-button" onClick={evaluateVariation}><Scale size={14} /> Evaluate gates</Button><Button variant="ghost" className="promote-button" onClick={advancePromotion}>Promote <ChevronRight size={14} /></Button></div></section></section>

        <section className="fabric-panel outcome-panel"><div className="panel-cap"><div><span>Result awareness · simulated interim review</span><h2>Outcome tracker</h2></div><span className={`outcome-badge ${outcomeRecorded ? "outcome-under" : ""}`}>{outcomeRecorded ? "underperforming" : "inconclusive"}</span></div><div className="outcome-grid"><div><span>Declared expectation</span><strong>+430 bps</strong><small>12-week paper horizon</small></div><div><span>Realized outcome</span><strong>{outcomeRecorded ? "+310 bps" : "Pending"}</strong><small>{outcomeRecorded ? "interim paper mark" : "no result recorded"}</small></div><div><span>Attribution</span><strong>{outcomeRecorded ? "Timing −70" : "Not assessed"}</strong><small>{outcomeRecorded ? "fees −20 · market −30" : "requires observation window"}</small></div><div><span>Deviation</span><strong>{outcomeRecorded ? "−120 bps" : "—"}</strong><small>{outcomeRecorded ? "review required" : "awaiting outcome"}</small></div></div><div className="outcome-actions"><p>Outcome awareness compares a declared expectation with realized evidence before a lineage can improve.</p><Button variant="outline" onClick={recordOutcome} disabled={outcomeRecorded}><TrendingUp size={14} /> {outcomeRecorded ? "Outcome recorded" : "Record interim outcome"}</Button></div></section>

        <section className="fabric-panel account-panel"><div className="panel-cap"><div><span>Web3 account context · simulated</span><h2>Read-only mandate envelope</h2></div><span className="account-proof"><span /> no signing authority</span></div><div className="account-grid"><div className="account-identity"><div className="account-avatar"><Wallet size={19} /></div><div><strong>Research subaccount</strong><span>0x7D3A···19F2 · simulated identity</span></div></div><div className="account-stat"><span>Network</span><strong>Ethereum / EVM</strong><small>read-only chain adapter</small></div><div className="account-stat"><span>Authority</span><strong>Observe + propose</strong><small>execution.request omitted</small></div><div className="account-stat"><span>Paper context</span><strong>$100,842 NAV</strong><small>42% stablecoin reserve</small></div></div></section>
        <section className="web3-band"><div className="web3-symbol"><Wallet size={20} /></div><div><span>Web3 readiness, without premature custody</span><h3>Read the chain. Simulate the intent. Keep authority revocable.</h3><p>Future Sailor, Binance Agent OS, or MCP adapters belong behind dedicated, permissioned tool boundaries. No external connector is active in this workspace.</p></div><Button variant="outline" onClick={() => setSettingsOpen(true)}>View connector posture <ChevronRight size={15} /></Button></section>
        <footer className="fabric-footer"><span>LEDGERLINE AGENT FABRIC / BUILD 0.2.0</span><span>SIMULATION-FIRST · AWARENESS-LED · EXECUTION-SEALED</span></footer>
      </div>
    </main>

    {settingsOpen && <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Runtime configuration"><div className="settings-modal"><button className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close runtime configuration"><X size={17} /></button><span>Runtime configuration</span><h2>Connector posture</h2><p>There are no active exchange, wallet, Sailor, Binance Agent OS, or MCP connections. The next safe step is a user-authorised read-only adapter with a dedicated subaccount and revocable scopes.</p><div className="settings-list"><div><Check size={14} /> Provider catalog: server-side</div><div><Check size={14} /> Paper environment: active</div><div><LockKeyhole size={14} /> Execution adapter: unavailable</div></div><Button className="run-button" onClick={() => { setSettingsOpen(false); toast.message("Posture recorded", { description: "No connector was activated or configured." }); }}>Keep simulation-only</Button></div></div>}
  </div>;
}
