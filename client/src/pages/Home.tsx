import React, { FormEvent, useEffect, useRef, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowUpRight, Check, ChevronRight, CircleAlert, Database, FileCheck2, Globe2, History, Landmark, LockKeyhole, MessageSquareText, Play, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

const logoUrl = "/manus-storage/ledger-logo_5877e9f6.png";
const isEthereumAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const money = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const compactNumber = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
const bpsToPercent = (value: number) => `${(value / 100).toFixed(2).replace(/\.00$/, "")}%`;

type PolicyDraft = { name: string; maxConcentrationBps: string; minReserveBps: string; maxTransactionBps: string; dailyMandateBps: string };
const emptyPolicy: PolicyDraft = { name: "", maxConcentrationBps: "", minReserveBps: "", maxTransactionBps: "", dailyMandateBps: "" };

function SectionNav({ label, target, onNavigate }: { label: string; target: string; onNavigate: (label: string) => void }) {
  return <button onClick={() => { onNavigate(label); document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><ChevronRight size={15} /><span>{label}</span></button>;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState("Research agent");
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(emptyPolicy);
  const [allowedAssets, setAllowedAssets] = useState<string[]>([]);
  const [assetDraft, setAssetDraft] = useState("");
  const [researchAddress, setResearchAddress] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("Analyse the live on-chain market evidence, identify the central risks, and state what requires further diligence.");
  const [addressDraft, setAddressDraft] = useState("");
  const [viewAddress, setViewAddress] = useState("");
  const lastRecordedMetric = useRef<string | null>(null);

  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const runsQuery = trpc.agentRuntime.runs.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const policyMutation = trpc.policy.save.useMutation({ onSuccess: () => { policyQuery.refetch(); historyQuery.refetch(); } });
  const actionMutation = trpc.history.record.useMutation({ onSuccess: () => historyQuery.refetch() });
  const simulationMutation = trpc.history.startSimulation.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); } });
  const researchMutation = trpc.research.analyzeToken.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); } });
  const tokenQuery = trpc.onchain.ethereumToken.useQuery({ address: viewAddress }, { enabled: isEthereumAddress(viewAddress), retry: false, refetchOnWindowFocus: false });

  useEffect(() => {
    if (!policyQuery.data) return;
    setPolicyDraft({ name: policyQuery.data.name, maxConcentrationBps: String(policyQuery.data.maxConcentrationBps), minReserveBps: String(policyQuery.data.minReserveBps), maxTransactionBps: String(policyQuery.data.maxTransactionBps), dailyMandateBps: String(policyQuery.data.dailyMandateBps) });
    setAllowedAssets(policyQuery.data.allowedAssets);
  }, [policyQuery.data]);

  useEffect(() => {
    if (!tokenQuery.data || !isAuthenticated) return;
    const metricKey = `${tokenQuery.data.token.address}:${tokenQuery.data.fetchedAt}`;
    if (lastRecordedMetric.current === metricKey) return;
    lastRecordedMetric.current = metricKey;
    actionMutation.mutate({ subject: `${tokenQuery.data.token.symbol} public token view`, detail: "Owner recorded that public token metrics were loaded from read-only sources. This note is not an authoritative execution or security event." });
  }, [tokenQuery.data, isAuthenticated]);

  const policyReady = Boolean(policyQuery.data);
  const runCount = runsQuery.data?.length ?? 0;
  const record = (_kind: "simulation_blocked" | "scope_checked", _status: "review" | "blocked" | "success", subject: string, detail: string) => {
    if (isAuthenticated) actionMutation.mutate({ subject, detail: `${detail} This is an owner-asserted note, not an authoritative control event.` });
  };

  const addAsset = () => {
    const normalized = assetDraft.trim();
    if (!isEthereumAddress(normalized)) return toast.error("Enter a full Ethereum token contract address.");
    if (allowedAssets.some((asset) => asset.toLowerCase() === normalized.toLowerCase())) return toast.message("That contract is already in the IPS universe.");
    setAllowedAssets((assets) => [...assets, normalized]);
    setAssetDraft("");
  };

  const savePolicy = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (allowedAssets.length === 0) return toast.error("Add at least one approved contract before saving the IPS.");
    try {
      await policyMutation.mutateAsync({ name: policyDraft.name.trim(), maxConcentrationBps: Number(policyDraft.maxConcentrationBps), minReserveBps: Number(policyDraft.minReserveBps), maxTransactionBps: Number(policyDraft.maxTransactionBps), dailyMandateBps: Number(policyDraft.dailyMandateBps), allowedAssets });
      toast.success("IPS saved", { description: "The policy is versioned. The policy is versioned and owner-governed." });
    } catch (error) {
      toast.error("IPS validation failed", { description: error instanceof Error ? error.message : "Review your limits and try again." });
    }
  };

  const startResearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (!isEthereumAddress(researchAddress.trim())) return toast.error("Enter a valid Ethereum token contract address.");
    if (researchQuestion.trim().length < 8) return toast.error("Ask a specific research question of at least eight characters.");
    try {
      await researchMutation.mutateAsync({ address: researchAddress.trim(), question: researchQuestion.trim() });
      toast.success("Research report ready", { description: "The response is source-bound and evidence-only." });
    } catch (error) {
      toast.error("Research could not be completed", { description: error instanceof Error ? error.message : "Please retry the evidence-bound report." });
    }
  };

  const startSimulation = async () => {
    if (!isAuthenticated) return startLogin();
    if (!policyReady) {
      record("simulation_blocked", "blocked", "Simulation request", "No owner IPS exists; a paper simulation cannot begin without a saved policy.");
      return toast.error("Save an IPS before starting a simulation.");
    }
    try {
      await simulationMutation.mutateAsync({ policyVersion: policyQuery.data?.version ?? 1 });
      toast.success("Paper simulation saved", { description: "A durable run was created. No execution adapter exists." });
    } catch (error) {
      toast.error("Simulation was not saved", { description: error instanceof Error ? error.message : "Try again." });
    }
  };

  const loadToken = (event: FormEvent) => {
    event.preventDefault();
    const address = addressDraft.trim();
    if (!isEthereumAddress(address)) return toast.error("Enter a valid Ethereum token contract address.");
    if (address.toLowerCase() === viewAddress.toLowerCase()) void tokenQuery.refetch(); else setViewAddress(address);
  };

  const auditScopes = () => {
    if (!isAuthenticated) return startLogin();
    record("scope_checked", "success", "Read-only scope audit", "Verified chain.read and market.read with no wallet, signature, exchange, or execution capability.");
    toast.success("Scope audit saved", { description: "Only public read scopes are available." });
  };

  return <div className="data-shell">
    <aside className="data-sidebar">
      <div className="data-brand"><div className="data-mark"><img src={logoUrl} alt="Ledgerline" /></div><div><strong>ledgerline</strong><span>personal investment agent · phase 1</span></div></div>
      <div className="runtime-stamp"><span><Activity size={13} /></span><div><small>OPERATING MODE</small><strong>SIMULATION ONLY</strong></div></div>
      <div className="data-side-label">Your agent</div>
      <nav className="data-nav"><SectionNav label="Research agent" target="research-agent" onNavigate={setActiveSection} /><SectionNav label="IPS constitution" target="ips-editor" onNavigate={setActiveSection} /><SectionNav label="Evidence viewer" target="onchain-viewer" onNavigate={setActiveSection} /><SectionNav label="Review trail" target="review-trail" onNavigate={setActiveSection} /></nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-seal"><LockKeyhole size={15} /><div><strong>Execution sealed</strong><span>No custody · no signing path</span></div></div>
      <div className="profile-strip"><div><span>{isAuthenticated ? user?.name ?? "Operator" : "Private workspace"}</span><small>{isAuthenticated ? "authenticated operator" : "sign in to persist controls"}</small></div>{isAuthenticated ? <Button variant="ghost" size="sm" onClick={() => document.getElementById("review-trail")?.scrollIntoView({ behavior: "smooth" })}>History</Button> : <Button size="sm" onClick={startLogin}>Sign in</Button>}</div>
    </aside>
    <main className="data-main">
      <header className="data-topbar"><div><span>ledgerline</span><ChevronRight size={13} /><strong>{activeSection}</strong></div><div><span className="top-scope"><Globe2 size={13} /> EVM public read-only</span><span className="top-scope"><ShieldCheck size={13} /> IPS governed</span>{isAuthenticated ? <span className="top-user">{user?.name ?? "Operator"}</span> : <Button size="sm" onClick={startLogin}>Sign in to research</Button>}</div></header>
      <div className="data-content">
        <section id="research-agent" className="agent-workspace">
          <div className="agent-intro"><span><Sparkles size={14} /> PHASE 1 · RESEARCH &amp; PAPER PROPOSALS</span><h1>Your investment agent starts with a <em>question.</em></h1><p>Ask Ledgerline to inspect an Ethereum token using live public chain and market evidence. It explains what the evidence supports, surfaces uncertainty, checks your IPS, and only ever proposes a paper-simulation next step.</p></div>
          <div className="agent-guardrail"><LockKeyhole size={17} /><div><strong>Execution is sealed.</strong><span>No wallet connection, private key, exchange credential, signature, or transaction request exists in this phase.</span></div></div>
          {!isAuthenticated && <div className="agent-signin"><MessageSquareText size={19} /><div><strong>Sign in to begin a private research trail.</strong><span>Your reports, policy checks, and simulations remain owner-scoped and auditable.</span></div><Button className="primary-mint" onClick={startLogin}>Sign in to research</Button></div>}
          <form className="agent-composer" onSubmit={startResearch}><div className="composer-kicker"><span>Ask the research agent</span><small>Live sources only · no hidden demo metrics</small></div><label>Ethereum token contract<input value={researchAddress} onChange={(event) => setResearchAddress(event.target.value)} placeholder="0x… ERC-20 contract" disabled={!isAuthenticated || researchMutation.isPending} /></label><label>Your research question<textarea value={researchQuestion} onChange={(event) => setResearchQuestion(event.target.value)} disabled={!isAuthenticated || researchMutation.isPending} /></label><div className="composer-footer"><span><ShieldCheck size={14} /> {policyReady ? `IPS ${policyQuery.data?.name} v${policyQuery.data?.version} will gate the proposal.` : "No IPS saved: research can run, but any proposal stays under review."}</span><Button className="primary-mint" type="submit" disabled={!isAuthenticated || researchMutation.isPending}>{researchMutation.isPending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />} {researchMutation.isPending ? "Reading evidence…" : "Generate research brief"}</Button></div></form>
          {researchMutation.error && <div className="agent-error"><CircleAlert size={16} /><span>{researchMutation.error.message}</span></div>}
          {researchMutation.data ? <ResearchBrief result={researchMutation.data} onStartSimulation={startSimulation} /> : <div className="agent-empty"><MessageSquareText size={22} /><div><strong>A disciplined analyst—not an execution bot.</strong><span>Start with one token contract and a concrete question. The response will be source-bound, policy-checked, and saved to your private review trail.</span></div><div className="agent-empty-stats"><span>POLICY <b>{policyReady ? `v${policyQuery.data?.version}` : "Required for paper advance"}</b></span><span>SIMULATIONS <b>{isAuthenticated ? runCount : "Private"}</b></span><span>EXECUTION <b>Sealed</b></span></div></div>}
        </section>
        <section className="source-band"><div><Database size={16} /><div><strong>Live-data provenance</strong><span>Blockscout public API for ERC-20 metadata and explorer figures · DexScreener public API for DEX metrics</span></div></div><span><Check size={13} /> No provider keys configured</span></section>
        <section id="ips-editor" className="workspace-section"><div className="section-heading"><div><span>Owner governance</span><h2>Investment Policy Statement</h2><p>Define the constitution used to gate paper proposals. This policy is stored per owner and its execution mode is governed by the authority state machine.</p></div><div className="heading-state"><ShieldCheck size={15} /> {policyReady ? `Saved version ${policyQuery.data?.version}` : "No saved IPS"}</div></div>{!isAuthenticated && <div className="auth-callout"><LockKeyhole size={17} /><div><strong>Authentication is required for persistence.</strong><span>You can inspect public data without signing in; sign in to save an IPS or research trail.</span></div><Button onClick={startLogin}>Sign in</Button></div>}<form className="ips-layout" onSubmit={savePolicy}><div className="ips-card ips-main"><label>Policy name<input value={policyDraft.name} onChange={(event) => setPolicyDraft({ ...policyDraft, name: event.target.value })} placeholder="e.g. Core on-chain pilot" disabled={!isAuthenticated} /></label><div className="limit-grid"><PolicyLimit label="Max concentration" value={policyDraft.maxConcentrationBps} onChange={(value) => setPolicyDraft({ ...policyDraft, maxConcentrationBps: value })} hint={policyDraft.maxConcentrationBps ? bpsToPercent(Number(policyDraft.maxConcentrationBps)) : "Enter a limit"} disabled={!isAuthenticated} /><PolicyLimit label="Minimum reserve" value={policyDraft.minReserveBps} onChange={(value) => setPolicyDraft({ ...policyDraft, minReserveBps: value })} hint={policyDraft.minReserveBps ? bpsToPercent(Number(policyDraft.minReserveBps)) : "Enter a limit"} disabled={!isAuthenticated} /><PolicyLimit label="Max transaction" value={policyDraft.maxTransactionBps} onChange={(value) => setPolicyDraft({ ...policyDraft, maxTransactionBps: value })} hint="Per proposal" disabled={!isAuthenticated} /><PolicyLimit label="Daily mandate" value={policyDraft.dailyMandateBps} onChange={(value) => setPolicyDraft({ ...policyDraft, dailyMandateBps: value })} hint="Aggregate daily cap" disabled={!isAuthenticated} /></div></div><div className="ips-card asset-card"><div><span>Approved asset universe</span><p>Full Ethereum token contracts only. An approved contract may advance to paper review; approval grants no execution authority.</p></div><div className="asset-entry"><input value={assetDraft} onChange={(event) => setAssetDraft(event.target.value)} placeholder="0x… token contract" disabled={!isAuthenticated} /><Button type="button" size="icon" onClick={addAsset} disabled={!isAuthenticated}><Plus size={16} /></Button></div><div className="asset-list">{allowedAssets.length === 0 ? <span className="empty-copy">No contracts approved yet.</span> : allowedAssets.map((asset) => <span key={asset}>{asset.slice(0, 10)}…{asset.slice(-8)}<button type="button" aria-label={`Remove ${asset}`} onClick={() => setAllowedAssets((assets) => assets.filter((entry) => entry !== asset))}><Trash2 size={12} /></button></span>)}</div><div className="ips-footer"><span><LockKeyhole size={13} /> Execution mode: owner-governed</span><Button className="primary-mint" type="submit" disabled={!isAuthenticated || policyMutation.isPending}>{policyMutation.isPending ? "Saving" : "Save IPS"}</Button></div></div></form></section>
        <section id="onchain-viewer" className="workspace-section"><div className="section-heading"><div><span>Public evidence</span><h2>Read-only Ethereum token viewer</h2><p>Inspect the public market packet separately before or after asking the agent. No wallet address is requested.</p></div><div className="heading-state"><Globe2 size={15} /> chain.read · market.read</div></div><div className="onchain-layout"><div className="onchain-query"><form onSubmit={loadToken}><label>Ethereum token contract<input value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} placeholder="0x…" /></label><Button className="primary-mint" type="submit" disabled={tokenQuery.isFetching}>{tokenQuery.isFetching ? <RefreshCw size={14} className="spin" /> : <Globe2 size={14} />} {tokenQuery.isFetching ? "Loading live data" : "Load live metrics"}</Button></form><Button type="button" variant="outline" className="policy-asset-shortcut" onClick={() => { const asset = policyQuery.data?.allowedAssets[0]; if (!asset) return toast.message("Save an IPS with an approved asset before using this shortcut."); setAddressDraft(asset); setViewAddress(asset); }} disabled={!policyQuery.data?.allowedAssets.length}>Load first IPS asset</Button><div className="scope-proof"><ShieldCheck size={15} /><div><strong>Authorized scopes</strong><span>Public `chain.read` and `market.read` only. No `execution.request`, wallet, or signing scope is present.</span></div></div>{tokenQuery.error && <div className="data-error"><CircleAlert size={16} /> {tokenQuery.error.message}</div>}</div><div className="live-metric-card">{tokenQuery.data ? <><div className="token-heading"><div><span>{tokenQuery.data.token.symbol}</span><strong>{tokenQuery.data.token.name}</strong><small>{tokenQuery.data.token.address}</small></div><a href={`https://eth.blockscout.com/token/${tokenQuery.data.token.address}`} target="_blank" rel="noreferrer">Explorer <ArrowUpRight size={13} /></a></div><div className="metric-grid"><Metric label="Price" value={money(tokenQuery.data.market?.priceUsd ?? tokenQuery.data.token.explorerPriceUsd)} hint={tokenQuery.data.market?.dex ?? "Explorer reference"} /><Metric label="24h volume" value={money(tokenQuery.data.market?.volume24h ?? tokenQuery.data.token.explorerVolume24h)} hint="public source" /><Metric label="Liquidity" value={money(tokenQuery.data.market?.liquidityUsd)} hint="highest-liquidity pair" /><Metric label="Holders" value={compactNumber(tokenQuery.data.token.holders)} hint="Blockscout" /><Metric label="24h change" value={tokenQuery.data.market?.priceChange24h === null || tokenQuery.data.market?.priceChange24h === undefined ? "Unavailable" : `${tokenQuery.data.market.priceChange24h.toFixed(2)}%`} hint="DEX pair" /><Metric label="Market cap" value={money(tokenQuery.data.token.marketCap)} hint="explorer supplied" /></div><div className="metric-foot"><span>Fetched {new Date(tokenQuery.data.fetchedAt).toLocaleTimeString()} · {tokenQuery.data.freshness}</span><span>{tokenQuery.data.sources.explorer} · {tokenQuery.data.sources.market}</span></div></> : <div className="metric-empty"><Landmark size={23} /><strong>Load a real contract to inspect live metrics.</strong><span>No demo price, balance, liquidity, or holder figure is displayed before a public-source response succeeds.</span></div>}</div></div></section>
        <section id="review-trail" className="workspace-section"><div className="section-heading"><div><span>Owner review trail</span><h2>Research, simulation, and scope history</h2><p>Every authenticated research brief, paper simulation, policy save, and scope audit is written to the owner’s durable review trail.</p></div><div className="heading-state"><History size={15} /> {isAuthenticated ? `${historyQuery.data?.length ?? 0} saved records` : "Sign in to view"}</div></div>{isAuthenticated ? <div className="history-panel">{historyQuery.isLoading ? <div className="history-empty">Loading durable records…</div> : (historyQuery.data?.length ?? 0) === 0 ? <div className="history-empty"><FileCheck2 size={20} /><strong>No private records yet.</strong><span>Save an IPS, generate a research brief, load a token, audit scopes, or start a paper simulation to build the first review trail.</span></div> : historyQuery.data?.map((item) => <div className="history-row" key={item.actionId}><span className={`history-dot status-${item.status}`} /><time>{new Date(item.createdAt).toLocaleString()}</time><div><strong>{item.subject}</strong><p>{item.detail}</p></div><span className="history-kind">{item.kind.replaceAll("_", " ")}</span></div>)}</div> : <div className="history-empty guarded"><LockKeyhole size={20} /><strong>Your history remains private.</strong><span>Authenticate to create and review the owner-scoped evidence trail.</span><Button onClick={startLogin}>Authenticate</Button></div>}<div className="trail-actions"><Button variant="outline" onClick={auditScopes}><ShieldCheck size={14} /> Audit read-only scopes</Button><Button className="primary-mint" onClick={startSimulation}><Play size={14} fill="currentColor" /> Start policy-bound simulation</Button></div></section>
        <footer className="data-footer"><span>LEDGERLINE / PERSONAL RESEARCH AGENT</span><span>PUBLIC EVIDENCE · OWNER-SCOPED REVIEW TRAIL · EXECUTION SEALED</span></footer>
      </div>
    </main>
  </div>;
}

