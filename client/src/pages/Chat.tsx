import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { startLogin } from "@/const";
import { ChatFilter, getChatPresentation, getResearchNoteConfidenceBand, matchesChatFilter } from "@/lib/chatDebate";
import { trpc } from "@/lib/trpc";
import { BrainCircuit, ClipboardCheck, LockKeyhole, Plus, RefreshCw, Send, ShieldCheck } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const filters: { value: ChatFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bull", label: "Bull" },
  { value: "bear", label: "Bear" },
  { value: "supervisor", label: "Supervisor" },
];

export default function Chat() {
  const { isAuthenticated } = useAuth();
  const [threadId, setThreadId] = useState<string>();
  const [instruction, setInstruction] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const agentQuery = trpc.agentFabric.nodes.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const conversationsQuery = trpc.agentFabric.conversations.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const messagesQuery = trpc.agentFabric.messages.useQuery({ threadId: threadId ?? "pending" }, { enabled: isAuthenticated && Boolean(threadId), retry: false });
  const evolutionQuery = trpc.agentFabric.evolution.useQuery({ threadId }, { enabled: isAuthenticated && Boolean(threadId), retry: false });
  const chatMutation = trpc.agentFabric.sendSupervisorMessage.useMutation({
    onSuccess: async (data) => {
      setThreadId(data.threadId);
      await Promise.all([messagesQuery.refetch(), conversationsQuery.refetch(), evolutionQuery.refetch()]);
    },
  });
  const roleByAgentId = useMemo(() => new Map(agentQuery.data?.map((agent) => [agent.agentId, agent.roleKey]) ?? []), [agentQuery.data]);
  const messages = messagesQuery.data ?? [];
  const fundManagerReview = useMemo(() => [...messages].reverse().find((message) => roleByAgentId.get(message.agentId ?? "") === "fund_manager"), [messages, roleByAgentId]);
  const filteredMessages = useMemo(() => messages.filter((message) => roleByAgentId.get(message.agentId ?? "") !== "fund_manager" && matchesChatFilter(filter, message.actor, message.agentId, roleByAgentId)), [filter, messages, roleByAgentId]);

  useEffect(() => {
    if (!threadId && conversationsQuery.data?.[0]) setThreadId(conversationsQuery.data[0].threadId);
  }, [threadId, conversationsQuery.data]);

  const submitSupervisorMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (instruction.trim().length < 2) return toast.error("Give the supervisor a concrete operating brief.");
    try {
      await chatMutation.mutateAsync({ threadId, message: instruction.trim() });
      setInstruction("");
    } catch (error) {
      toast.error("The supervisor could not respond", { description: error instanceof Error ? error.message : "Please retry." });
    }
  };

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(Math.max(composer.scrollHeight, 56), 176)}px`;
  }, [instruction]);

  return <div className="solo-chat-page">
    <header className="solo-chat-heading"><div><span className="eyebrow">SUPERVISOR CONVERSATION</span><h1>Debate the thesis.<br /><em>Keep the authority bounded.</em></h1><p>Persistent owner-scoped research conversation. Bull and Bear notes remain visibly distinct, while the Fund Manager records the disagreement without approving an execution.</p></div><div className="solo-chat-status"><span><i className={chatMutation.isPending ? "pulse" : ""} /> {chatMutation.isPending ? "delegating research" : "research fabric ready"}</span><small>simulation-only</small></div></header>

    {!isAuthenticated ? <section className="chat-auth-card"><LockKeyhole size={20} /><div><strong>Private conversation workspace</strong><span>Sign in to open a thread, persist the audit trail, and coordinate protected agents.</span></div><Button onClick={startLogin}>Sign in to chat</Button></section> : <section className="solo-chat-shell">
      <aside className="chat-thread-rail" aria-label="Conversation threads"><div><span className="eyebrow">THREADS</span><Button variant="outline" size="sm" onClick={() => setThreadId(undefined)}>New brief</Button></div><nav>{conversationsQuery.isLoading ? <LoadingSkeleton className="thread-loading-skeleton" label="Loading conversation threads" lines={3} /> : <>{conversationsQuery.data?.map((conversation) => <button type="button" key={conversation.threadId} className={conversation.threadId === threadId ? "active" : ""} onClick={() => setThreadId(conversation.threadId)}><strong>{conversation.title}</strong><small>{new Date(conversation.updatedAt).toLocaleDateString()}</small></button>)}{!(conversationsQuery.data?.length) && <p>No thread yet. Start with a research question.</p>}</>}</nav></aside>
      <div className="solo-chat-conversation">
        <header className="solo-chat-controls"><div><span className="eyebrow">MESSAGE VIEW</span><div className="debate-legend" aria-label="Bull and Bear debate legend"><span className="bull">▲ Bull case</span><span className="bear">▼ Bear case</span></div></div><div className="chat-filter-group" role="group" aria-label="Filter conversation messages">{filters.map((option) => <button key={option.value} type="button" className={filter === option.value ? "active" : ""} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div></header>
        {fundManagerReview && <article className="fund-manager-summary" aria-label="Fund Manager disagreement review"><header><ClipboardCheck size={16} /><div><span>FUND MANAGER · DISAGREEMENT REVIEW</span><small>Bounded synthesis; not an execution approval.</small></div></header><p>{fundManagerReview.content}</p></article>}
        <div className="solo-chat-messages" aria-live="polite">{messagesQuery.isLoading ? <LoadingSkeleton className="message-loading-skeleton" label="Loading conversation messages" lines={4} /> : !threadId ? <div className="chat-empty"><BrainCircuit size={28} /><strong>Start a research conversation.</strong><span>Ask what evidence is needed, challenge a thesis, or outline a simulation-only review.</span></div> : filteredMessages.map((message) => { const presentation = getChatPresentation(message.actor, message.agentId, roleByAgentId); const confidenceBand = typeof message.confidence === "number" ? getResearchNoteConfidenceBand(message.confidence) : undefined; return <article key={message.messageId} className={`chat-message ${message.actor} ${presentation.tone}`} aria-label={`${presentation.label} message`}><header><span>{presentation.label}</span><div>{presentation.cue && <small>{presentation.cue}</small>}{confidenceBand && <b className={`confidence-score ${confidenceBand.tone}`} title="Research-note completeness based on structure, provenance cues, and stated uncertainty; it is not a forecast or return probability">Evidence completeness {message.confidence}/100 · {confidenceBand.label}</b>}</div></header><p>{message.content}</p></article>; })}{threadId && !filteredMessages.length && <div className="chat-empty"><ShieldCheck size={24} /><strong>No messages match this view.</strong><span>Choose All or wait for the delegated role to complete its bounded note.</span></div>}{chatMutation.isPending && <div className="chat-thinking"><RefreshCw size={14} className="spin" /> Supervisor is delegating bounded research tasks…</div>}</div>
        <form className="supervisor-composer solo-composer" aria-label="Supervisor message composer" onSubmit={submitSupervisorMessage}><div className="solo-composer-input"><label htmlFor="supervisor-brief">YOUR RESEARCH BRIEF <span>⌘/Ctrl + Enter to send</span></label><div className="chatgpt-input-shell"><button type="button" className="chatgpt-plus" aria-label="Research brief tools" title="Research brief tools"><Plus size={19} /></button><textarea ref={composerRef} id="supervisor-brief" value={instruction} onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={chatMutation.isPending} placeholder="Ask anything about a project…" /><span className="chatgpt-mode">Research</span><Button className="command-send chatgpt-send" aria-label="Send research brief" disabled={chatMutation.isPending || instruction.trim().length < 2}><Send size={16} /><span>{chatMutation.isPending ? "Delegating…" : "Send"}</span></Button></div></div><div className="solo-composer-actions"><small>Bounded research only. No execution authority.</small><span>Enter adds a line · ⌘/Ctrl+Enter sends</span></div></form>
        {threadId && <section className="chat-evolution-timeline" aria-label="Conversation evolution timeline"><header><span><ShieldCheck size={14} /> Debate timeline</span><small>Persisted delegation and completion events</small></header><div>{evolutionQuery.data?.slice(0, 6).map((event) => <article key={event.eventId}><i className={`event-${event.state}`} /><div><strong>{event.state.replaceAll("_", " ")}</strong><p>{event.summary}</p></div><time>{new Date(event.createdAt).toLocaleTimeString()}</time></article>)}{!(evolutionQuery.data?.length) && <p className="timeline-empty">Delegation and completion events will appear here after the first exchange.</p>}</div></section>}
      </div>
    </section>}
  </div>;
}
