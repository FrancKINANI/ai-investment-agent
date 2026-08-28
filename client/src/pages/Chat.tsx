import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { startLogin } from "@/const";
import { getChatPresentation, getResearchNoteConfidenceBand } from "@/lib/chatDebate";
import { readableRole } from "@/lib/missionControl";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowRight, Bot, BrainCircuit, Check, ChevronRight, CircleAlert, ClipboardCheck, LockKeyhole, MessagesSquare, Plus, RefreshCw, Send, ShieldCheck, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import "../styles/agentRoom.css";

type MemoryScope = "shared" | "private";

function memoryKindLabel(kind: string) {
  return kind.replaceAll("_", " ");
}

export default function Chat() {
  const { user, isAuthenticated } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [threadId, setThreadId] = useState<string>();
  const [instruction, setInstruction] = useState("");
  const [memoryComposerOpen, setMemoryComposerOpen] = useState(false);
  const [memoryScope, setMemoryScope] = useState<MemoryScope>("private");
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryKind, setMemoryKind] = useState<"owner_instruction" | "constraint" | "research_note">("owner_instruction");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const agentQuery = trpc.agentFabric.nodes.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const agents = useMemo(() => (agentQuery.data ?? []).filter((agent) => agent.state === "active" && agent.roleKey !== "execution"), [agentQuery.data]);
  const selectedAgent = agents.find((agent) => agent.agentId === selectedAgentId) ?? agents.find((agent) => agent.roleKey === "supervisor");
  const isSupervisor = selectedAgent?.roleKey === "supervisor";
  const supervisorConversationsQuery = trpc.agentFabric.conversations.useQuery(undefined, { enabled: isAuthenticated && isSupervisor, retry: false });
  const individualConversationsQuery = trpc.agentMemory.conversations.useQuery({ agentId: selectedAgent?.agentId ?? "pending" }, { enabled: isAuthenticated && Boolean(selectedAgent) && !isSupervisor, retry: false });
  const activeConversations = isSupervisor ? supervisorConversationsQuery.data ?? [] : individualConversationsQuery.data ?? [];
  const messagesQuery = trpc.agentFabric.messages.useQuery({ threadId: threadId ?? "pending" }, { enabled: isAuthenticated && Boolean(threadId), retry: false });
  const evolutionQuery = trpc.agentFabric.evolution.useQuery({ threadId }, { enabled: isAuthenticated && Boolean(threadId), retry: false });
  const memoryWorkspaceQuery = trpc.agentMemory.workspace.useQuery({ agentId: selectedAgent?.agentId ?? "pending" }, { enabled: isAuthenticated && Boolean(selectedAgent) && !isSupervisor, retry: false });
  const utils = trpc.useUtils();
  const supervisorMutation = trpc.agentFabric.sendSupervisorMessage.useMutation({ onSuccess: async (data) => { setThreadId(data.threadId); await Promise.all([messagesQuery.refetch(), supervisorConversationsQuery.refetch(), evolutionQuery.refetch(), utils.agentFabric.evolution.invalidate()]); } });
  const individualMutation = trpc.agentMemory.sendIndividualMessage.useMutation({ onSuccess: async (data) => { setThreadId(data.threadId); await Promise.all([messagesQuery.refetch(), individualConversationsQuery.refetch(), evolutionQuery.refetch(), utils.agentFabric.evolution.invalidate()]); } });
  const memoryCreateMutation = trpc.agentMemory.create.useMutation({ onSuccess: async () => { setMemoryContent(""); setMemoryComposerOpen(false); await memoryWorkspaceQuery.refetch(); toast.success("Memory saved", { description: "Its scope is visible and cannot grant execution authority." }); } });
  const promotionMutation = trpc.agentMemory.requestPromotion.useMutation({ onSuccess: () => void memoryWorkspaceQuery.refetch() });
  const reviewPromotionMutation = trpc.agentMemory.reviewPromotion.useMutation({ onSuccess: () => void memoryWorkspaceQuery.refetch() });
  const activeMutation = isSupervisor ? supervisorMutation : individualMutation;

  useEffect(() => {
    if (!agents.length || selectedAgentId) return;
    const requestedAgentId = new URLSearchParams(window.location.search).get("agent");
    setSelectedAgentId(agents.some((agent) => agent.agentId === requestedAgentId) ? requestedAgentId ?? undefined : agents.find((agent) => agent.roleKey === "supervisor")?.agentId ?? agents[0]?.agentId);
  }, [agents, selectedAgentId]);
  useEffect(() => { setThreadId(undefined); setMemoryComposerOpen(false); setMemoryContent(""); }, [selectedAgent?.agentId]);
  useEffect(() => { if (!threadId && activeConversations[0]) setThreadId(activeConversations[0].threadId); }, [threadId, activeConversations]);
  useEffect(() => { const composer = composerRef.current; if (!composer) return; composer.style.height = "auto"; composer.style.height = `${Math.min(Math.max(composer.scrollHeight, 56), 176)}px`; }, [instruction]);

  const roleByAgentId = useMemo(() => new Map(agents.map((agent) => [agent.agentId, agent.roleKey])), [agents]);
  const messages = messagesQuery.data ?? [];
  const fundManagerReview = useMemo(() => isSupervisor ? [...messages].reverse().find((message) => ["fund_manager", "evaluator"].includes(roleByAgentId.get(message.agentId ?? "") ?? "")) : undefined, [isSupervisor, messages, roleByAgentId]);
  const visibleMessages = useMemo(() => messages.filter((message) => !isSupervisor || !["fund_manager", "evaluator"].includes(roleByAgentId.get(message.agentId ?? "") ?? "")), [isSupervisor, messages, roleByAgentId]);
  const memoryEntries = memoryWorkspaceQuery.data?.entries ?? [];
  const sharedMemory = memoryEntries.filter((entry) => entry.scope === "shared");
  const privateMemory = memoryEntries.filter((entry) => entry.scope === "private");

  const selectAgent = (agentId: string) => { setSelectedAgentId(agentId); window.history.replaceState(null, "", `/chat?agent=${encodeURIComponent(agentId)}`); };
  const submitMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (!selectedAgent) return toast.error("Choose an active research agent first.");
    if (instruction.trim().length < 2) return toast.error("Give the selected agent a concrete research question.");
    try {
      if (isSupervisor) await supervisorMutation.mutateAsync({ threadId, message: instruction.trim() });
      else await individualMutation.mutateAsync({ targetAgentId: selectedAgent.agentId, threadId, message: instruction.trim() });
      setInstruction("");
    } catch (error) { toast.error(`${selectedAgent.name} could not respond`, { description: error instanceof Error ? error.message : "Please retry." }); }
  };
  const saveMemory = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAgent || memoryContent.trim().length < 2) return;
    try { await memoryCreateMutation.mutateAsync({ scope: memoryScope, agentId: memoryScope === "private" ? selectedAgent.agentId : undefined, kind: memoryKind, content: memoryContent.trim(), pinned: false }); }
    catch (error) { toast.error("Memory was not saved", { description: error instanceof Error ? error.message : "Please revise the entry and retry." }); }
  };
  const requestPromotion = async (memoryId: string) => {
    try { await promotionMutation.mutateAsync({ memoryId, reason: "Owner requested a review before this private research context is shared with the team." }); toast.message("Promotion is pending review", { description: "The item remains private until an administrator approves it." }); }
    catch (error) { toast.error("Promotion could not be requested", { description: error instanceof Error ? error.message : "Please retry." }); }
  };
  const reviewPromotion = async (memoryId: string, decision: "approved" | "rejected") => {
    try { await reviewPromotionMutation.mutateAsync({ memoryId, decision, reason: decision === "approved" ? "Owner confirmed that this bounded research context may be shared with the team." : "Owner retained this context as private agent working material." }); toast.success(decision === "approved" ? "Memory shared with team" : "Memory remains private"); }
    catch (error) { toast.error("Promotion review could not be saved", { description: error instanceof Error ? error.message : "Please retry." }); }
  };
  const heading = isSupervisor ? "Coordinate the research desk." : `Talk with ${selectedAgent?.name ?? "a specialist"}.`;
  const subtitle = isSupervisor ? "The supervisor coordinates protected specialists and synthesises their research. It has no execution authority." : `${selectedAgent?.name ?? "This specialist"} receives a focused owner question, bounded role-safe context, and only its own private working memory.`;

  return <div className="agent-room-page">
    <header className="agent-room-heading"><div><span className="mission-kicker"><MessagesSquare size={14} /> AGENT ROOM</span><h1>{heading}<br /><em>Keep context visible.</em></h1><p>{subtitle}</p></div><div className="agent-room-boundary"><ShieldCheck size={16} /><div><span>FOCUSED RESEARCH</span><strong>Simulation · sealed</strong></div></div></header>
    {!isAuthenticated ? <section className="agent-room-auth"><LockKeyhole size={22} /><div><strong>Open your private research desk.</strong><span>Sign in to select an agent, open protected conversations, and inspect owner-scoped memory.</span></div><Button className="mission-primary-action" onClick={startLogin}>Sign in</Button></section> : <section className="agent-room-shell">
      <aside className="agent-room-rail" aria-label="Agent roster"><header><div><span className="mission-label">AGENT TEAM</span><h2>Choose a desk</h2></div><UsersRound size={18} /></header><div className="agent-room-agent-list">{agentQuery.isLoading ? <LoadingSkeleton label="Loading protected agent roster" lines={6} /> : agents.map((agent) => <button type="button" key={agent.agentId} className={selectedAgent?.agentId === agent.agentId ? "selected" : ""} onClick={() => selectAgent(agent.agentId)}><span><Bot size={15} /></span><div><strong>{agent.name}</strong><small>{readableRole(agent.roleKey)}</small></div><ChevronRight size={14} /></button>)}</div><footer><LockKeyhole size={13} /><span>Each desk receives only its allowed research context.</span></footer></aside>
      <main className="agent-room-conversation"><header className="agent-room-conversation-header"><div><span className="mission-label">{isSupervisor ? "SUPERVISOR THREADS" : "INDIVIDUAL THREADS"}</span><h2>{selectedAgent?.name ?? "Preparing agent…"}</h2><p>{isSupervisor ? "Team synthesis and delegation" : `${readableRole(selectedAgent?.roleKey ?? "research")} · focused research conversation`}</p></div><Button variant="outline" size="sm" onClick={() => setThreadId(undefined)}>New thread <Plus size={13} /></Button></header><div className="agent-room-thread-tabs" aria-label="Conversation threads">{(isSupervisor ? supervisorConversationsQuery.isLoading : individualConversationsQuery.isLoading) ? <span>Loading threads…</span> : activeConversations.length ? activeConversations.map((conversation) => <button type="button" key={conversation.threadId} className={threadId === conversation.threadId ? "active" : ""} onClick={() => setThreadId(conversation.threadId)}><strong>{conversation.title}</strong><small>{new Date(conversation.updatedAt).toLocaleDateString()}</small></button>) : <span>No thread yet.</span>}</div>
        {fundManagerReview && <article className="agent-room-synthesis"><ClipboardCheck size={16} /><div><span>FUND MANAGER · DISAGREEMENT REVIEW</span><p>{fundManagerReview.content}</p></div></article>}
        <div className="agent-room-messages" aria-live="polite">{messagesQuery.isLoading ? <LoadingSkeleton label="Loading conversation" lines={4} /> : !threadId ? <div className="agent-room-empty"><BrainCircuit size={31} /><strong>Start a focused research conversation.</strong><p>{isSupervisor ? "Ask the supervisor to coordinate a bounded research brief." : `Ask ${selectedAgent?.name ?? "this agent"} for a role-specific working note.`}</p></div> : visibleMessages.map((message) => { const presentation = getChatPresentation(message.actor, message.agentId, roleByAgentId); const confidence = typeof message.confidence === "number" ? getResearchNoteConfidenceBand(message.confidence) : null; return <article className={`agent-room-message ${message.actor} ${presentation.tone}`} key={message.messageId}><header><span>{message.actor === "agent" && !isSupervisor ? selectedAgent?.name ?? "Selected agent" : presentation.label}</span>{confidence && <small>Evidence completeness {message.confidence}/100 · {confidence.label}</small>}</header><p>{message.content}</p></article>; })}{activeMutation.isPending && <div className="agent-room-thinking"><RefreshCw size={14} className="spin" /> {selectedAgent?.name ?? "Agent"} is preparing a bounded research response…</div>}</div>
        <form className="agent-room-composer" onSubmit={submitMessage}><label htmlFor="agent-room-message">MESSAGE TO {selectedAgent?.name?.toUpperCase() ?? "SELECTED AGENT"}<span>⌘/Ctrl + Enter to send</span></label><div><textarea ref={composerRef} id="agent-room-message" value={instruction} onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={activeMutation.isPending || !selectedAgent} placeholder={isSupervisor ? "Ask the supervisor to coordinate a research brief…" : `Ask ${selectedAgent?.name ?? "the selected agent"} a focused research question…`} /><Button className="mission-primary-action" aria-label="Send research message" disabled={activeMutation.isPending || instruction.trim().length < 2 || !selectedAgent}><Send size={16} /><span>Send</span></Button></div><small><ShieldCheck size={12} /> The selected agent receives a bounded research context. This does not grant execution authority.</small></form>{threadId && <section className="agent-room-timeline"><span><Archive size={13} /> THREAD TRAIL</span>{evolutionQuery.data?.slice(0, 4).map((event) => <p key={event.eventId}><i className={event.state} />{event.summary}</p>)}</section>}</main>
      <aside className="agent-memory-panel" aria-label="Memory workspace"><header><div><span className="mission-label">MEMORY WORKSPACE</span><h2>Context, not guesswork</h2></div>{!isSupervisor && <Button variant="outline" size="sm" onClick={() => setMemoryComposerOpen((open) => !open)}>{memoryComposerOpen ? "Close" : "Add memory"} <Plus size={13} /></Button>}</header>{isSupervisor ? <div className="agent-memory-supervisor"><UsersRound size={22} /><strong>Team context is reviewed per specialist.</strong><p>Select a research agent to view its private working memory and the team context it is allowed to use.</p></div> : <>{memoryWorkspaceQuery.isLoading ? <LoadingSkeleton className="agent-memory-loading" label="Loading scoped memory" lines={5} /> : memoryWorkspaceQuery.isError ? <div className="agent-memory-unavailable"><CircleAlert size={19} /><strong>Memory storage is not available yet.</strong><p>The workspace stays empty until its reviewed database migration is applied. No broader context is substituted.</p></div> : <div className="agent-memory-lists"><section><header><span><UsersRound size={14} /> TEAM SHARED</span><small>{sharedMemory.length}</small></header>{sharedMemory.length ? sharedMemory.map((entry) => <article key={entry.memoryId}><span>{memoryKindLabel(entry.kind)}</span><p>{entry.preview}</p><small>{entry.pinned ? "Team shared · pinned" : "Team shared"}</small></article>) : <p className="agent-memory-empty">No owner-approved team context is stored.</p>}</section><section><header><span><Bot size={14} /> PRIVATE TO {selectedAgent?.name?.toUpperCase()}</span><small>{privateMemory.length}</small></header>{privateMemory.length ? privateMemory.map((entry) => <article key={entry.memoryId} className={entry.status === "pending_promotion" ? "pending" : ""}><span>{memoryKindLabel(entry.kind)}</span><p>{entry.preview}</p><small>{entry.status === "pending_promotion" ? "Pending team-share review" : "Private working context"}</small>{entry.status === "active" && <button type="button" onClick={() => void requestPromotion(entry.memoryId)} disabled={promotionMutation.isPending}>Request team share <ArrowRight size={12} /></button>}{entry.status === "pending_promotion" && user?.role === "admin" && <div className="agent-memory-review"><button type="button" onClick={() => void reviewPromotion(entry.memoryId, "approved")} disabled={reviewPromotionMutation.isPending}><Check size={12} /> Share</button><button type="button" onClick={() => void reviewPromotion(entry.memoryId, "rejected")} disabled={reviewPromotionMutation.isPending}>Keep private</button></div>}</article>) : <p className="agent-memory-empty">No private context is stored for this agent.</p>}</section></div>}{memoryComposerOpen && <form className="agent-memory-composer" onSubmit={saveMemory}><header><strong>Save owner context</strong><span>Scope is explicit and reviewable.</span></header><div className="agent-memory-scope"><button type="button" className={memoryScope === "private" ? "active" : ""} onClick={() => setMemoryScope("private")}>Private to {selectedAgent?.name}</button><button type="button" className={memoryScope === "shared" ? "active" : ""} onClick={() => setMemoryScope("shared")}>Team shared</button></div><select value={memoryKind} onChange={(event) => setMemoryKind(event.target.value as typeof memoryKind)} aria-label="Memory kind"><option value="owner_instruction">Owner instruction</option><option value="constraint">Constraint</option><option value="research_note">Research note</option></select><textarea value={memoryContent} onChange={(event) => setMemoryContent(event.target.value)} placeholder="Save a bounded instruction, constraint, or research note. Do not enter credentials or secret material." maxLength={3000} /><footer><small>{memoryContent.length}/3000</small><Button type="submit" size="sm" className="mission-primary-action" disabled={memoryCreateMutation.isPending || memoryContent.trim().length < 2}>Save context</Button></footer></form>}</>}</aside>
    </section>}
  </div>;
}