function PolicyLimit({ label, value, onChange, hint, disabled }: { label: string; value: string; onChange: (value: string) => void; hint: string; disabled: boolean }) {
  return <label>{label}<div><input type="number" min="0" max="10000" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /><span>bps</span></div><small>{hint}</small></label>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>;
}

type ResearchBriefResult = { runId: string; report: { headline: string; marketObservation: string; thesis: string; risks: string[]; catalysts: string[]; unknowns: string[]; researchNextStep: string }; evidence: { asset: { address: string; name: string; symbol: string; holders: number | null; explorerPriceUsd: number | null; marketCap: number | null }; market: { priceUsd: number | null; liquidityUsd: number | null; volume24h: number | null; priceChange24h: number | null; dex: string; pairAddress: string } | null; provenance: { sources: { explorer: string; market: string }; fetchedAt: number; freshness: string; authority: string } }; policy: { result: "pass" | "review" | "block"; reasons: string[] }; advancement: { status: "allowed" | "review" | "blocked"; reason: string } };

export function ResearchBrief({ result, onStartSimulation }: { result: ResearchBriefResult; onStartSimulation: () => void }) {
  const allowed = result.advancement.status === "allowed";
  return <article className="agent-report"><header className="report-heading"><div><span><Sparkles size={13} /> EVIDENCE-BOUND RESEARCH BRIEF</span><h2>{result.report.headline}</h2><p>{result.report.marketObservation}</p></div><div className={`proposal-state ${result.advancement.status}`}><strong>{allowed ? "Paper-simulation eligible" : result.advancement.status === "review" ? "Owner review required" : "Blocked"}</strong><span>{result.advancement.reason}</span></div></header><div className="report-evidence"><Metric label="Asset" value={`${result.evidence.asset.name} · ${result.evidence.asset.symbol}`} hint={result.evidence.asset.address} /><Metric label="Price" value={money(result.evidence.market?.priceUsd ?? result.evidence.asset.explorerPriceUsd)} hint={result.evidence.market?.dex ?? "Explorer reference"} /><Metric label="Liquidity" value={money(result.evidence.market?.liquidityUsd)} hint="highest-liquidity pair" /><Metric label="Freshness" value={result.evidence.provenance.freshness} hint={new Date(result.evidence.provenance.fetchedAt).toLocaleTimeString()} /></div><div className="report-body"><section><span>Research thesis</span><p>{result.report.thesis}</p><div className="report-next"><b>Next diligence step</b><p>{result.report.researchNextStep}</p></div></section><section className="report-lists"><ReportList title="Risks & red flags" items={result.report.risks} tone="risk" /><ReportList title="Potential catalysts to verify" items={result.report.catalysts} tone="catalyst" /><ReportList title="Unknowns the evidence does not resolve" items={result.report.unknowns} tone="unknown" /></section></div><footer className="report-footer"><div><ShieldCheck size={15} /><div><strong>IPS check: {result.policy.result}</strong><span>{result.policy.reasons.join(" ")}</span></div></div><div><Globe2 size={15} /><div><strong>{result.evidence.provenance.sources.explorer} · {result.evidence.provenance.sources.market}</strong><span>{result.evidence.provenance.authority}</span></div></div>{allowed ? <Button className="primary-mint" onClick={onStartSimulation}><Play size={14} fill="currentColor" /> Start paper simulation</Button> : <span className="sealed-outcome"><LockKeyhole size={14} /> Research cannot advance yet</span>}</footer></article>;
}

