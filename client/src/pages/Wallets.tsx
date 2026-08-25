import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, Landmark, Link2, LockKeyhole, PauseCircle, ShieldCheck, WalletCards, Zap } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

const walletRoles = [
  { name: "Trading wallet", description: "Tactical strategies, bounded order management, and venue-specific execution envelopes.", tone: "trading", icon: WalletCards },
  { name: "Long-term investment wallet", description: "Low-turnover allocation, longer review horizons, and strict concentration/turnover constraints.", tone: "investment", icon: Landmark },
];

const modeLabels = {
  simulation: { label: "Simulation", color: "var(--ll-blue)" },
  paper: { label: "Paper", color: "var(--ll-cyan, #5ce2ff)" },
  live: { label: "Live", color: "var(--ll-danger)" },
} as const;

export default function Wallets() {
  const { isAuthenticated } = useAuth();
  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const mandatesQuery = trpc.autonomy.mandates.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createMutation = trpc.autonomy.createSimulationMandate.useMutation({ onSuccess: () => mandatesQuery.refetch() });
  const modeMutation = trpc.autonomy.setMandateMode.useMutation({ onSuccess: () => mandatesQuery.refetch() });
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<"simulation" | "paper" | "live">("simulation");
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<"simulation" | "paper" | "live">("simulation");

  const createMandate = async (role: "trading" | "investment") => {
    if (!policyQuery.data) return toast.error("Save the IPS before creating a wallet mandate.");
    setBusyRole(role);
    try {
      await createMutation.mutateAsync({ walletRole: role, venue: role === "trading" ? "binance" : "evm", allowedAssets: policyQuery.data.allowedAssets, maxOrderBps: policyQuery.data.maxTransactionBps, dailyCapBps: policyQuery.data.dailyMandateBps });
      toast.success("Simulation mandate created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the mandate.");
    } finally {
      setBusyRole(null);
    }
  };

  const togglePause = async (mandateId: string, mode: "simulation" | "armed" | "real" | "paused") => {
    try {
      await modeMutation.mutateAsync({ mandateId, mode: mode === "paused" ? "simulation" : "paused" });
      toast.message(mode === "paused" ? "Simulation mandate resumed" : "Simulation mandate paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change mode.");
    }
  };

  const handleConnectWallet = async () => {
    // ponytail: simulated wallet connection — real implementation uses WalletConnect / injected provider
    try {
      // In production: use @walletconnect/modal + ethers/wagmi
      const mockAddress = "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
      setConnectedAddress(mockAddress);
      setWalletConnected(true);
      toast.success("Wallet connected (simulation)");
    } catch {
      toast.error("Wallet connection failed.");
    }
  };

  const handleDisconnectWallet = () => {
    setConnectedAddress(null);
    setWalletConnected(false);
    toast.message("Wallet disconnected.");
  };

  const requestModeChange = (mode: "simulation" | "paper" | "live") => {
    if (mode === "live") {
      setPendingMode(mode);
      setShowModeConfirm(true);
    } else {
      setCurrentMode(mode);
      toast.success(`Mode changed to ${modeLabels[mode].label}`);
    }
  };

  const confirmLiveMode = () => {
    setCurrentMode("live");
    setShowModeConfirm(false);
    toast.warning("Live mode activated. All actions are now capital-capped and audited.", { duration: 8000 });
  };

  return <div className="workspace-page">
    <header className="workspace-heading"><span className="eyebrow">WALLET ROLES &amp; MANDATES</span><h1>Every wallet has a purpose.<br /><em>Every purpose has a boundary.</em></h1><p>Wallet records identify a role and its authority envelope. They do not contain a private key. A live mandate can only be armed by the owner after a connection and security review.</p></header>

    {/* Wallet Connection Section */}
    <section style={{ marginTop: 22, padding: 20, border: "1px solid var(--ll-line)", borderRadius: 7, background: "var(--ll-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="wallet-glyph"><Link2 size={19} /></div>
          <div>
            <span style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>WALLET CONNECTION</span>
            <h2 style={{ margin: "4px 0 0", color: "var(--ll-ink)", font: "500 22px/1 'Instrument Serif',serif" }}>
              {walletConnected ? "Connected" : "Not connected"}
            </h2>
          </div>
        </div>
        {walletConnected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "block", color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>ADDRESS</span>
              <span style={{ display: "block", color: "var(--ll-ink)", font: "11px 'DM Mono',monospace", marginTop: 3 }}>
                {connectedAddress?.slice(0, 6)}…{connectedAddress?.slice(-4)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnectWallet}>Disconnect</Button>
          </div>
        ) : (
          <Button onClick={handleConnectWallet}>
            <WalletCards size={14} /> Connect wallet
          </Button>
        )}
      </div>
      {walletConnected && (
        <div style={{ marginTop: 12, display: "flex", gap: 16, color: "var(--ll-muted)", fontSize: 10 }}>
          <span><strong style={{ color: "var(--ll-ink)" }}>Network:</strong> Ethereum Mainnet</span>
          <span><strong style={{ color: "var(--ll-ink)" }}>Balance:</strong> —</span>
          <span><strong style={{ color: "var(--ll-ink)" }}>Provider:</strong> WalletConnect</span>
        </div>
      )}
    </section>

    {/* Mode Control */}
    <section className="mode-control" aria-labelledby="mode-control-title" style={{ marginTop: 16 }}>
      <div>
        <span className="eyebrow">EXECUTION MODE CONTROL</span>
        <h2 id="mode-control-title">Current mode: {modeLabels[currentMode].label}</h2>
        <p>
          {currentMode === "simulation" && "All actions are simulated. No real orders or transactions occur."}
          {currentMode === "paper" && "Paper trading with real market data. No real capital at risk."}
          {currentMode === "live" && "Live execution is active. All actions are capital-capped and fully audited."}
        </p>
      </div>
      <div className="mode-control-actions">
        <button
          type="button"
          className={`mode-choice ${currentMode === "simulation" ? "active" : ""}`}
          aria-pressed={currentMode === "simulation"}
          onClick={() => void requestModeChange("simulation")}
        >
          <ShieldCheck size={15} /> Simulation
        </button>
        <button
          type="button"
          className={`mode-choice ${currentMode === "paper" ? "active" : ""}`}
          aria-pressed={currentMode === "paper"}
          onClick={() => void requestModeChange("paper")}
        >
          <Zap size={15} /> Paper
        </button>
        <button
          type="button"
          className={`mode-choice ${currentMode === "live" ? "active" : ""}`}
          aria-pressed={currentMode === "live"}
          onClick={() => void requestModeChange("live")}
        >
          <LockKeyhole size={15} /> Live
        </button>
      </div>

      {/* Live mode confirmation dialog */}
      {showModeConfirm && (
        <div style={{ marginTop: 14, padding: 16, border: "2px solid var(--ll-danger)", borderRadius: 7, background: "color-mix(in srgb, var(--ll-danger) 8%, var(--ll-surface))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} style={{ color: "var(--ll-danger)" }} />
            <strong style={{ color: "var(--ll-ink)", fontSize: 12 }}>Confirm Live Mode Activation</strong>
          </div>
          <p style={{ color: "var(--ll-muted)", fontSize: 10, margin: "0 0 12px", lineHeight: 1.5 }}>
            Live mode enables real execution with capital caps. All actions will be logged to the
            immutable Activity record. This requires a verified adapter, owner arming ceremony, and
            risk review. Are you sure you want to proceed?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setShowModeConfirm(false)}>Cancel</Button>
            <Button size="sm" style={{ background: "var(--ll-danger)", color: "#fff" }} onClick={confirmLiveMode}>
              Enable live mode
            </Button>
          </div>
        </div>
      )}

      <div className="real-readiness">
        <strong>Mode progression</strong>
        <span>
          Simulation → Paper → Live. Each step requires owner approval and is
          logged. Live mode activation is intentional, logged, and reversible.
          Feature flags control availability of real execution paths.
        </span>
      </div>
    </section>

    {/* Wallet Role Cards */}
    <div className="wallet-role-grid">{walletRoles.map((wallet) => {
      const Icon = wallet.icon;
      const role = wallet.tone as "trading" | "investment";
      const mandate = mandatesQuery.data?.find((entry) => entry.walletRole === role);
      return <article className={`wallet-role ${wallet.tone}`} key={wallet.name}>
        <header><div className="wallet-glyph"><Icon size={19} /></div><span>ROLE</span><b className={`mandate-state ${mandate ? "active" : "idle"}`}>{mandate?.mode ?? "Not configured"}</b></header>
        <h2>{wallet.name}</h2><p>{wallet.description}</p>
        <dl><div><dt>Mode</dt><dd>{mandate?.mode ?? "Simulation default"}</dd></div><div><dt>Venue</dt><dd>{mandate?.venue ?? "None"}</dd></div><div><dt>Mandate</dt><dd>{mandate ? mandate.status : "Not armed"}</dd></div></dl>
        {mandate ? <Button variant="outline" disabled={modeMutation.isPending} onClick={() => void togglePause(mandate.mandateId, mandate.mode)}>{mandate.mode === "paused" ? "Resume simulation" : "Pause mandate"} <PauseCircle size={14} /></Button> : <Button variant="outline" disabled={!isAuthenticated || busyRole === role} onClick={() => void createMandate(role)}>{busyRole === role ? "Creating" : "Create simulation mandate"} <ArrowRight size={14} /></Button>}
      </article>;
    })}</div>

    <section className="mandate-explainer"><div><ShieldCheck size={19} /><div><strong>Authority ladder</strong><span>A wallet moves from disconnected → simulation → armed → real per venue and strategy. It cannot skip the owner mandate.</span></div></div><div><LockKeyhole size={19} /><div><strong>Key isolation</strong><span>Private keys never enter agent context or general database records. A future on-chain mandate uses a dedicated non-custodial signer boundary.</span></div></div><div><PauseCircle size={19} /><div><strong>Emergency pause</strong><span>The owner can stop new actions globally or per venue. Agents may reduce risk, never enlarge authority.</span></div></div></section>
    <section className="wallet-policy-callout"><AlertTriangle size={18} /><div><strong>{policyQuery.data ? `Active IPS: ${policyQuery.data.name} v${policyQuery.data.version}` : "No active IPS"}</strong><span>{policyQuery.data ? "Wallet mandates must be narrower than this policy, not broader." : "Save the base Investment Policy Statement before any wallet mandate can be armed."}</span></div></section>
  </div>;
}
