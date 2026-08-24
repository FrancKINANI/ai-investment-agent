import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity as ActivityIcon, FileCheck2, LockKeyhole, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

export default function Activity() {
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState("");
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const entries = useMemo(() => (historyQuery.data ?? []).filter((entry) => `${entry.subject} ${entry.detail} ${entry.kind}`.toLowerCase().includes(filter.toLowerCase())), [historyQuery.data, filter]);
  return <div className="workspace-page"><header className="workspace-heading"><span className="eyebrow">IMMUTABLE ACTIVITY LOG</span><h1>Every agent, policy, and venue event is <em>reconstructible.</em></h1><p>The log stores actual owner-scoped events only. It does not fabricate agent activity, order fills, balances, or connected accounts.</p></header>{isAuthenticated ? <section className="activity-log"><header><div className="activity-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter activity" /></div><span>{entries.length} events</span></header>{historyQuery.isLoading ? <div className="log-empty">Loading owner events…</div> : entries.length === 0 ? <div className="log-empty"><FileCheck2 size={23} /><strong>No recorded activity.</strong><span>Run an agent cycle, save an IPS, inspect a token, audit scopes, or start a paper simulation to create the first immutable event.</span></div> : <div className="log-list">{entries.map((entry) => <article key={entry.actionId}><i className={`status-${entry.status}`} /><time>{new Date(entry.createdAt).toLocaleString()}</time><div><strong>{entry.subject}</strong><p>{entry.detail}</p></div><span>{entry.kind.replaceAll("_", " ")}</span></article>)}</div>}</section> : <section className="log-empty guarded"><LockKeyhole size={23} /><strong>Your audit trail is private.</strong><span>Sign in to create and inspect your agent, policy, and simulation history.</span><Button onClick={startLogin}>Sign in to view activity</Button></section>}<section className="activity-contract"><ShieldCheck size={17} /><p>Future venue events will distinguish proposal, armed preview, venue acknowledgement, order state, settlement, reconciliation, and final outcome. A live order is never considered complete merely because a request was sent.</p></section></div>;
}
