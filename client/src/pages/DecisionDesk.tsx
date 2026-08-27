import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ClipboardCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

export default function DecisionDesk() {
  const { isAuthenticated } = useAuth();
  const navigate = useLocation()[1];
  const proposalsQuery = trpc.autonomy.proposals.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const proposals = proposalsQuery.data ?? [];

  return <div className="mission-subpage"><header className="mission-subpage-header"><span className="mission-kicker"><ClipboardCheck size={14} /> DECISION DESK</span><h1>Turn research into<br /><em>a deliberate decision.</em></h1><p>Evidence, disagreement, policy and risk review come before any owner decision. The real-capital execution path remains sealed.</p></header>{!isAuthenticated ? <section className="mission-auth-card"><LockKeyhole size={20} /><div><strong>Sign in to view your decision desk.</strong><span>Paper proposals and their review history are private to the owner.</span></div><Button onClick={() => navigate("/chat")}>Sign in</Button></section> : <><section className="mission-decision-status"><ShieldCheck size={18} /><div><strong>{policyQuery.data ? `${policyQuery.data.name} is the active policy context.` : "No investment policy is active."}</strong><span>{policyQuery.data ? `Version ${policyQuery.data.version} is used to frame paper proposal review.` : "Save an IPS before advancing a paper proposal through a hard gate."}</span></div><Button variant="outline" onClick={() => navigate("/settings")}>Open policy <ArrowRight size={14} /></Button></section><section className="mission-proposal-grid">{proposalsQuery.isLoading ? <p className="mission-quiet-empty">Loading recorded paper proposals…</p> : proposals.length ? proposals.map((proposal) => <article key={proposal.proposalId}><header><span className={`mission-proposal-state ${proposal.status}`}>{proposal.status}</span><small>{proposal.walletRole} · {proposal.venue}</small></header><h2>{proposal.title}</h2><p>Policy result: <strong>{proposal.policyResult}</strong></p><footer><span>Paper-only review</span><Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>Open research <ArrowRight size={13} /></Button></footer></article>) : <div className="mission-proposal-empty"><ClipboardCheck size={27} /><strong>No paper proposal is ready for review.</strong><p>Start a research brief in Agent Room. A proposal appears here only after recorded evidence and policy checks produce one.</p><Button onClick={() => navigate("/chat")}>Open Agent Room <ArrowRight size={14} /></Button></div>}</section></>}</div>;
}
