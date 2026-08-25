import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Info,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import React, { useMemo } from "react";
import { toast } from "sonner";

const levelConfig = {
  critical: { icon: ShieldAlert, color: "var(--ll-danger)", bg: "color-mix(in srgb, var(--ll-danger) 10%, var(--ll-surface))", label: "Critical" },
  warning: { icon: AlertTriangle, color: "var(--ll-warn, #e0a030)", bg: "color-mix(in srgb, var(--ll-warn, #e0a030) 10%, var(--ll-surface))", label: "Warning" },
  info: { icon: Info, color: "var(--ll-blue)", bg: "color-mix(in srgb, var(--ll-blue) 10%, var(--ll-surface))", label: "Info" },
} as const;

export default function Alerts() {
  const { isAuthenticated } = useAuth();
  const alertsQuery = trpc.security.alerts.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const ackMutation = trpc.security.alerts.acknowledge.useMutation({
    onSuccess: () => alertsQuery.refetch(),
  });

  const alerts = alertsQuery.data ?? [];
  const unacknowledged = useMemo(() => alerts.filter((a) => !a.acknowledged), [alerts]);
  const acknowledged = useMemo(() => alerts.filter((a) => a.acknowledged), [alerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await ackMutation.mutateAsync({ alertId });
      toast.success("Alert acknowledged.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not acknowledge alert.");
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="workspace-page">
      <header className="workspace-heading">
        <span className="eyebrow">SECURITY ALERTS</span>
        <h1>
          Every alert is <em>auditable.</em>
        </h1>
        <p>
          Security alerts track critical events, permission changes, connection
          issues, and mode transitions. All alerts are structured, timestamped,
          and linked to the immutable Activity record.
        </p>
      </header>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 16, marginTop: 22, paddingBottom: 18, borderBottom: "1px solid var(--ll-line)" }}>
        {(["critical", "warning", "info"] as const).map((level) => {
          const config = levelConfig[level];
          const Icon = config.icon;
          const count = alerts.filter((a) => a.level === level).length;
          const unackCount = alerts.filter((a) => a.level === level && !a.acknowledged).length;
          return (
            <div key={level} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "1px solid var(--ll-line)", borderRadius: 5, background: config.bg }}>
              <Icon size={15} style={{ color: config.color }} />
              <div>
                <span style={{ display: "block", color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>{config.label}</span>
                <span style={{ display: "block", color: "var(--ll-ink)", fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                  {count}
                  {unackCount > 0 && <span style={{ color: config.color, fontSize: 10, marginLeft: 4 }}>({unackCount} new)</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unacknowledged alerts */}
      {unacknowledged.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <span className="eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Bell size={12} /> UNACKNOWLEDGED ({unacknowledged.length})
          </span>
          <div style={{ display: "grid", gap: 8 }}>
            {unacknowledged.map((alert) => {
              const config = levelConfig[alert.level];
              const Icon = config.icon;
              return (
                <article
                  key={alert.alertId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "8px 1fr auto",
                    gap: 12,
                    alignItems: "start",
                    padding: "14px 16px",
                    border: `1px solid var(--ll-line)`,
                    borderLeft: `3px solid ${config.color}`,
                    borderRadius: 5,
                    background: config.bg,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: config.color, marginTop: 4 }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Icon size={13} style={{ color: config.color }} />
                      <strong style={{ color: "var(--ll-ink)", fontSize: 11 }}>{alert.title}</strong>
                      <span style={{ color: config.color, font: "8px 'DM Mono',monospace", textTransform: "uppercase", background: "var(--ll-surface)", padding: "2px 5px", borderRadius: 3 }}>
                        {config.label}
                      </span>
                    </div>
                    <p style={{ color: "var(--ll-muted)", fontSize: 10, margin: 0, lineHeight: 1.5 }}>{alert.detail}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                      <span>{alert.category}</span>
                      <span>·</span>
                      <time>{formatTime(alert.createdAt)}</time>
                      {alert.actionRef && (
                        <>
                          <span>·</span>
                          <span style={{ color: "var(--ll-blue)" }}>ref:{alert.actionRef.slice(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ackMutation.isPending}
                    onClick={() => void handleAcknowledge(alert.alertId)}
                    style={{ fontSize: 9, color: config.color, borderColor: config.color }}
                  >
                    <CheckCircle2 size={12} /> Acknowledge
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Acknowledged alerts */}
      <section style={{ marginTop: 20 }}>
        <span className="eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={12} /> RESOLVED ({acknowledged.length})
        </span>
        {acknowledged.length === 0 ? (
          <div className="connection-card" style={{ display: "grid", placeContent: "center", minHeight: 120, gridColumn: "1 / -1" }}>
            <p style={{ textAlign: "center", color: "var(--ll-muted)", fontSize: 10 }}>
              No resolved alerts yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {acknowledged.map((alert) => {
              const config = levelConfig[alert.level];
              const Icon = config.icon;
              return (
                <article
                  key={alert.alertId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "8px 1fr",
                    gap: 12,
                    alignItems: "start",
                    padding: "10px 14px",
                    border: "1px solid var(--ll-line)",
                    borderRadius: 5,
                    background: "var(--ll-surface)",
                    opacity: 0.7,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ll-muted)", marginTop: 5 }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={12} style={{ color: "var(--ll-muted)" }} />
                      <strong style={{ color: "var(--ll-muted)", fontSize: 10 }}>{alert.title}</strong>
                      <span style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>{config.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                      <span>{alert.category}</span>
                      <span>·</span>
                      <time>{formatTime(alert.createdAt)}</time>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="connection-warning" style={{ marginTop: 16 }}>
        <CircleAlert size={18} />
        <div>
          <strong>All alerts are structured and auditable.</strong>
          <span>
            Critical alerts include transaction failures, unexpected mandate
            revocation, permission violations, and limit breaches. Warning alerts
            cover unusual activity, connection issues, and overly broad
            permissions. Info alerts record mode changes, key operations, and
            wallet connections. Alerts are written to structured logs and linked
            to the Decision Journal when relevant.
          </span>
        </div>
      </section>
    </div>
  );
}
