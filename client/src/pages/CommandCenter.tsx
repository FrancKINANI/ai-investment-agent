import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowRight, CircleAlert, Gauge, Landmark, MessageSquareText, Plus, Radar, RefreshCw, Send, ShieldAlert, ShieldCheck, Sparkles, Target, WalletCards, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const isEthereumAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

export { getChatPresentation } from "@/lib/chatDebate";

export default function CommandCenter() {
  const { isAuthenticated } = useAuth();
  const [watchlistName, setWatchlistName] = useState("");
  const [watchlistItem, setWatchlistItem] = useState({ label: "", address: "" });
  const [address, setAddress] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("Identify the most important risks and explain whether this token can enter a paper-proposal review.");
  const researchComposerRef = useRef<HTMLTextAreaElement>(null);
  const watchlistsQuery = trpc.watchlists.lists.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const proposalsQuery = trpc.autonomy.proposals.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createWatchlistMutation = trpc.watchlists.create.useMutation({ onSuccess: () => watchlistsQuery.refetch() });
  const addWatchlistItemMutation = trpc.watchlists.addItem.useMutation({ onSuccess: () => watchlistsQuery.refetch() });
  const removeWatchlistItemMutation = trpc.watchlists.removeItem.useMutation({ onSuccess: () => watchlistsQuery.refetch() });
  const evaluateWatchlistMutation = trpc.watchlists.evaluatePolicy.useMutation({ onSuccess: () => watchlistsQuery.refetch() });
  const updateWatchlistScopeMutation = trpc.watchlists.updateScope.useMutation({ onSuccess: () => watchlistsQuery.refetch() });
  const researchMutation = trpc.research.analyzeToken.useMutation({ onSuccess: () => { historyQuery.refetch(); proposalsQuery.refetch(); } });
  const approveMutation = trpc.autonomy.approveProposal.useMutation({ onSuccess: () => { proposalsQuery.refetch(); historyQuery.refetch(); } });
  const rejectMutation = trpc.autonomy.rejectProposal.useMutation({ onSuccess: () => { proposalsQuery.refetch(); historyQuery.refetch(); } });
  const settleMutation = trpc.autonomy.settleSimulation.useMutation({ onSuccess: () => { proposalsQuery.refetch(); historyQuery.refetch(); } });
  const policyReady = Boolean(policyQuery.data);
  const selectedList = watchlistsQuery.data?.lists[0];

  useEffect(() => {
    const composer = researchComposerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(Math.max(composer.scrollHeight, 62), 176)}px`;
  }, [researchQuestion]);

  const addWatchlist = async (event: FormEvent) => {
    event.preventDefault();
    if (!watchlistName.trim()) return;
    await createWatchlistMutation.mutateAsync({ name: watchlistName.trim() });
    setWatchlistName("");
  };

  const addWatchlistItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedList) return toast.error("Create a watchlist before adding an asset.");
    if (watchlistItem.label.trim().length < 2) return toast.error("Give this watchlist item a clear label.");
    if (watchlistItem.address.trim() && !isEthereumAddress(watchlistItem.address.trim())) return toast.error("Use a valid Ethereum contract address or leave the address empty.");
    await addWatchlistItemMutation.mutateAsync({ watchlistId: selectedList.watchlistId, label: watchlistItem.label.trim(), address: watchlistItem.address.trim() || undefined, chain: watchlistItem.address.trim() ? "ethereum" : undefined });
    setWatchlistItem({ label: "", address: "" });
  };

  const runEvidenceResearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (!isEthereumAddress(address.trim())) return toast.error("Enter an Ethereum ERC-20 contract address for evidence-bound research.");
    try {
      await researchMutation.mutateAsync({ address: address.trim(), question: researchQuestion.trim() });
      toast.success("Evidence research completed", { description: "A simulation-only proposal state is now visible in the queue." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Research could not finish."); }
  };

  return <div className="command-page command-page-next">
    <section className="command-hero command-hero-next"><div><span className="eyebrow"><Sparkles size={14} /> SUPERVISOR WORKSPACE</span><h1>Talk to the fabric. <em>Watch it evolve.</em></h1><p>The supervisor records the work it delegates across protected TradingAgents roles. Every finding stays source-bound, policy-governed, and simulation-only.</p></div><div className="hero-authority"><span>GLOBAL AUTHORITY</span><strong>Simulation default</strong><p>{policyReady ? `IPS ${policyQuery.data?.name} v${policyQuery.data?.version} is active.` : "No IPS is active. The fabric may research, but cannot advance a proposal."}</p><Button variant="outline" onClick={() => document.location.assign("/settings")}>Configure fabric <ArrowRight size={14} /></Button></div></section>

    <section className="mandate-strip"><div><span className="strip-label">WALLET MANDATES</span><strong>Trading and investment roles remain separate.</strong><p>No keys, account connections, or real-mode authority are exposed to agents.</p></div><div className="mandate-card"><WalletCards size={17} /><div><span>Trading wallet</span><strong>Simulation only</strong></div><b>sealed</b></div><div className="mandate-card"><Landmark size={17} /><div><span>Investment wallet</span><strong>Simulation only</strong></div><b>sealed</b></div></section>

    <section className="watchlist-cockpit"><header><div><span className="eyebrow">DISCOVERY UNIVERSE</span><h2>Watchlists tell the agents <em>where</em> to look.</h2><p>Contract items are evaluated against your IPS approved universe; scheduled discovery remains inactive until deployment and an owner activation step.</p></div><Target size={25} /></header>{watchlistsQuery.isLoading ? <LoadingSkeleton className="watchlist-loading-skeleton" label="Loading watchlists and discovery state" lines={4} /> : <div className="watchlist-grid"><div className="watchlist-list"><form onSubmit={addWatchlist}><label>New watchlist<input value={watchlistName} onChange={(event) => setWatchlistName(event.target.value)} placeholder="Core on-chain candidates" disabled={!isAuthenticated || createWatchlistMutation.isPending} /></label><Button variant="outline" disabled={!isAuthenticated || createWatchlistMutation.isPending}><Plus size={14} /> Add list</Button></form><div>{watchlistsQuery.data?.lists.map((list) => <article key={list.watchlistId}><span><Radar size={14} /> {list.name}</span><small>{String((list.criteria as { evidenceStandard?: string }).evidenceStandard ?? "balanced")} evidence</small></article>)}{!(watchlistsQuery.data?.lists.length) && <p className="watchlist-empty">Create a watchlist to bound future signal scanning and daily discovery.</p>}</div></div><div className="watchlist-items"><form onSubmit={addWatchlistItem}><label>Candidate / token<input value={watchlistItem.label} onChange={(event) => setWatchlistItem((current) => ({ ...current, label: event.target.value }))} placeholder="ETH or a project name" disabled={!isAuthenticated || !selectedList} /></label><label>EVM contract (optional)<input value={watchlistItem.address} onChange={(event) => setWatchlistItem((current) => ({ ...current, address: event.target.value }))} placeholder="0x…" disabled={!isAuthenticated || !selectedList} /></label><Button className="command-send" disabled={!isAuthenticated || !selectedList || addWatchlistItemMutation.isPending}><Plus size={14} /> Monitor</Button></form><div className="watchlist-actions"><Button variant="outline" disabled={!isAuthenticated || !watchlistsQuery.data?.items.length || evaluateWatchlistMutation.isPending} onClick={() => void evaluateWatchlistMutation.mutateAsync()}>{evaluateWatchlistMutation.isPending ? <RefreshCw size={13} className="spin" /> : <ShieldCheck size={13} />} Evaluate IPS status</Button><label>Evidence standard<select disabled={!isAuthenticated || !selectedList || updateWatchlistScopeMutation.isPending} value={String((selectedList?.criteria as { evidenceStandard?: string } | undefined)?.evidenceStandard ?? "balanced")} onChange={(event) => selectedList && void updateWatchlistScopeMutation.mutateAsync({ watchlistId: selectedList.watchlistId, chains: ["ethereum"], evidenceStandard: event.target.value as "strict" | "balanced" })}><option value="strict">Strict</option><option value="balanced">Balanced</option></select></label><small>{policyReady ? "Candidate = approved contract; blocked = outside IPS; review = insufficient scope." : "No IPS: all candidates remain under review."}</small></div><div className="watchlist-chip-row">{watchlistsQuery.data?.items.map((item) => <span key={item.itemId}><i className={`status-${item.status === "blocked" ? "blocked" : item.status === "review" ? "review" : "success"}`} />{item.label}<em>{item.status}</em><button aria-label={`Remove ${item.label}`} onClick={() => void removeWatchlistItemMutation.mutateAsync({ itemId: item.itemId })}><X size={12} /></button></span>)}</div></div><div className="discovery-status"><span>DISCOVERY STATUS</span><strong>Inactive by default</strong><p>{watchlistsQuery.data?.findings.length ? `${watchlistsQuery.data.findings.length} recorded source-bound findings` : "No scheduled finding exists yet."}</p><Button variant="outline" onClick={() => document.location.assign("/settings")}>Configure cadence <ArrowRight size={14} /></Button></div></div>}</section>

    <section className="evidence-lab"><header><div><span className="eyebrow">EVIDENCE LAB</span><h2>Turn a specific contract into a paper candidate.</h2></div><ShieldCheck size={20} /></header><form className="command-research-composer" onSubmit={runEvidenceResearch}><label className="contract-address-field">Ethereum ERC-20 contract<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" disabled={!isAuthenticated || researchMutation.isPending} /></label><div className="command-chatgpt-shell"><button type="button" className="chatgpt-plus" aria-label="Evidence research tools" title="Evidence research tools"><Plus size={19} /></button><textarea ref={researchComposerRef} aria-label="Research question" value={researchQuestion} onChange={(event) => setResearchQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={!isAuthenticated || researchMutation.isPending} placeholder="Ask about a contract…" /><span className="chatgpt-mode">Evidence</span><Button className="command-send command-chatgpt-send" aria-label="Run evidence research" disabled={!isAuthenticated || researchMutation.isPending}>{researchMutation.isPending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}<span>Research</span></Button></div><small>Enter adds a line · ⌘/Ctrl+Enter runs a simulation-only evidence review.</small></form>{researchMutation.error && <div className="command-error"><CircleAlert size={15} /> {researchMutation.error.message}</div>}</section>

    <section className="proposal-panel"><div><span className="eyebrow">PERSISTED PROPOSAL QUEUE</span><h2>{proposalsQuery.isLoading ? "Loading paper proposals…" : (proposalsQuery.data?.length ?? 0) > 0 ? "Owner approval controls the next step." : "No active paper proposal."}</h2><p>Fabric outputs do not reach a venue automatically. A policy-passing research result requires explicit owner approval before simulated settlement.</p>{proposalsQuery.isLoading ? <LoadingSkeleton className="proposal-loading-skeleton" label="Loading paper proposals" lines={2} /> : proposalsQuery.data?.slice(0, 4).map((proposal) => <div className="proposal-row" key={proposal.proposalId}><div><span>{proposal.walletRole} · {proposal.venue} · {proposal.policyResult}</span><strong>{proposal.title}</strong><small>{proposal.status}</small></div><div className="proposal-actions">{proposal.status === "review" && <><Button size="sm" className="command-send" disabled={approveMutation.isPending} onClick={() => void approveMutation.mutateAsync({ proposalId: proposal.proposalId })}>Approve paper</Button><Button size="sm" variant="outline" disabled={rejectMutation.isPending} onClick={() => void rejectMutation.mutateAsync({ proposalId: proposal.proposalId, reason: "Owner rejected the paper proposal from the command center." })}>Reject</Button></>}{proposal.status === "approved" && <Button size="sm" className="command-send" disabled={settleMutation.isPending} onClick={() => void settleMutation.mutateAsync({ proposalId: proposal.proposalId })}>Settle simulation</Button>}{proposal.status === "simulated" && <span className="proposal-final">Simulated</span>}{proposal.status === "blocked" && <span className="proposal-blocked">Policy blocked</span>}{proposal.status === "rejected" && <span className="proposal-final">Rejected</span>}</div></div>)}</div><Gauge size={28} /></section>

    <section className="activity-snapshot"><header><div><span className="eyebrow">IMMUTABLE ACTIVITY</span><h2>Every configuration and agent event leaves a trace.</h2></div><Button variant="outline" onClick={() => document.location.assign("/activity")}>Open activity log <ArrowRight size={14} /></Button></header>{isAuthenticated && (historyQuery.data?.length ?? 0) > 0 ? <div className="snapshot-list">{historyQuery.data?.slice(0, 5).map((item) => <div key={item.actionId}><i className={`status-${item.status}`} /><time>{new Date(item.createdAt).toLocaleTimeString()}</time><span>{item.subject}</span><small>{item.kind.replaceAll("_", " ")}</small></div>)}</div> : <div className="snapshot-empty"><MessageSquareText size={20} /><span>{isAuthenticated ? "No owner events exist yet. Your first message, watchlist, or research cycle will create a durable trail." : "Your operating history is private. Sign in to begin."}</span></div>}</section>
  </div>;
}
