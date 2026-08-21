/*
 * Ledgerline Command Center — selected design: warm editorial brutalism with Swiss information design.
 * This page is intentionally simulation-first: no live execution, wallet, exchange, or secret handling.
 */
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FlaskConical,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const logoUrl = "/manus-storage/ledger-logo_5877e9f6.png";
const signalUrl = "/manus-storage/portfolio-signal_58945abd.png";
const journalUrl = "/manus-storage/audit-journal_25274e25.png";

const initialDecisions = [
  { time: "09:42:18", action: "Rebalance proposal", asset: "ETH", status: "Passed", detail: "Within 18% sleeve cap" },
  { time: "09:37:04", action: "Yield venue check", asset: "USDC", status: "Review", detail: "Protocol health score changed" },
  { time: "08:55:31", action: "Risk scan", asset: "Portfolio", status: "Passed", detail: "No concentration breach" },
  { time: "Yesterday", action: "Paper fill", asset: "BTC", status: "Passed", detail: "Simulated at $64,120" },
];

const policyRows = [
  { rule: "Single asset exposure", current: "18.0%", limit: "25.0%", state: "Within" },
  { rule: "Single protocol exposure", current: "12.4%", limit: "20.0%", state: "Within" },
  { rule: "Stablecoin reserve", current: "42.0%", limit: "≥ 30.0%", state: "Within" },
  { rule: "Daily turnover", current: "0.0%", limit: "≤ 8.0%", state: "Within" },
];

