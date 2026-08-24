import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  FileCheck2,
  Gauge,
  Globe2,
  History,
  Landmark,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const logoUrl = "/manus-storage/ledger-logo_5877e9f6.png";
const isEthereumAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const bpsToPercent = (value: number) => (value / 100).toFixed(2).replace(/\.00$/, "") + "%";
const compactNumber = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
const money = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

type PolicyDraft = {
  name: string;
  maxConcentrationBps: string;
  minReserveBps: string;
  maxTransactionBps: string;
  dailyMandateBps: string;
};

type LineageDraft = { lineageId: string; name: string; stage: "research" | "simulation" | "decision" | "retired"; generation: string; rationale: string };
type EvaluationDraft = { lineageId: string; version: string; gateResult: "pass" | "review" | "block"; coverage: string; complexityPenalty: string; rationale: string };
type OutcomeDraft = { lineageId: string; runId: string; expectedBps: string; realizedBps: string; deviation: "on_track" | "underperforming" | "outperforming" | "inconclusive"; narrative: string };

const emptyPolicy: PolicyDraft = { name: "", maxConcentrationBps: "", minReserveBps: "", maxTransactionBps: "", dailyMandateBps: "" };
const emptyLineage: LineageDraft = { lineageId: "", name: "", stage: "research", generation: "1", rationale: "" };
const emptyEvaluation: EvaluationDraft = { lineageId: "", version: "", gateResult: "review", coverage: "", complexityPenalty: "", rationale: "" };
const emptyOutcome: OutcomeDraft = { lineageId: "", runId: "", expectedBps: "", realizedBps: "", deviation: "inconclusive", narrative: "" };

