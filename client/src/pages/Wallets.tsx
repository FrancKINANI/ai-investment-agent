import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, Landmark, LockKeyhole, PauseCircle, ShieldCheck, WalletCards } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

const walletRoles = [
  { name: "Trading wallet", description: "Tactical strategies, bounded order management, and venue-specific execution envelopes.", tone: "trading", icon: WalletCards },
  { name: "Long-term investment wallet", description: "Low-turnover allocation, longer review horizons, and strict concentration/turnover constraints.", tone: "investment", icon: Landmark },
];

export default function Wallets() {
  const { isAuthenticated } = useAuth();
  const policyQuery = trpc.policy.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const mandatesQuery = trpc.autonomy.mandates.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createMutation = trpc.autonomy.createSimulationMandate.useMutation({ onSuccess: () => mandatesQuery.refetch() });
  const modeMutation = trpc.autonomy.setMandateMode.useMutation({ onSuccess: () => mandatesQuery.refetch() });
  const [busyRole, setBusyRole] = useState<string | null>(null);

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

  return <div className="workspace-page">
    <header className="workspace-heading"><span className="eyebrow">WALLET ROLES &amp; MANDATES</span><h1>Every wallet has a purpose.<br /><em>Every purpose has a boundary.</em></h1><p>Wallet records identify a role and its authority envelope. They do not contain a private key. A live mandate can only be armed by the owner after a connection and security review.</p></header>
    <div className="wallet-role-grid">{walletRoles.map((wallet) => {
      const Icon = wallet.icon;
      const role = wallet.tone as "trading" | "investment";
      const mandate = mandatesQuery.data?.find((entry) => entry.walletRole === role);
      return <article className={`wallet-role ${wallet.tone}`} key={wallet.name}>
        <header><div className="wallet-glyph"><Icon size={19} /></div><span>ROLE</span><b>{mandate?.mode ?? "Not configured"}</b></header>
        <h2>{wallet.name}</h2><p>{wallet.description}</p>
        <dl><div><dt>Mode</dt><dd>{mandate?.mode ?? "Simulation default"}</dd></div><div><dt>Venue</dt><dd>{mandate?.venue ?? "None"}</dd></div><div><dt>Mandate</dt><dd>{mandate ? mandate.status : "Not armed"}</dd></div></dl>
        {mandate ? <Button variant="outline" disabled={modeMutation.isPending} onClick={() => void togglePause(mandate.mandateId, mandate.mode)}>{mandate.mode === "paused" ? "Resume simulation" : "Pause mandate"} <PauseCircle size={14} /></Button> : <Button variant="outline" disabled={!isAuthenticated || busyRole === role} onClick={() => void createMandate(role)}>{busyRole === role ? "Creating" : "Create simulation mandate"} <ArrowRight size={14} /></Button>}
      </article>;
    })}</div>
    <section className="mode-control" aria-labelledby="mode-control-title">
      <div><span className="eyebrow">EXECUTION MODE CONTROL</span><h2 id="mode-control-title">Simulation is active. Real mode is deliberately locked.</h2><p>The current API blocks real mandates. Ledgerline does not accept credentials, private keys, signing requests, or live-order instructions in this release.</p></div>
      <div className="mode-control-actions"><button type="button" className="mode-choice active" aria-pressed="true"><ShieldCheck size={15} /> Simulation default</button><button type="button" className="mode-choice locked" disabled title="Real mode requires a future adapter, owner arming ceremony, credentials vault, signing boundary, and independent risk review."><LockKeyhole size={15} /> Real mode · locked</button></div>
      <div className="real-readiness"><strong>Required before real authority can exist</strong><span>Named venue adapter · non-custodial signer boundary · owner arming ceremony · scope-limited credentials · IPS/Risk controls · audit and emergency-stop validation.</span></div>
    </section>
    <section className="mandate-explainer"><div><ShieldCheck size={19} /><div><strong>Authority ladder</strong><span>A wallet moves from disconnected → simulation → armed → real per venue and strategy. It cannot skip the owner mandate.</span></div></div><div><LockKeyhole size={19} /><div><strong>Key isolation</strong><span>Private keys never enter agent context or general database records. A future on-chain mandate uses a dedicated non-custodial signer boundary.</span></div></div><div><PauseCircle size={19} /><div><strong>Emergency pause</strong><span>The owner can stop new actions globally or per venue. Agents may reduce risk, never enlarge authority.</span></div></div></section>
    <section className="wallet-policy-callout"><AlertTriangle size={18} /><div><strong>{policyQuery.data ? `Active IPS: ${policyQuery.data.name} v${policyQuery.data.version}` : "No active IPS"}</strong><span>{policyQuery.data ? "Wallet mandates must be narrower than this policy, not broader." : "Save the base Investment Policy Statement before any wallet mandate can be armed."}</span></div></section>
  </div>;
}
