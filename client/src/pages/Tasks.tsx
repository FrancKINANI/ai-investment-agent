import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { taskBucket } from "@/lib/missionControl";
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardList, LockKeyhole } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

export default function Tasks() {
  const { isAuthenticated } = useAuth();
  const navigate = useLocation()[1];
  const eventsQuery = trpc.agentFabric.evolution.useQuery({}, { enabled: isAuthenticated, retry: false });
  const events = eventsQuery.data ?? [];
  const columns = useMemo(() => ({ now: events.filter((event) => taskBucket(event.state) === "now"), blocked: events.filter((event) => taskBucket(event.state) === "blocked"), completed: events.filter((event) => taskBucket(event.state) === "completed") }), [events]);

  return <div className="mission-subpage"><header className="mission-subpage-header"><span className="mission-kicker"><ClipboardList size={14} /> TASK BOARD</span><h1>Work is visible.<br /><em>So is what stopped it.</em></h1><p>Tasks are created from recorded delegation and completion events. They do not imply a trade, a fill, or a connected account.</p></header>{!isAuthenticated ? <section className="mission-auth-card"><LockKeyhole size={20} /><div><strong>Sign in to open the task board.</strong><span>Your protected agent activity and task history are owner-scoped.</span></div><Button onClick={() => navigate("/chat")}>Sign in</Button></section> : <section className="mission-task-board">{(["now", "blocked", "completed"] as const).map((column) => <article className="mission-task-column" key={column}><header><span className={`mission-column-dot ${column}`} /> <strong>{column === "now" ? "In progress" : column === "blocked" ? "Blocked" : "Completed"}</strong><small>{columns[column].length}</small></header><div>{eventsQuery.isLoading ? <p>Loading recorded work…</p> : columns[column].length ? columns[column].map((event) => <section key={event.eventId}><small>{event.agentId ? "Agent work" : "Supervisor work"} · {new Date(event.createdAt).toLocaleString()}</small><strong>{event.summary}</strong><span>{column === "blocked" ? "Resolve the identified constraint before continuing." : column === "now" ? "Work remains in progress." : "Recorded as completed; review the full trail in Agent Room."}</span></section>) : <p>{column === "now" ? "No research is currently running." : column === "blocked" ? "No recorded task is blocked." : "No task has been completed yet."}</p>}</div></article>)}</section>}<section className="mission-next-step"><div><span className="mission-label">START A NEW BRIEF</span><strong>Give the supervisor a research question, not an execution instruction.</strong><p>The supervisor will record bounded delegation and evidence work in this board.</p></div><Button className="mission-primary-action" onClick={() => navigate("/chat")}>Open Agent Room <ArrowRight size={15} /></Button></section></div>;
}