function SectionNav({ label, target, onNavigate }: { label: string; target: string; onNavigate: (label: string) => void }) {
  return <button onClick={() => { onNavigate(label); document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><ChevronRight size={15} /><span>{label}</span></button>;
}

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(emptyPolicy);
  const [allowedAssets, setAllowedAssets] = useState<string[]>([]);
  const [assetDraft, setAssetDraft] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [viewAddress, setViewAddress] = useState("");
  const [researchAddress, setResearchAddress] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("Analyse the live on-chain market evidence, identify the central risks, and state what requires further diligence.");
  const [lineageDraft, setLineageDraft] = useState<LineageDraft>(emptyLineage);
  const [evaluationDraft, setEvaluationDraft] = useState<EvaluationDraft>(emptyEvaluation);
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeDraft>(emptyOutcome);
  const [activeSection, setActiveSection] = useState("Research agent");
  const lastRecordedMetric = useRef<string | null>(null);

  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const runsQuery = trpc.agentRuntime.runs.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const policyMutation = trpc.policy.save.useMutation();
  const actionMutation = trpc.history.record.useMutation({ onSuccess: () => historyQuery.refetch() });
  const simulationMutation = trpc.history.startSimulation.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); } });
  const lineagesQuery = trpc.audit.lineages.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const evaluationsQuery = trpc.audit.evaluations.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const outcomesQuery = trpc.audit.outcomes.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const lineageMutation = trpc.audit.createLineage.useMutation({ onSuccess: () => lineagesQuery.refetch() });
  const evaluationMutation = trpc.audit.createEvaluation.useMutation({ onSuccess: () => evaluationsQuery.refetch() });
  const outcomeMutation = trpc.audit.createOutcome.useMutation({ onSuccess: () => outcomesQuery.refetch() });
  const researchMutation = trpc.research.analyzeToken.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); } });
  const tokenQuery = trpc.onchain.ethereumToken.useQuery({ address: viewAddress }, { enabled: isEthereumAddress(viewAddress), retry: false, refetchOnWindowFocus: false });

  useEffect(() => {
    if (!policyQuery.data) return;
    setPolicyDraft({
      name: policyQuery.data.name,
      maxConcentrationBps: String(policyQuery.data.maxConcentrationBps),
      minReserveBps: String(policyQuery.data.minReserveBps),
      maxTransactionBps: String(policyQuery.data.maxTransactionBps),
      dailyMandateBps: String(policyQuery.data.dailyMandateBps),
    });
    setAllowedAssets(policyQuery.data.allowedAssets);
  }, [policyQuery.data]);

  useEffect(() => {
    if (!tokenQuery.data || !isAuthenticated) return;
    const metricKey = `${tokenQuery.data.token.address}:${tokenQuery.data.fetchedAt}`;
    if (lastRecordedMetric.current === metricKey) return;
    lastRecordedMetric.current = metricKey;
    actionMutation.mutate({
      kind: "onchain_viewed",
      status: "success",
      subject: `${tokenQuery.data.token.symbol} public token view`,
      detail: "Owner loaded live token metadata and market metrics from public read-only sources.",
      payload: { address: tokenQuery.data.token.address, sources: tokenQuery.data.sources, fetchedAt: tokenQuery.data.fetchedAt },
    });
  }, [tokenQuery.data, isAuthenticated]);

  const runCount = runsQuery.data?.length ?? 0;
  const policyReady = Boolean(policyQuery.data);

  const record = (kind: "simulation_started" | "simulation_blocked" | "scope_checked", status: "success" | "review" | "blocked", subject: string, detail: string, payload: Record<string, unknown> = {}) => {
    if (!isAuthenticated) return;
    actionMutation.mutate({ kind, status, subject, detail, payload });
  };

  const savePolicy = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (allowedAssets.length === 0) return toast.error("Add at least one approved token contract before saving the IPS.");
    const values = {
      name: policyDraft.name.trim(),
      maxConcentrationBps: Number(policyDraft.maxConcentrationBps),
      minReserveBps: Number(policyDraft.minReserveBps),
      maxTransactionBps: Number(policyDraft.maxTransactionBps),
      dailyMandateBps: Number(policyDraft.dailyMandateBps),
      allowedAssets,
    };
    try {
      await policyMutation.mutateAsync(values);
      await policyQuery.refetch();
      toast.success("IPS saved", { description: "The updated limits are versioned and execution remains simulation-only." });
    } catch (error) {
      toast.error("IPS validation failed", { description: error instanceof Error ? error.message : "Review the policy limits and try again." });
    }
  };

  const addAsset = () => {
    const normalized = assetDraft.trim();
    if (!isEthereumAddress(normalized)) return toast.error("Enter a full Ethereum token contract address.");
    if (allowedAssets.some((asset) => asset.toLowerCase() === normalized.toLowerCase())) return toast.message("That asset is already in the IPS universe.");
    setAllowedAssets((assets) => [...assets, normalized]);
    setAssetDraft("");
  };

  const loadToken = (event: FormEvent) => {
    event.preventDefault();
    const normalized = addressDraft.trim();
    if (!isEthereumAddress(normalized)) return toast.error("Enter a valid Ethereum token contract address.");
    if (normalized.toLowerCase() === viewAddress.toLowerCase()) void tokenQuery.refetch();
    else setViewAddress(normalized);
  };

  const loadFirstPolicyAsset = () => {
    const asset = policyQuery.data?.allowedAssets[0];
    if (!asset) return toast.message("Save an IPS with an approved asset before using this shortcut.");
    setAddressDraft(asset);
    if (asset.toLowerCase() === viewAddress.toLowerCase()) void tokenQuery.refetch();
    else setViewAddress(asset);
  };

  const startResearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    const address = researchAddress.trim();
    if (!isEthereumAddress(address)) return toast.error("Enter a valid Ethereum token contract address.");
    if (researchQuestion.trim().length < 8) return toast.error("Ask a specific research question of at least eight characters.");
    try {
      await researchMutation.mutateAsync({ address, question: researchQuestion.trim() });
      toast.success("Research report ready", { description: "The report is tied to live source metadata and remains simulation-only." });
    } catch (error) {
      toast.error("Research could not be completed", { description: error instanceof Error ? error.message : "The evidence-bound report could not be generated. Please retry." });
    }
  };

  const startSimulation = async () => {
    if (!isAuthenticated) return startLogin();
    if (!policyReady) {
      record("simulation_blocked", "blocked", "Simulation request", "No owner IPS exists; a simulation cannot begin without a saved policy.");
      return toast.error("Save an IPS before starting a simulation.");
    }
    try {
      await simulationMutation.mutateAsync({ policyVersion: policyQuery.data?.version ?? 1 });
      toast.success("Simulation history saved", { description: "The run is recorded under the active IPS and remains non-executable." });
    } catch (error) {
      toast.error("Simulation was not saved", { description: error instanceof Error ? error.message : "The durable run record could not be created." });
    }
  };

  const checkScopes = () => {
    if (!isAuthenticated) return startLogin();
    record("scope_checked", "success", "Read-only scope audit", "Verified public chain and market data scopes with no wallet, signature, exchange, or execution capability.", { scopes: ["chain.read", "market.read"] });
    toast.success("Scope audit saved", { description: "Read-only data scopes were recorded in operator history." });
  };

  const submitLineage = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    try {
      await lineageMutation.mutateAsync({ ...lineageDraft, generation: Number(lineageDraft.generation) });
      setLineageDraft(emptyLineage);
      toast.success("Lineage record saved");
    } catch (error) { toast.error("Lineage record was not saved", { description: error instanceof Error ? error.message : "Review the submitted fields." }); }
  };

  const submitEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    try {
      await evaluationMutation.mutateAsync({ ...evaluationDraft, simulationPassed: true, coverage: Number(evaluationDraft.coverage), complexityPenalty: Number(evaluationDraft.complexityPenalty) });
      setEvaluationDraft(emptyEvaluation);
      toast.success("Evaluation record saved");
    } catch (error) { toast.error("Evaluation was not saved", { description: error instanceof Error ? error.message : "Review the submitted fields." }); }
  };

  const submitOutcome = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    try {
      await outcomeMutation.mutateAsync({ ...outcomeDraft, runId: outcomeDraft.runId || undefined, expectedBps: Number(outcomeDraft.expectedBps), realizedBps: outcomeDraft.realizedBps ? Number(outcomeDraft.realizedBps) : undefined });
      setOutcomeDraft(emptyOutcome);
      toast.success("Outcome record saved");
    } catch (error) { toast.error("Outcome was not saved", { description: error instanceof Error ? error.message : "Review the submitted fields." }); }
  };

  return <div className="data-shell">
    <aside className="data-sidebar">
      <div className="data-brand"><div className="data-mark"><img src={logoUrl} alt="Ledgerline" /></div><div><strong>ledgerline</strong><span>personal investment agent · phase 1</span></div></div>
      <div className="runtime-stamp"><span><Activity size={13} /></span><div><small>OPERATING MODE</small><strong>SIMULATION ONLY</strong></div></div>
      <div className="data-side-label">Your agent</div>
      <nav className="data-nav"><SectionNav label="Research agent" target="research-agent" onNavigate={setActiveSection} /><SectionNav label="IPS constitution" target="ips-editor" onNavigate={setActiveSection} /><SectionNav label="Evidence viewer" target="onchain-viewer" onNavigate={setActiveSection} /><SectionNav label="Research ledger" target="research-records" onNavigate={setActiveSection} /><SectionNav label="Operator history" target="operator-history" onNavigate={setActiveSection} /></nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-seal"><LockKeyhole size={15} /><div><strong>Execution sealed</strong><span>No custody · no signing path</span></div></div>
      <div className="profile-strip"><div><span>{isAuthenticated ? user?.name ?? "Operator" : "Private workspace"}</span><small>{isAuthenticated ? "authenticated operator" : "sign in to persist controls"}</small></div>{isAuthenticated ? <Button variant="ghost" size="sm" onClick={() => document.getElementById("operator-history")?.scrollIntoView({ behavior: "smooth" })}>History</Button> : <Button size="sm" onClick={startLogin}>Sign in</Button>}</div>
    </aside>

    <main className="data-main">
      <header className="data-topbar"><div><span>ledgerline</span><ChevronRight size={13} /><strong>{activeSection}</strong></div><div><span className="top-scope"><Globe2 size={13} /> EVM public read-only</span><span className="top-scope"><ShieldCheck size={13} /> IPS governed</span>{isAuthenticated ? <span className="top-user">{user?.name ?? "Operator"}</span> : <Button size="sm" onClick={startLogin}>Sign in to research</Button>}</div></header>

      <div className="data-content">
        <section id="research-agent" className="agent-workspace">
          <div className="agent-intro"><span><Sparkles size={14} /> PHASE 1 · RESEARCH &amp; PAPER PROPOSALS</span><h1>Your investment agent starts with a <em>question.</em></h1><p>Ask Ledgerline to inspect an Ethereum token using live public chain and market evidence. It will explain what the evidence supports, surface uncertainty, check the IPS, and only ever propose a paper-simulation next step.</p></div>
          <div className="agent-guardrail"><LockKeyhole size={17} /><div><strong>Execution is sealed.</strong><span>No wallet connection, private key, exchange credential, signature, or transaction request exists in this phase.</span></div></div>
          {!isAuthenticated && <div className="agent-signin"><MessageSquareText size={19} /><div><strong>Sign in to begin a private research trail.</strong><span>Your reports, policy checks, and simulations remain owner-scoped and auditable.</span></div><Button className="primary-mint" onClick={startLogin}>Sign in to research</Button></div>}
          <form className="agent-composer" onSubmit={startResearch}>
            <div className="composer-kicker"><span>Ask the research agent</span><small>Live sources only · no hidden demo metrics</small></div>
            <label>Ethereum token contract<input value={researchAddress} onChange={(event) => setResearchAddress(event.target.value)} placeholder="0x… ERC-20 contract" disabled={!isAuthenticated || researchMutation.isPending} /></label>
            <label>Your research question<textarea value={researchQuestion} onChange={(event) => setResearchQuestion(event.target.value)} disabled={!isAuthenticated || researchMutation.isPending} /></label>
            <div className="composer-footer"><span><ShieldCheck size={14} /> {policyReady ? `IPS ${policyQuery.data?.name} v${policyQuery.data?.version} will gate the proposal.` : "No IPS saved: research can run, but any proposal stays under review."}</span><Button className="primary-mint" type="submit" disabled={!isAuthenticated || researchMutation.isPending}>{researchMutation.isPending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />} {researchMutation.isPending ? "Reading evidence…" : "Generate research brief"}</Button></div>
          </form>
          {researchMutation.error && <div className="agent-error"><CircleAlert size={16} /><span>{researchMutation.error.message}</span></div>}
          {researchMutation.data ? <ResearchBrief result={researchMutation.data} onStartSimulation={startSimulation} /> : <div className="agent-empty"><MessageSquareText size={22} /><div><strong>A disciplined analyst—not an execution bot.</strong><span>Start with one token contract and a concrete question. The response will be source-bound, policy-checked, and saved to your private review trail.</span></div><div className="agent-empty-stats"><span>POLICY <b>{policyReady ? `v${policyQuery.data?.version}` : "Required for paper advance"}</b></span><span>SIMULATIONS <b>{isAuthenticated ? runCount : "Private"}</b></span><span>EXECUTION <b>Sealed</b></span></div></div>}
        </section>

        <section className="source-band"><div><Database size={16} /><div><strong>Live-data provenance</strong><span>Blockscout public API for ERC-20 metadata and explorer figures · DexScreener public API for DEX metrics</span></div></div><span><Check size={13} /> No provider keys configured</span></section>

        <section id="ips-editor" className="workspace-section"><div className="section-heading"><div><span>Owner governance</span><h2>Investment Policy Statement</h2><p>Set the limits the system may evaluate against. This policy is stored per owner and its execution mode is locked to simulation.</p></div><div className="heading-state"><ShieldCheck size={15} /> {policyReady ? `Saved version ${policyQuery.data?.version}` : "No saved IPS"}</div></div>
          {!isAuthenticated && <div className="auth-callout"><LockKeyhole size={17} /><div><strong>Authentication required for persistence.</strong><span>You can inspect live public data without signing in; sign in to save an IPS or operator history.</span></div><Button onClick={startLogin}>Sign in</Button></div>}
          <form className="ips-layout" onSubmit={savePolicy}><div className="ips-card ips-main"><label>Policy name<input value={policyDraft.name} onChange={(event) => setPolicyDraft({ ...policyDraft, name: event.target.value })} placeholder="e.g. Core on-chain pilot" disabled={!isAuthenticated} /></label><div className="limit-grid"><label>Max concentration <div><input type="number" min="1" max="10000" value={policyDraft.maxConcentrationBps} onChange={(event) => setPolicyDraft({ ...policyDraft, maxConcentrationBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>{policyDraft.maxConcentrationBps ? bpsToPercent(Number(policyDraft.maxConcentrationBps)) : "Enter a limit"}</small></label><label>Minimum reserve <div><input type="number" min="0" max="10000" value={policyDraft.minReserveBps} onChange={(event) => setPolicyDraft({ ...policyDraft, minReserveBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>{policyDraft.minReserveBps ? bpsToPercent(Number(policyDraft.minReserveBps)) : "Enter a limit"}</small></label><label>Max transaction <div><input type="number" min="1" max="10000" value={policyDraft.maxTransactionBps} onChange={(event) => setPolicyDraft({ ...policyDraft, maxTransactionBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>Per proposal</small></label><label>Daily mandate <div><input type="number" min="1" max="10000" value={policyDraft.dailyMandateBps} onChange={(event) => setPolicyDraft({ ...policyDraft, dailyMandateBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>Aggregate simulation cap</small></label></div></div><div className="ips-card asset-card"><div><span>Approved asset universe</span><p>Full Ethereum token contracts only. The on-chain viewer will use these as inspectable candidates; no contract grants authority.</p></div><div className="asset-entry"><input value={assetDraft} onChange={(event) => setAssetDraft(event.target.value)} placeholder="0x… token contract" disabled={!isAuthenticated} /><Button type="button" size="icon" onClick={addAsset} disabled={!isAuthenticated}><Plus size={16} /></Button></div><div className="asset-list">{allowedAssets.length === 0 ? <span className="empty-copy">No contracts approved yet.</span> : allowedAssets.map((asset) => <span key={asset}>{asset.slice(0, 10)}…{asset.slice(-8)}<button type="button" aria-label={`Remove ${asset}`} onClick={() => setAllowedAssets((assets) => assets.filter((entry) => entry !== asset))}><Trash2 size={12} /></button></span>)}</div><div className="ips-footer"><span><LockKeyhole size={13} /> Execution mode: simulation-only</span><Button className="primary-mint" type="submit" disabled={!isAuthenticated || policyMutation.isPending}>{policyMutation.isPending ? "Saving" : "Save IPS"}</Button></div></div></form></section>

        <section id="onchain-viewer" className="workspace-section"><div className="section-heading"><div><span>Public chain data</span><h2>Read-only Ethereum token viewer</h2><p>Paste any ERC-20 contract address to query live metadata, holder figures, and the highest-liquidity DEX market record. No wallet address is requested.</p></div><div className="heading-state"><Globe2 size={15} /> chain.read · market.read</div></div><div className="onchain-layout"><div className="onchain-query"><form onSubmit={loadToken}><label>Ethereum token contract<input value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} placeholder="0x…" /></label><Button className="primary-mint" type="submit" disabled={tokenQuery.isFetching}>{tokenQuery.isFetching ? <RefreshCw size={14} className="spin" /> : <SearchIcon />} {tokenQuery.isFetching ? "Loading live data" : "Load live metrics"}</Button></form><Button type="button" variant="outline" className="policy-asset-shortcut" onClick={loadFirstPolicyAsset} disabled={!policyQuery.data?.allowedAssets.length}>Load first IPS asset</Button><div className="scope-proof"><ShieldCheck size={15} /><div><strong>Authorized scopes</strong><span>Public `chain.read` and `market.read` only. No `execution.request`, wallet, or signing scope is present.</span></div></div>{tokenQuery.error && <div className="data-error"><CircleAlert size={16} /> {tokenQuery.error.message}</div>}</div><div className="live-metric-card">{tokenQuery.data ? <><div className="token-heading"><div><span>{tokenQuery.data.token.symbol}</span><strong>{tokenQuery.data.token.name}</strong><small>{tokenQuery.data.token.address}</small></div><a href={`https://eth.blockscout.com/token/${tokenQuery.data.token.address}`} target="_blank" rel="noreferrer">Explorer <ArrowUpRight size={13} /></a></div><div className="metric-grid"><div><span>Price</span><strong>{money(tokenQuery.data.market?.priceUsd ?? tokenQuery.data.token.explorerPriceUsd)}</strong><small>{tokenQuery.data.market?.dex ?? "Explorer reference"}</small></div><div><span>24h volume</span><strong>{money(tokenQuery.data.market?.volume24h ?? tokenQuery.data.token.explorerVolume24h)}</strong><small>public source</small></div><div><span>Liquidity</span><strong>{money(tokenQuery.data.market?.liquidityUsd)}</strong><small>highest-liquidity pair</small></div><div><span>Holders</span><strong>{compactNumber(tokenQuery.data.token.holders)}</strong><small>Blockscout</small></div><div><span>24h change</span><strong>{tokenQuery.data.market?.priceChange24h === null || tokenQuery.data.market?.priceChange24h === undefined ? "Unavailable" : `${tokenQuery.data.market.priceChange24h.toFixed(2)}%`}</strong><small>DEX pair</small></div><div><span>Market cap</span><strong>{money(tokenQuery.data.token.marketCap)}</strong><small>explorer supplied</small></div></div><div className="metric-foot"><span>Fetched {new Date(tokenQuery.data.fetchedAt).toLocaleTimeString()} · {tokenQuery.data.freshness}</span><span>{tokenQuery.data.sources.explorer} · {tokenQuery.data.sources.market}</span></div></> : <div className="metric-empty"><Landmark size={23} /><strong>Load a real contract to inspect live metrics.</strong><span>No demo price, balance, liquidity, or holder figure is displayed before a public-source response succeeds.</span></div>}</div></div></section>

        <section id="research-records" className="workspace-section"><div className="section-heading"><div><span>Durable research lifecycle</span><h2>Lineage, evaluation, and outcome records</h2><p>Create owner-controlled strategy records that become evolutionary, justification, and result awareness entries. These records remain research and simulation artifacts only.</p></div><div className="heading-state"><Layers3 size={15} /> {isAuthenticated ? "owner write enabled" : "sign in to write"}</div></div><div className="research-grid"><form className="research-card" onSubmit={submitLineage}><div><span>01 · Evolutionary</span><h3>Strategy lineage</h3></div><label>Lineage ID<input value={lineageDraft.lineageId} onChange={(event) => setLineageDraft({ ...lineageDraft, lineageId: event.target.value })} placeholder="e.g. STRAT-001" disabled={!isAuthenticated} /></label><label>Name<input value={lineageDraft.name} onChange={(event) => setLineageDraft({ ...lineageDraft, name: event.target.value })} placeholder="Research thesis" disabled={!isAuthenticated} /></label><div className="research-pair"><label>Stage<select value={lineageDraft.stage} onChange={(event) => setLineageDraft({ ...lineageDraft, stage: event.target.value as LineageDraft["stage"] })} disabled={!isAuthenticated}><option value="research">Research</option><option value="simulation">Simulation</option><option value="decision">Decision</option><option value="retired">Retired</option></select></label><label>Generation<input type="number" min="1" value={lineageDraft.generation} onChange={(event) => setLineageDraft({ ...lineageDraft, generation: event.target.value })} disabled={!isAuthenticated} /></label></div><label>Rationale<textarea value={lineageDraft.rationale} onChange={(event) => setLineageDraft({ ...lineageDraft, rationale: event.target.value })} placeholder="Why this research branch exists" disabled={!isAuthenticated} /></label><Button className="primary-mint" type="submit" disabled={!isAuthenticated || lineageMutation.isPending}>Save lineage</Button><small>{isAuthenticated ? `${lineagesQuery.data?.length ?? 0} saved lineage records` : "Authentication required"}</small></form><form className="research-card" onSubmit={submitEvaluation}><div><span>02 · Justification</span><h3>Hard evaluation</h3></div><label>Lineage ID<input value={evaluationDraft.lineageId} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, lineageId: event.target.value })} placeholder="STRAT-001" disabled={!isAuthenticated} /></label><div className="research-pair"><label>Version<input value={evaluationDraft.version} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, version: event.target.value })} placeholder="v1" disabled={!isAuthenticated} /></label><label>Gate<select value={evaluationDraft.gateResult} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, gateResult: event.target.value as EvaluationDraft["gateResult"] })} disabled={!isAuthenticated}><option value="pass">Pass</option><option value="review">Review</option><option value="block">Block</option></select></label></div><div className="research-pair"><label>Coverage %<input type="number" min="0" max="100" value={evaluationDraft.coverage} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, coverage: event.target.value })} disabled={!isAuthenticated} /></label><label>Complexity %<input type="number" min="0" max="100" value={evaluationDraft.complexityPenalty} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, complexityPenalty: event.target.value })} disabled={!isAuthenticated} /></label></div><label>Rationale<textarea value={evaluationDraft.rationale} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, rationale: event.target.value })} placeholder="Evidence and gate justification" disabled={!isAuthenticated} /></label><Button className="primary-mint" type="submit" disabled={!isAuthenticated || evaluationMutation.isPending}>Save evaluation</Button><small>{isAuthenticated ? `${evaluationsQuery.data?.length ?? 0} saved evaluation records` : "Authentication required"}</small></form><form className="research-card" onSubmit={submitOutcome}><div><span>03 · Result</span><h3>Outcome review</h3></div><label>Lineage ID<input value={outcomeDraft.lineageId} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, lineageId: event.target.value })} placeholder="STRAT-001" disabled={!isAuthenticated} /></label><label>Optional paper run ID<input value={outcomeDraft.runId} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, runId: event.target.value })} placeholder="run identifier" disabled={!isAuthenticated} /></label><div className="research-pair"><label>Expected bps<input type="number" value={outcomeDraft.expectedBps} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, expectedBps: event.target.value })} disabled={!isAuthenticated} /></label><label>Realized bps<input type="number" value={outcomeDraft.realizedBps} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, realizedBps: event.target.value })} disabled={!isAuthenticated} /></label></div><label>Deviation<select value={outcomeDraft.deviation} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, deviation: event.target.value as OutcomeDraft["deviation"] })} disabled={!isAuthenticated}><option value="inconclusive">Inconclusive</option><option value="on_track">On track</option><option value="underperforming">Underperforming</option><option value="outperforming">Outperforming</option></select></label><label>Observation narrative<textarea value={outcomeDraft.narrative} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, narrative: event.target.value })} placeholder="What the observed paper result means" disabled={!isAuthenticated} /></label><Button className="primary-mint" type="submit" disabled={!isAuthenticated || outcomeMutation.isPending}>Save outcome</Button><small>{isAuthenticated ? `${outcomesQuery.data?.length ?? 0} saved outcome records` : "Authentication required"}</small></form></div></section>

        <ResearchRecordReview isAuthenticated={isAuthenticated} lineages={lineagesQuery.data ?? []} evaluations={evaluationsQuery.data ?? []} outcomes={outcomesQuery.data ?? []} />

        <section id="operator-history" className="workspace-section"><div className="section-heading"><div><span>Immutable review trail</span><h2>Operator action history</h2><p>Policy saves, simulations, data views, and scope audits are persisted for the authenticated owner. No event is seeded into this view.</p></div><div className="heading-state"><History size={15} /> {isAuthenticated ? `${historyQuery.data?.length ?? 0} saved records` : "Sign in to view"}</div></div>{isAuthenticated ? <div className="history-panel">{historyQuery.isLoading ? <div className="history-empty">Loading durable operator records…</div> : (historyQuery.data?.length ?? 0) === 0 ? <div className="history-empty"><FileCheck2 size={20} /><strong>No operator actions saved yet.</strong><span>Save an IPS, query a token, run a scope audit, or start a simulation to create the first durable record.</span></div> : historyQuery.data?.map((item) => <div className="history-row" key={item.actionId}><span className={`history-dot status-${item.status}`} /><time>{new Date(item.createdAt).toLocaleString()}</time><div><strong>{item.subject}</strong><p>{item.detail}</p></div><span className="history-kind">{item.kind.replaceAll("_", " ")}</span></div>)}</div> : <div className="history-empty guarded"><LockKeyhole size={20} /><strong>Your history remains private.</strong><span>Authenticate to create and review the operator-owned audit trail.</span><Button onClick={startLogin}>Authenticate</Button></div>}</section>
        <footer className="data-footer"><span>LEDGERLINE / PERSONAL RESEARCH AGENT</span><span>PUBLIC EVIDENCE · OWNER-SCOPED REVIEW TRAIL · EXECUTION SEALED</span></footer>
      </div>
    </main>
  </div>;
}