function ReportList({ title, items, tone }: { title: string; items: string[]; tone: "risk" | "catalyst" | "unknown" }) {
  return <div className={`report-list ${tone}`}><strong>{title}</strong>{items.map((item, index) => <p key={`${tone}-${index}`}><span>{tone === "risk" ? "!" : tone === "catalyst" ? "+" : "?"}</span>{item}</p>)}</div>;
}

type LineageReview = { id: number; lineageId: string; name: string; stage: string; generation: number; createdAt: Date };
type EvaluationReview = { id: number; lineageId: string; version: string; gateResult: string; coverage: number; complexityPenalty: number; createdAt: Date };
type OutcomeReview = { id: number; lineageId: string; expectedBps: number; realizedBps: number | null; deviation: string; createdAt: Date };

export function ResearchRecordReview({ isAuthenticated, lineages, evaluations, outcomes }: { isAuthenticated: boolean; lineages: LineageReview[]; evaluations: EvaluationReview[]; outcomes: OutcomeReview[] }) {
  return <div className="research-review-grid"><ReviewPanel title="Saved lineage" count={lineages.length}>{!isAuthenticated ? "Authenticate to review private research records." : lineages.length === 0 ? "No persisted lineage records yet." : lineages.slice(0, 5).map((record) => <div className="review-row" key={record.id}><div><strong>{record.name}</strong><span>{record.lineageId} · generation {record.generation}</span></div><div><b className={`review-status ${record.stage}`}>{record.stage}</b><time>{new Date(record.createdAt).toLocaleDateString()}</time></div></div>)}</ReviewPanel><ReviewPanel title="Saved evaluations" count={evaluations.length}>{!isAuthenticated ? "Authenticate to review private research records." : evaluations.length === 0 ? "No persisted evaluation records yet." : evaluations.slice(0, 5).map((record) => <div className="review-row" key={record.id}><div><strong>{record.lineageId} · {record.version}</strong><span>Coverage {record.coverage}% · Complexity {record.complexityPenalty}%</span></div><div><b className={`review-status ${record.gateResult}`}>{record.gateResult}</b><time>{new Date(record.createdAt).toLocaleDateString()}</time></div></div>)}</ReviewPanel><ReviewPanel title="Saved outcomes" count={outcomes.length}>{!isAuthenticated ? "Authenticate to review private research records." : outcomes.length === 0 ? "No persisted outcome records yet." : outcomes.slice(0, 5).map((record) => <div className="review-row" key={record.id}><div><strong>{record.lineageId}</strong><span>Expected {record.expectedBps} bps · Realized {record.realizedBps ?? "—"} bps</span></div><div><b className={`review-status ${record.deviation}`}>{record.deviation.replaceAll("_", " ")}</b><time>{new Date(record.createdAt).toLocaleDateString()}</time></div></div>)}</ReviewPanel></div>;
}

function ReviewPanel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="review-panel"><header><span>{title}</span><b>{count} records</b></header><div className="review-list">{children}</div></section>;
}
