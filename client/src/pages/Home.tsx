import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
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

const emptyPolicy: PolicyDraft = { name: "", maxConcentrationBps: "", minReserveBps: "", maxTransactionBps: "", dailyMandateBps: "" };

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
  const [activeSection, setActiveSection] = useState("Control plane");
  const lastRecordedMetric = useRef<string | null>(null);

  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const runsQuery = trpc.agentRuntime.runs.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const policyMutation = trpc.policy.save.useMutation();
  const actionMutation = trpc.history.record.useMutation({ onSuccess: () => historyQuery.refetch() });
  const simulationMutation = trpc.history.startSimulation.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); } });
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

  return <div className="data-shell">
    <aside className="data-sidebar">
      <div className="data-brand"><div className="data-mark"><img src={logoUrl} alt="Ledgerline" /></div><div><strong>ledgerline</strong><span>control plane · v0.3</span></div></div>
      <div className="runtime-stamp"><span><Activity size={13} /></span><div><small>OPERATING MODE</small><strong>SIMULATION ONLY</strong></div></div>
      <div className="data-side-label">Workspaces</div>
      <nav className="data-nav"><SectionNav label="Control plane" target="control-plane" onNavigate={setActiveSection} /><SectionNav label="IPS constitution" target="ips-editor" onNavigate={setActiveSection} /><SectionNav label="On-chain viewer" target="onchain-viewer" onNavigate={setActiveSection} /><SectionNav label="Operator history" target="operator-history" onNavigate={setActiveSection} /></nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-seal"><LockKeyhole size={15} /><div><strong>Execution sealed</strong><span>No custody · no signing path</span></div></div>
      <div className="profile-strip"><div><span>{isAuthenticated ? user?.name ?? "Operator" : "Private workspace"}</span><small>{isAuthenticated ? "authenticated operator" : "sign in to persist controls"}</small></div>{isAuthenticated ? <Button variant="ghost" size="sm" onClick={() => document.getElementById("operator-history")?.scrollIntoView({ behavior: "smooth" })}>History</Button> : <Button size="sm" onClick={startLogin}>Sign in</Button>}</div>
    </aside>

    <main className="data-main">
      <header className="data-topbar"><div><span>ledgerline</span><ChevronRight size={13} /><strong>{activeSection}</strong></div><div><span className="top-scope"><Globe2 size={13} /> EVM public read-only</span><span className="top-scope"><ShieldCheck size={13} /> policy-first</span>{isAuthenticated ? <span className="top-user">{user?.name ?? "Operator"}</span> : <Button size="sm" onClick={startLogin}>Authenticate to save</Button>}</div></header>

      <div className="data-content">
        <section id="control-plane" className="control-hero"><div className="grid-wash" /><div className="control-copy"><span><Activity size={13} /> DATA-BACKED OPERATOR CONTROL PLANE</span><h1>Observe live data.<br /><em>Keep the mandate human.</em></h1><p>Public market and chain metrics are queried server-side. Policies and operator actions become durable records only after authentication. No live execution path exists.</p><div className="control-actions"><Button className="primary-mint" onClick={startSimulation}><Play size={14} fill="currentColor" /> Start policy-bound simulation</Button><Button variant="outline" onClick={checkScopes}><ShieldCheck size={14} /> Audit read-only scopes</Button></div></div><div className="control-statboard"><div><span>POLICY</span><strong>{policyReady ? `v${policyQuery.data?.version}` : "Not set"}</strong></div><div><span>SIMULATIONS</span><strong>{isAuthenticated ? runCount : "—"}</strong></div><div><span>DATA MODE</span><strong>Public</strong></div><div><span>EXECUTION</span><strong className="blocked">Sealed</strong></div></div></section>

        <section className="source-band"><div><Database size={16} /><div><strong>Live-data provenance</strong><span>Blockscout public API for ERC-20 metadata and explorer figures · DexScreener public API for DEX metrics</span></div></div><span><Check size={13} /> No provider keys configured</span></section>

        <section id="ips-editor" className="workspace-section"><div className="section-heading"><div><span>Owner governance</span><h2>Investment Policy Statement</h2><p>Set the limits the system may evaluate against. This policy is stored per owner and its execution mode is locked to simulation.</p></div><div className="heading-state"><ShieldCheck size={15} /> {policyReady ? `Saved version ${policyQuery.data?.version}` : "No saved IPS"}</div></div>
          {!isAuthenticated && <div className="auth-callout"><LockKeyhole size={17} /><div><strong>Authentication required for persistence.</strong><span>You can inspect live public data without signing in; sign in to save an IPS or operator history.</span></div><Button onClick={startLogin}>Sign in</Button></div>}
          <form className="ips-layout" onSubmit={savePolicy}><div className="ips-card ips-main"><label>Policy name<input value={policyDraft.name} onChange={(event) => setPolicyDraft({ ...policyDraft, name: event.target.value })} placeholder="e.g. Core on-chain pilot" disabled={!isAuthenticated} /></label><div className="limit-grid"><label>Max concentration <div><input type="number" min="1" max="10000" value={policyDraft.maxConcentrationBps} onChange={(event) => setPolicyDraft({ ...policyDraft, maxConcentrationBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>{policyDraft.maxConcentrationBps ? bpsToPercent(Number(policyDraft.maxConcentrationBps)) : "Enter a limit"}</small></label><label>Minimum reserve <div><input type="number" min="0" max="10000" value={policyDraft.minReserveBps} onChange={(event) => setPolicyDraft({ ...policyDraft, minReserveBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>{policyDraft.minReserveBps ? bpsToPercent(Number(policyDraft.minReserveBps)) : "Enter a limit"}</small></label><label>Max transaction <div><input type="number" min="1" max="10000" value={policyDraft.maxTransactionBps} onChange={(event) => setPolicyDraft({ ...policyDraft, maxTransactionBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>Per proposal</small></label><label>Daily mandate <div><input type="number" min="1" max="10000" value={policyDraft.dailyMandateBps} onChange={(event) => setPolicyDraft({ ...policyDraft, dailyMandateBps: event.target.value })} disabled={!isAuthenticated} /><span>bps</span></div><small>Aggregate simulation cap</small></label></div></div><div className="ips-card asset-card"><div><span>Approved asset universe</span><p>Full Ethereum token contracts only. The on-chain viewer will use these as inspectable candidates; no contract grants authority.</p></div><div className="asset-entry"><input value={assetDraft} onChange={(event) => setAssetDraft(event.target.value)} placeholder="0x… token contract" disabled={!isAuthenticated} /><Button type="button" size="icon" onClick={addAsset} disabled={!isAuthenticated}><Plus size={16} /></Button></div><div className="asset-list">{allowedAssets.length === 0 ? <span className="empty-copy">No contracts approved yet.</span> : allowedAssets.map((asset) => <span key={asset}>{asset.slice(0, 10)}…{asset.slice(-8)}<button type="button" aria-label={`Remove ${asset}`} onClick={() => setAllowedAssets((assets) => assets.filter((entry) => entry !== asset))}><Trash2 size={12} /></button></span>)}</div><div className="ips-footer"><span><LockKeyhole size={13} /> Execution mode: simulation-only</span><Button className="primary-mint" type="submit" disabled={!isAuthenticated || policyMutation.isPending}>{policyMutation.isPending ? "Saving" : "Save IPS"}</Button></div></div></form></section>

        <section id="onchain-viewer" className="workspace-section"><div className="section-heading"><div><span>Public chain data</span><h2>Read-only Ethereum token viewer</h2><p>Paste any ERC-20 contract address to query live metadata, holder figures, and the highest-liquidity DEX market record. No wallet address is requested.</p></div><div className="heading-state"><Globe2 size={15} /> chain.read · market.read</div></div><div className="onchain-layout"><div className="onchain-query"><form onSubmit={loadToken}><label>Ethereum token contract<input value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} placeholder="0x…" /></label><Button className="primary-mint" type="submit" disabled={tokenQuery.isFetching}>{tokenQuery.isFetching ? <RefreshCw size={14} className="spin" /> : <SearchIcon />} {tokenQuery.isFetching ? "Loading live data" : "Load live metrics"}</Button></form><Button type="button" variant="outline" className="policy-asset-shortcut" onClick={loadFirstPolicyAsset} disabled={!policyQuery.data?.allowedAssets.length}>Load first IPS asset</Button><div className="scope-proof"><ShieldCheck size={15} /><div><strong>Authorized scopes</strong><span>Public `chain.read` and `market.read` only. No `execution.request`, wallet, or signing scope is present.</span></div></div>{tokenQuery.error && <div className="data-error"><CircleAlert size={16} /> {tokenQuery.error.message}</div>}</div><div className="live-metric-card">{tokenQuery.data ? <><div className="token-heading"><div><span>{tokenQuery.data.token.symbol}</span><strong>{tokenQuery.data.token.name}</strong><small>{tokenQuery.data.token.address}</small></div><a href={`https://eth.blockscout.com/token/${tokenQuery.data.token.address}`} target="_blank" rel="noreferrer">Explorer <ArrowUpRight size={13} /></a></div><div className="metric-grid"><div><span>Price</span><strong>{money(tokenQuery.data.market?.priceUsd ?? tokenQuery.data.token.explorerPriceUsd)}</strong><small>{tokenQuery.data.market?.dex ?? "Explorer reference"}</small></div><div><span>24h volume</span><strong>{money(tokenQuery.data.market?.volume24h ?? tokenQuery.data.token.explorerVolume24h)}</strong><small>public source</small></div><div><span>Liquidity</span><strong>{money(tokenQuery.data.market?.liquidityUsd)}</strong><small>highest-liquidity pair</small></div><div><span>Holders</span><strong>{compactNumber(tokenQuery.data.token.holders)}</strong><small>Blockscout</small></div><div><span>24h change</span><strong>{tokenQuery.data.market?.priceChange24h === null || tokenQuery.data.market?.priceChange24h === undefined ? "Unavailable" : `${tokenQuery.data.market.priceChange24h.toFixed(2)}%`}</strong><small>DEX pair</small></div><div><span>Market cap</span><strong>{money(tokenQuery.data.token.marketCap)}</strong><small>explorer supplied</small></div></div><div className="metric-foot"><span>Fetched {new Date(tokenQuery.data.fetchedAt).toLocaleTimeString()}</span><span>{tokenQuery.data.sources.explorer} · {tokenQuery.data.sources.market}</span></div></> : <div className="metric-empty"><Landmark size={23} /><strong>Load a real contract to inspect live metrics.</strong><span>No demo price, balance, liquidity, or holder figure is displayed before a public-source response succeeds.</span></div>}</div></div></section>

        <section id="operator-history" className="workspace-section"><div className="section-heading"><div><span>Immutable review trail</span><h2>Operator action history</h2><p>Policy saves, simulations, data views, and scope audits are persisted for the authenticated owner. No event is seeded into this view.</p></div><div className="heading-state"><History size={15} /> {isAuthenticated ? `${historyQuery.data?.length ?? 0} saved records` : "Sign in to view"}</div></div>{isAuthenticated ? <div className="history-panel">{historyQuery.isLoading ? <div className="history-empty">Loading durable operator records…</div> : (historyQuery.data?.length ?? 0) === 0 ? <div className="history-empty"><FileCheck2 size={20} /><strong>No operator actions saved yet.</strong><span>Save an IPS, query a token, run a scope audit, or start a simulation to create the first durable record.</span></div> : historyQuery.data?.map((item) => <div className="history-row" key={item.actionId}><span className={`history-dot status-${item.status}`} /><time>{new Date(item.createdAt).toLocaleString()}</time><div><strong>{item.subject}</strong><p>{item.detail}</p></div><span className="history-kind">{item.kind.replaceAll("_", " ")}</span></div>)}</div> : <div className="history-empty guarded"><LockKeyhole size={20} /><strong>Your history remains private.</strong><span>Authenticate to create and review the operator-owned audit trail.</span><Button onClick={startLogin}>Authenticate</Button></div>}</section>
        <footer className="data-footer"><span>LEDGERLINE / DATA-BACKED CONTROL PLANE</span><span>PUBLIC READ-ONLY DATA · PERSISTENT OWNER RECORDS · EXECUTION SEALED</span></footer>
      </div>
    </main>
  </div>;
}

function SearchIcon() { return <Gauge size={14} />; }