function SearchIcon() { return <Gauge size={14} />; }

type ResearchBriefResult = {
  runId: string;
  report: { headline: string; marketObservation: string; thesis: string; risks: string[]; catalysts: string[]; unknowns: string[]; researchNextStep: string };
  evidence: { asset: { address: string; name: string; symbol: string; holders: number | null; explorerPriceUsd: number | null; marketCap: number | null }; market: { priceUsd: number | null; liquidityUsd: number | null; volume24h: number | null; priceChange24h: number | null; dex: string; pairAddress: string } | null; provenance: { sources: { explorer: string; market: string }; fetchedAt: number; freshness: string; authority: string } };
  policy: { result: "pass" | "review" | "block"; reasons: string[] };
  advancement: { status: "allowed" | "review" | "blocked"; reason: string };
};

export function ResearchBrief({ result, onStartSimulation }: { result: ResearchBriefResult; onStartSimulation: () => void }) {
  const allowed = result.advancement.status === "allowed";
  return <article className="agent-report">
    <header className="report-heading"><div><span><Sparkles size={13} /> EVIDENCE-BOUND RESEARCH BRIEF</span><h2>{result.report.headline}</h2><p>{result.report.marketObservation}</p></div><div className={`proposal-state ${result.advancement.status}`}><strong>{allowed ? "Paper-simulation eligible" : result.advancement.status === "review" ? "Owner review required" : "Blocked"}</strong><span>{result.advancement.reason}</span></div></header>
    <div className="report-evidence"><div><span>ASSET</span><strong>{result.evidence.asset.name} · {result.evidence.asset.symbol}</strong><small>{result.evidence.asset.address}</small></div><div><span>PRICE</span><strong>{money(result.evidence.market?.priceUsd ?? result.evidence.asset.explorerPriceUsd)}</strong><small>{result.evidence.market?.dex ?? "Explorer reference"}</small></div><div><span>LIQUIDITY</span><strong>{money(result.evidence.market?.liquidityUsd)}</strong><small>highest-liquidity pair</small></div><div><span>FRESHNESS</span><strong>{result.evidence.provenance.freshness}</strong><small>{new Date(result.evidence.provenance.fetchedAt).toLocaleTimeString()}</small></div></div>
    <div className="report-body"><section><span>Research thesis</span><p>{result.report.thesis}</p><div className="report-next"><b>Next diligence step</b><p>{result.report.researchNextStep}</p></div></section><section className="report-lists"><ReportList title="Risks & red flags" items={result.report.risks} tone="risk" /><ReportList title="Potential catalysts to verify" items={result.report.catalysts} tone="catalyst" /><ReportList title="Unknowns the evidence does not resolve" items={result.report.unknowns} tone="unknown" /></section></div>
    <footer className="report-footer"><div><ShieldCheck size={15} /><div><strong>IPS check: {result.policy.result}</strong><span>{result.policy.reasons.join(" ")}</span></div></div><div><Globe2 size={15} /><div><strong>{result.evidence.provenance.sources.explorer} · {result.evidence.provenance.sources.market}</strong><span>{result.evidence.provenance.authority}</span></div></div>{allowed ? <Button className="primary-mint" onClick={onStartSimulation}><Play size={14} fill="currentColor" /> Start paper simulation</Button> : <span className="sealed-outcome"><LockKeyhole size={14} /> Research cannot advance yet</span>}</footer>
  </article>;
}