function Metric({ label, value, note, tone = "ink" }: { label: string; value: string; note: string; tone?: "ink" | "green" | "amber" }) {
  return (
    <div className="metric-block">
      <div className="datum-label">{label}</div>
      <div className={`metric-value tone-${tone}`}>{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Passed: "status-pill status-passed",
    Within: "status-pill status-passed",
    Review: "status-pill status-review",
    Blocked: "status-pill status-blocked",
  };
  return <span className={styles[status] ?? "status-pill"}>{status}</span>;
}

export default function Home() {
  const [activeView, setActiveView] = useState("Overview");
  const [paused, setPaused] = useState(false);
  const [simulationCount, setSimulationCount] = useState(14);
  const [decisions, setDecisions] = useState(initialDecisions);
  const [mobileNav, setMobileNav] = useState(false);

  const lastRun = useMemo(() => `SIM-${String(simulationCount).padStart(4, "0")}`, [simulationCount]);

  const runSimulation = () => {
    if (paused) {
      toast.error("Simulation paused", { description: "Resume the paper agent before running a new cycle." });
      return;
    }
    const next = simulationCount + 1;
    setSimulationCount(next);
    setDecisions((items) => [
      { time: "Just now", action: "Paper cycle complete", asset: "Portfolio", status: "Passed", detail: `Run ${`SIM-${String(next).padStart(4, "0")}`} · 4 checks passed` },
      ...items,
    ]);
    toast.success("Paper cycle complete", { description: `All policy checks passed in SIM-${String(next).padStart(4, "0")}.` });
  };

  const togglePause = () => {
    setPaused((value) => !value);
    toast.message(paused ? "Paper agent resumed" : "Paper agent paused", { description: paused ? "Simulation cycles can run again." : "No cycles will execute until resumed." });
  };

  const navItems = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Portfolio", icon: WalletCards },
    { label: "Policy", icon: ShieldCheck },
    { label: "Decision journal", icon: BookOpenCheck },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><img src={logoUrl} alt="Ledgerline mark" /></div>
          <div>
            <div className="brand-name">ledgerline</div>
            <div className="brand-caption">personal investment OS</div>
          </div>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={17} /></button>
        </div>
        <div className="sidebar-rule" />
        <div className="datum-label nav-kicker">Workspace</div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeView === label ? "nav-active" : ""}`} onClick={() => { setActiveView(label); setMobileNav(false); }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{activeView === label && <ChevronRight className="nav-chevron" size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-lower">
          <div className="mandate-card">
            <div className="mandate-icon"><LockKeyhole size={16} /></div>
            <div>
              <div className="mandate-title">Live execution</div>
              <div className="mandate-copy">Disabled by design in MVP</div>
            </div>
          </div>
          <button className="utility-link" onClick={() => toast.message("Settings are planned for the next phase.")}><SlidersHorizontal size={15} /> Workspace settings</button>
          <div className="owner-chip"><div className="owner-avatar">A</div><div><div className="owner-name">Owner mode</div><div className="owner-meta">local simulation</div></div><CircleHelp size={14} className="owner-help" /></div>
        </div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeView}</strong></div>
          <div className="topbar-actions"><span className="sync-label"><span className="sync-dot" /> Paper engine synced</span><Button variant="outline" size="sm" onClick={() => toast.message("Data source is simulated", { description: "Live market feeds are intentionally deferred." })}><RefreshCw size={14} /> Refresh</Button></div>
        </header>

        <div className="content-wrap">
          <section className="hero-band">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> Simulation workspace · {lastRun}</div>
              <h1>Stay inside<br /><em>the lines.</em></h1>
              <p>Ledgerline turns your investment policy into a visible operating system. Review the state, run a paper cycle, and keep every decision inspectable.</p>
              <div className="hero-actions"><Button className="primary-action" onClick={runSimulation}><Play size={15} fill="currentColor" /> Run paper cycle</Button><Button className="quiet-action" variant="ghost" onClick={() => setActiveView("Policy")}><FileCheck2 size={15} /> Review policy</Button></div>
            </div>
            <div className="hero-art"><img src={signalUrl} alt="Abstract portfolio signal illustration" /><div className="hero-stamp"><span>v0.1</span><span>SIMULATION ONLY</span></div></div>
          </section>

          <div className="status-strip"><div className="status-primary"><span className="status-pulse" />{paused ? "Paper agent paused" : "Paper agent operational"}</div><div className="status-separator" /><div className="status-secondary">Last evaluation <strong>2 minutes ago</strong></div><div className="status-secondary">Policy <strong>IPS-001 · active</strong></div><button className={`pause-button ${paused ? "is-paused" : ""}`} onClick={togglePause}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "Resume" : "Pause"}</button></div>

          <section className="metric-row"><Metric label="Paper NAV" value="$100,842" note="+$842 since inception · +0.84%" tone="green" /><Metric label="Reserve ratio" value="42.0%" note="Stablecoin sleeve · target ≥ 30%" /><Metric label="Risk budget used" value="18.6%" note="Low utilization · ceiling 65%" tone="green" /><Metric label="Open reviews" value="01" note="Protocol health score changed" tone="amber" /></section>

          <div className="workspace-grid">
            <section className="panel portfolio-panel"><div className="panel-heading"><div><div className="datum-label">Allocation map</div><h2>Portfolio posture</h2></div><Button variant="ghost" size="sm" onClick={() => setActiveView("Portfolio")}>View portfolio <ArrowUpRight size={14} /></Button></div><div className="allocation-layout"><div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>100%</strong><span>allocated</span></div></div><div className="donut-legend"><div><span className="legend-dot green" />Stablecoins <strong>42%</strong></div><div><span className="legend-dot charcoal" />ETH <strong>18%</strong></div><div><span className="legend-dot amber" />BTC <strong>16%</strong></div><div><span className="legend-dot pale" />Cash buffer <strong>24%</strong></div></div></div><div className="chart-area"><div className="chart-meta"><span>Paper NAV · 30 days</span><strong>$100,842</strong></div><div className="sparkline"><span className="spark-bar b1" /><span className="spark-bar b2" /><span className="spark-bar b3" /><span className="spark-bar b4" /><span className="spark-bar b5" /><span className="spark-bar b6" /><span className="spark-bar b7" /><span className="spark-bar b8" /><span className="spark-bar b9" /><span className="spark-bar b10" /><span className="spark-bar b11" /><span className="spark-bar b12" /></div><div className="chart-axis"><span>30d ago</span><span>15d</span><span>Today</span></div><div className="chart-note"><Activity size={14} /> Simulated marks only. No live prices connected.</div></div></div></section>

            <section className="panel health-panel"><div className="panel-heading"><div><div className="datum-label">Control plane</div><h2>System health</h2></div><span className="health-badge"><span /> All clear</span></div><div className="health-list"><div className="health-item"><div className="health-icon ok"><ShieldCheck size={17} /></div><div><strong>Policy engine</strong><span>4 / 4 checks passing</span></div><Check className="health-check" size={16} /></div><div className="health-item"><div className="health-icon ok"><FlaskConical size={17} /></div><div><strong>Simulation sandbox</strong><span>Last run {lastRun}</span></div><Check className="health-check" size={16} /></div><div className="health-item"><div className="health-icon review"><TriangleAlert size={17} /></div><div><strong>Data freshness</strong><span>One source needs review</span></div><ChevronRight className="health-chevron" size={16} /></div></div><div className="health-footer"><Clock3 size={14} /> Next scheduled review <strong>Tomorrow · 09:00</strong></div></section>
          </div>

          <section className="panel journal-panel"><div className="panel-heading"><div><div className="datum-label">Immutable-style local journal</div><h2>Recent decisions</h2></div><Button variant="ghost" size="sm" onClick={() => setActiveView("Decision journal")}>Open journal <ArrowUpRight size={14} /></Button></div><div className="journal-content"><div className="journal-art"><img src={journalUrl} alt="Audit journal illustration" /></div><div className="decision-table"><div className="table-head"><span>Time</span><span>Decision</span><span>Asset</span><span>Result</span><span>Evidence</span></div>{decisions.slice(0, 4).map((item, index) => <div className="decision-row" key={`${item.time}-${index}`}><span className="mono">{item.time}</span><strong>{item.action}</strong><span className="asset-tag">{item.asset}</span><StatusPill status={item.status} /><span className="evidence">{item.detail}</span></div>)}</div></div></section>

          <section className="policy-callout"><div className="policy-symbol"><ShieldCheck size={20} /></div><div><div className="datum-label">Policy gate · IPS-001</div><h3>Every proposed action must clear the constitution.</h3><p>Hard limits are deterministic. The reasoning layer can recommend; it cannot override the policy engine or the owner’s pause control.</p></div><Button variant="outline" onClick={() => setActiveView("Policy")}>Inspect limits <ChevronRight size={15} /></Button></section>

          <footer className="page-footer"><span>LEDGERLINE / PERSONAL INVESTMENT OS</span><span>Build 0.1.0 · Local state · No live execution</span></footer>
        </div>
      </main>
    </div>
  );
}
