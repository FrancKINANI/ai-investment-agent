import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCheck, FileCheck2, LockKeyhole, Network, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import React from "react";
import { useMemo, useState } from "react";

type ActivityProvenance = { origin?: "capability-registry" | "owner-control"; registryRevision?: string; executionBoundary?: string; capabilities?: Array<{ id: string; version: string; label: string; scopes: string[] }> };
type SecurityActivity = { actionId: string; kind: string; status: "success" | "review" | "blocked"; subject: string; detail: string; createdAt: Date };

function getActivityProvenance(payload: unknown): ActivityProvenance | null {
  if (!payload || typeof payload !== "object") return null;
  const provenance = (payload as { provenance?: unknown }).provenance;
  return provenance && typeof provenance === "object" ? provenance as ActivityProvenance : null;
}

function getSecurityAlerts(entries: SecurityActivity[]) {
  return entries
    .filter((entry) => entry.status === "blocked" || (entry.status === "review" && entry.kind === "scope_checked"))
    .slice(0, 5)
    .map((entry) => ({
      ...entry,
      label: entry.subject === "Blocked real-mode request" ? "Real-mode request blocked" : entry.status === "blocked" ? "Safety control blocked an action" : "Security review required",
      level: entry.status === "blocked" ? "blocked" : "review",
    }));
}

export default function Activity() {
  const { isAuthenticated, user } = useAuth();
  const [filter, setFilter] = useState("");
  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const entries = useMemo(() => (historyQuery.data ?? []).filter((entry) => `${entry.subject} ${entry.detail} ${entry.kind}`.toLowerCase().includes(filter.toLowerCase())), [historyQuery.data, filter]);
  const securityAlerts = useMemo(() => getSecurityAlerts(historyQuery.data ?? []), [historyQuery.data]);

  const markAllRead = () => {
    const newest = historyQuery.data?.[0];
    if (!newest || !user?.openId) return;
    const seenAt = new Date(newest.createdAt).getTime();
    window.localStorage.setItem(`ledgerline.activity.last-seen.${user.openId}`, String(seenAt));
    window.dispatchEvent(new CustomEvent("ledgerline:activity-read", { detail: { ownerId: user.openId, seenAt } }));
  };

  return <div className="workspace-page activity-page">
    <header className="workspace-heading">
      <span className="eyebrow">IMMUTABLE ACTIVITY LOG</span>
      <h1>Every agent, policy, and venue event is <em>reconstructible.</em></h1>
      <p>The log stores actual owner-scoped events only. It does not fabricate agent activity, order fills, balances, or connected accounts.</p>
    </header>
    {isAuthenticated ? <>
      <section className="security-alert-panel" aria-label="Security alerts">
        <header><span><ShieldAlert size={16} /> Security signals</span><b>{securityAlerts.length} active</b></header>
        <p>Signals come only from recorded blocked authority requests or security reviews. They do not monitor wallets, credentials, external platforms, or real transactions.</p>
        {historyQuery.isLoading ? <LoadingSkeleton label="Loading security signals" lines={2} /> : securityAlerts.length ? <div>{securityAlerts.map((alert) => <article className={`security-alert ${alert.level}`} key={alert.actionId}><AlertTriangle size={15} /><span><strong>{alert.label}</strong><small>{alert.subject} · {new Date(alert.createdAt).toLocaleString()}</small><em>{alert.detail}</em></span></article>)}</div> : <div className="security-alert-empty"><ShieldCheck size={15} /><span>No active security signals in the recorded activity.</span></div>}
      </section>
      <section className="activity-log">
        <header>
          <div className="activity-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter activity" /></div>
          <div className="activity-actions"><span>{entries.length} events</span><Button variant="outline" size="sm" onClick={markAllRead} disabled={!historyQuery.data?.length}><CheckCheck size={13} /> Mark all as read</Button></div>
        </header>
        {historyQuery.isLoading ? <LoadingSkeleton className="activity-loading-skeleton" label="Loading owner activity" lines={5} /> : entries.length === 0 ? <div className="log-empty"><FileCheck2 size={23} /><strong>No recorded activity.</strong><span>Run an agent cycle, save an IPS, inspect a token, audit scopes, or start a paper simulation to create the first immutable event.</span></div> : <div className="log-list">{entries.map((entry) => {
          const provenance = getActivityProvenance(entry.payload);
          return <article key={entry.actionId}><i className={`status-${entry.status}`} /><time>{new Date(entry.createdAt).toLocaleString()}</time><div><strong>{entry.subject}</strong><p>{entry.detail}</p>{provenance && <div className="activity-provenance"><span><Network size={12} /> {provenance.origin === "capability-registry" ? "Capability source" : "Owner control"}</span>{provenance.capabilities?.map((capability) => <b key={`${capability.id}-${capability.version}`}>{capability.label} <small>{capability.id} · v{capability.version} · {capability.scopes.join(" / ")}</small></b>)}<em>{provenance.registryRevision} · {provenance.executionBoundary}</em></div>}</div><span>{entry.kind.replaceAll("_", " ")}</span></article>;
        })}</div>}
      </section>
    </> : <section className="log-empty guarded"><LockKeyhole size={23} /><strong>Your audit trail is private.</strong><span>Sign in to create and inspect your agent, policy, and simulation history.</span><Button onClick={startLogin}>Sign in to view activity</Button></section>}
    <section className="activity-contract"><ShieldCheck size={17} /><p>Every new activity record preserves an owner-control or exact capability source, registry revision, and simulation boundary. A live order is never considered complete merely because a request was sent.</p></section>
  </div>;
}