function ReportList({ title, items, tone }: { title: string; items: string[]; tone: "risk" | "catalyst" | "unknown" }) {
  return <div className={`report-list ${tone}`}><strong>{title}</strong>{items.map((item, index) => <p key={`${tone}-${index}`}><span>{tone === "risk" ? "!" : tone === "catalyst" ? "+" : "?"}</span>{item}</p>)}</div>;
}

type LineageReview = { id: number; lineageId: string; name: string; stage: string; generation: number; createdAt: Date };
type EvaluationReview = { id: number; lineageId: string; version: string; gateResult: string; coverage: number; complexityPenalty: number; createdAt: Date };
type OutcomeReview = { id: number; lineageId: string; expectedBps: number; realizedBps: number | null; deviation: string; createdAt: Date };

export function ResearchRecordReview({ isAuthenticated, lineages, evaluations, outcomes }: { isAuthenticated: boolean; lineages: LineageReview[]; evaluations: EvaluationReview[]; outcomes: OutcomeReview[] }) {
  return <div className="research-review-grid">
    <ReviewPanel title="Saved lineage" count={lineages.length}>{!isAuthenticated ? "Authenticate to review private research records." : lineages.length === 0 ? "No persisted lineage records yet." : lineages.slice(0, 5).map((record) => <div className="review-row" key={record.id}><div><strong>{record.name}</strong><span>{record.lineageId} · generation {record.generation}</span></div><div><b className={`review-status ${record.stage}`}>{record.stage}</b><time>{new Date(record.createdAt).toLocaleDateString()}</time></div></div>)}</ReviewPanel>
    <ReviewPanel title="Saved evaluations" count={evaluations.length}>{!isAuthenticated ? "Authenticate to review private evaluation records." : evaluations.length === 0 ? "No persisted evaluation records yet." : evaluations.slice(0, 5).map((record) => <div className="review-row" key={record.id}><div><strong>{record.lineageId} · {record.version}</strong><span>Coverage {record.coverage}% · Complexity {record.complexityPenalty}%</span></div><div><b className={`review-status ${record.gateResult}`}>{record.gateResult}</b><time>{new Date(record.createdAt).toLocaleDateString()}</time></div></div>)}</ReviewPanel>
    <ReviewPanel title="Saved outcomes" count={outcomes.length}>{!isAuthenticated ? "Authenticate to review private outcome records." : outcomes.length === 0 ? "No persisted outcome records yet." : outcomes.slice(0, 5).map((record) => <div className="review-row" key={record.id}><div><strong>{record.lineageId}</strong><span>Expected {record.expectedBps} bps · Realized {record.realizedBps ?? "—"} bps</span></div><div><b className={`review-status ${record.deviation}`}>{record.deviation.replaceAll("_", " ")}</b><time>{new Date(record.createdAt).toLocaleDateString()}</time></div></div>)}</ReviewPanel>
  </div>;
}

function ReviewPanel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="review-panel"><header><span>{title}</span><b>{count} records</b></header><div className="review-list">{children}</div></section>;
}
