import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowRight, Bot, BrainCircuit, CircleAlert, Eye, Gauge, Landmark, LockKeyhole, MessageSquareText, Network, Radar, RefreshCw, Send, ShieldAlert, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { ResearchBrief } from "./Home";

const isEthereumAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const agentDefinitions = [
  { id: "supervisor", label: "Supervisor", role: "coordinates the operating loop", icon: BrainCircuit },
  { id: "discovery", label: "Discovery", role: "scans candidate markets", icon: Radar },
  { id: "onchain", label: "On-chain", role: "builds evidence packets", icon: Network },
  { id: "risk", label: "Risk", role: "vetoes policy breaches", icon: ShieldAlert },
  { id: "portfolio", label: "Portfolio", role: "tracks mandate exposure", icon: WalletCards },
  { id: "venue", label: "Venue", role: "routes permitted actions", icon: Landmark },
];

export default function CommandCenter() {
  const { isAuthenticated } = useAuth();
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("Scout the available evidence, identify the most important risks, and explain whether this candidate is eligible for a paper proposal.");
  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const runsQuery = trpc.agentRuntime.runs.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const proposalsQuery = trpc.autonomy.proposals.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const catalogQuery = trpc.agentRuntime.catalog.useQuery(undefined, { retry: false });
  const simulationMutation = trpc.history.startSimulation.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); } });
  const researchMutation = trpc.research.analyzeToken.useMutation({ onSuccess: () => { historyQuery.refetch(); runsQuery.refetch(); proposalsQuery.refetch(); } });
  const approveMutation = trpc.autonomy.approveProposal.useMutation({ onSuccess: () => { proposalsQuery.refetch(); historyQuery.refetch(); } });
  const rejectMutation = trpc.autonomy.rejectProposal.useMutation({ onSuccess: () => { proposalsQuery.refetch(); historyQuery.refetch(); } });
  const settleMutation = trpc.autonomy.settleSimulation.useMutation({ onSuccess: () => { proposalsQuery.refetch(); historyQuery.refetch(); runsQuery.refetch(); } });
  const working = researchMutation.isPending;
  const policyReady = Boolean(policyQuery.data);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (!isEthereumAddress(address.trim())) return toast.error("Enter an Ethereum ERC-20 contract address to begin evidence-bound research.");
    if (message.trim().length < 8) return toast.error("Give the supervisor a concrete question.");
    try {
      await researchMutation.mutateAsync({ address: address.trim(), question: message.trim() });
      toast.success("Supervisor cycle completed", { description: "The evidence, policy result, and proposal state are now in your audit trail." });
    } catch (error) {
      toast.error("The agent cycle could not finish", { description: error instanceof Error ? error.message : "Please retry." });
    }
  };

  const startSimulation = async () => {
    if (!isAuthenticated) return startLogin();
    if (!policyQuery.data) return toast.error("A saved IPS is required before a paper simulation can start.");
    await simulationMutation.mutateAsync({ policyVersion: policyQuery.data.version });
    toast.success("Paper simulation recorded", { description: "No external venue action was requested." });
  };

  const approveProposal = async (proposalId: string) => {
    try { await approveMutation.mutateAsync({ proposalId }); toast.success("Paper proposal approved", { description: "It is now ready for a simulated adapter settlement." }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Approval failed."); }
  };
  const rejectProposal = async (proposalId: string) => {
    try { await rejectMutation.mutateAsync({ proposalId, reason: "Owner rejected the paper proposal from the command center." }); toast.message("Paper proposal rejected"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Rejection failed."); }
  };
  const settleProposal = async (proposalId: string) => {
    try { await settleMutation.mutateAsync({ proposalId }); toast.success("Simulated adapter settled", { description: "No external venue request was made." }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Simulation settlement failed."); }
  };

  return <div className="command-page">
    <section className="command-hero"><div><span className="eyebrow"><Sparkles size={14} /> AUTONOMOUS COMMAND CENTER</span><h1>See the system <em>think, decide, and act</em> within your mandates.</h1><p>The supervisor coordinates specialised agents across research, risk, portfolio, and venue operations. Every action remains simulation-first until you explicitly arm a named wallet-and-venue mandate.</p></div><div className="hero-authority"><span>GLOBAL AUTHORITY</span><strong>Simulation default</strong><p>{policyReady ? `IPS ${policyQuery.data?.name} v${policyQuery.data?.version} is active.` : "No IPS is active. No proposal can advance."}</p><Button variant="outline" onClick={() => document.location.assign("/settings")}>Review authority <ArrowRight size={14} /></Button></div></section>
    <section className="mandate-strip"><div><span className="strip-label">WALLET MANDATES</span><strong>Two wallet roles are ready to configure.</strong><p>Trading and long-term investment roles are disconnected until you add a real wallet mandate.</p></div><div className="mandate-card"><WalletCards size={17} /><div><span>Trading wallet</span><strong>Not configured</strong></div><b>Simulation</b></div><div className="mandate-card"><Landmark size={17} /><div><span>Investment wallet</span><strong>Not configured</strong></div><b>Simulation</b></div></section>
    <section className="command-grid"><div className="supervisor-panel"><header><div><span className="eyebrow">SUPERVISOR CONSOLE</span><h2>Give the fabric an operating brief.</h2></div><div className="agent-presence"><i className={working ? "pulse" : ""} /> {working ? "delegating tasks" : "ready"}</div></header>{!isAuthenticated && <div className="command-auth"><LockKeyhole size={16} /><span>Sign in to send an instruction and persist the autonomous run.</span><Button size="sm" onClick={startLogin}>Sign in</Button></div>}<form onSubmit={submit}><label>Candidate contract<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x… ERC-20 contract" disabled={!isAuthenticated || working} /></label><label>Instruction to the supervisor<textarea value={message} onChange={(event) => setMessage(event.target.value)} disabled={!isAuthenticated || working} /></label><div className="console-footer"><span><ShieldCheck size={14} /> {policyReady ? "IPS and risk gate will inspect the proposal." : "Research may run, but no policy-bound proposal can advance yet."}</span><Button className="command-send" disabled={!isAuthenticated || working}>{working ? <RefreshCw size={14} className="spin" /> : <Send size={14} />} {working ? "Fabric working" : "Run agent cycle"}</Button></div></form>{researchMutation.error && <div className="command-error"><CircleAlert size={15} /> {researchMutation.error.message}</div>}</div>
      <div className="fabric-panel"><header><div><span className="eyebrow">AGENT FABRIC</span><h2>Autonomy is inspectable.</h2></div><Network size={18} /></header><div className="fabric-map">{agentDefinitions.map((agent, index) => { const Icon = agent.icon; const status = working && [0, 1, 2].includes(index) ? "working" : researchMutation.data && index < 4 ? "completed" : "idle"; return <div key={agent.id} className={`fabric-node ${status}`}><div><Icon size={16} /></div><span>{agent.label}</span><small>{status === "working" ? "working" : status === "completed" ? "evidence ready" : agent.role}</small></div>; })}</div><footer><span><Eye size={14} /> {catalogQuery.data ? `${catalogQuery.data.providers.reduce((count, provider) => count + provider.models.length, 0)} configured model options` : "Loading model catalog…"}</span><span>no execution credential exposed</span></footer></div></section>
    {researchMutation.data && <section className="command-report"><ResearchBrief result={researchMutation.data} onStartSimulation={() => toast.message("Review the proposal queue below before starting a paper lifecycle.")} /></section>}
    <section className="proposal-panel"><div><span className="eyebrow">PERSISTED PROPOSAL QUEUE</span><h2>{(proposalsQuery.data?.length ?? 0) > 0 ? "Owner approval controls the next step." : "No active proposal."}</h2><p>{(proposalsQuery.data?.length ?? 0) > 0 ? "A proposal is never sent to a venue automatically. Approve it for simulated execution, reject it, or settle an already-approved paper lifecycle." : "When you run the agent cycle, a candidate’s evidence, policy result, risks, and permitted next step will appear here. Ledgerline will not manufacture a trade, balance, or fill before an actual run exists."}</p>{proposalsQuery.data?.slice(0, 3).map((proposal) => <div className="proposal-row" key={proposal.proposalId}><div><span>{proposal.walletRole} · {proposal.venue} · {proposal.policyResult}</span><strong>{proposal.title}</strong><small>{proposal.status}</small></div><div className="proposal-actions">{proposal.status === "review" && <><Button size="sm" className="command-send" disabled={approveMutation.isPending} onClick={() => void approveProposal(proposal.proposalId)}>Approve paper</Button><Button size="sm" variant="outline" disabled={rejectMutation.isPending} onClick={() => void rejectProposal(proposal.proposalId)}>Reject</Button></>}{proposal.status === "approved" && <Button size="sm" className="command-send" disabled={settleMutation.isPending} onClick={() => void settleProposal(proposal.proposalId)}>Settle simulation</Button>}{proposal.status === "simulated" && <span className="proposal-final">Simulated</span>}{proposal.status === "blocked" && <span className="proposal-blocked">Policy blocked</span>}{proposal.status === "rejected" && <span className="proposal-final">Rejected</span>}</div></div>)}</div><Gauge size={28} /></section>
    <section className="activity-snapshot"><header><div><span className="eyebrow">LIVE AUDIT SNAPSHOT</span><h2>Every decision leaves a trace.</h2></div><Button variant="outline" onClick={() => document.location.assign("/activity")}>Open activity log <ArrowRight size={14} /></Button></header>{isAuthenticated && (historyQuery.data?.length ?? 0) > 0 ? <div className="snapshot-list">{historyQuery.data?.slice(0, 4).map((item) => <div key={item.actionId}><i className={`status-${item.status}`} /><time>{new Date(item.createdAt).toLocaleTimeString()}</time><span>{item.subject}</span><small>{item.kind.replaceAll("_", " ")}</small></div>)}</div> : <div className="snapshot-empty"><MessageSquareText size={20} /><span>{isAuthenticated ? "No owner events exist yet. Your first agent cycle will create a durable trail." : "Your activity trail is private. Sign in to begin an autonomous, auditable cycle."}</span></div>}</section>
  </div>;
}
