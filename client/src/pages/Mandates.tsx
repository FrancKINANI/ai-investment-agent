import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

const scopeLabels: Record<string, { label: string; desc: string }> = {
  swap: { label: "Swap", desc: "Token exchanges on DEXs" },
  add_liquidity: { label: "Add Liquidity", desc: "Provide liquidity to pools" },
  remove_liquidity: { label: "Remove Liquidity", desc: "Withdraw from pools" },
  stake: { label: "Stake", desc: "Stake tokens in protocols" },
  claim: { label: "Claim", desc: "Claim rewards" },
  transfer: { label: "Transfer", desc: "Move tokens between addresses" },
};

const chainNames: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  42161: "Arbitrum",
  10: "Optimism",
  8453: "Base",
};

export default function Mandates() {
  const { isAuthenticated } = useAuth();
  const mandatesQuery = trpc.wallet.listMandates.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const scopesQuery = trpc.wallet.availableScopes.useQuery(undefined, { enabled: isAuthenticated });
  const chainsQuery = trpc.wallet.supportedChains.useQuery(undefined, { enabled: isAuthenticated });

  const createMutation = trpc.wallet.createMandate.useMutation({
    onSuccess: () => { mandatesQuery.refetch(); setShowCreate(false); resetForm(); },
    onError: (err) => toast.error(err.message),
  });
  const activateMutation = trpc.wallet.activateMandate.useMutation({
    onSuccess: () => mandatesQuery.refetch(),
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.wallet.revokeMandate.useMutation({
    onSuccess: () => mandatesQuery.refetch(),
    onError: (err) => toast.error(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // Form state
  const [formChain, setFormChain] = useState(1);
  const [formScopes, setFormScopes] = useState<string[]>(["swap"]);
  const [formMaxTx, setFormMaxTx] = useState("1000000000000000000");
  const [formMaxDaily, setFormMaxDaily] = useState("5000000000000000000");
  const [formAddress, setFormAddress] = useState("");

  const resetForm = () => {
    setFormChain(1);
    setFormScopes(["swap"]);
    setFormMaxTx("1000000000000000000");
    setFormMaxDaily("5000000000000000000");
    setFormAddress("");
  };

  const toggleScope = (scope: string) => {
    setFormScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  };

  const handleCreate = () => {
    if (!formAddress.trim()) return toast.error("Owner address is required.");
    if (formScopes.length === 0) return toast.error("Select at least one scope.");
    createMutation.mutate({
      ownerAddress: formAddress,
      chainId: formChain,
      scopes: formScopes as any,
      maxTransactionValue: formMaxTx,
      maxDailyValue: formMaxDaily,
    });
  };

  const handleRevoke = async (mandateId: string) => {
    try {
      await revokeMutation.mutateAsync({ mandateId });
      toast.success("Mandate revoked.");
      setRevokeConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke mandate.");
    }
  };

  const mandates = mandatesQuery.data ?? [];
  const chains = chainsQuery.data ?? [];

  return (
    <div className="workspace-page">
      <header className="workspace-heading">
        <span className="eyebrow">SAILOR MANDATES</span>
        <h1>
          Non-custodial <em>on-chain authority.</em>
        </h1>
        <p>
          Sailor mandates define what the agent can do on-chain. Each mandate has
          scopes, value caps, and optional token/protocol allowlists. The owner
          signs mandates with their wallet. Revocation is immediate.
        </p>
      </header>

      {/* Active mandates */}
      <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
        {mandates.length === 0 && (
          <div className="connection-card" style={{ display: "grid", placeContent: "center", minHeight: 140 }}>
            <p style={{ textAlign: "center", color: "var(--ll-muted)", fontSize: 10 }}>
              No mandates configured. Create one below to authorize agent execution.
            </p>
          </div>
        )}
        {mandates.map((m) => (
          <article key={m.mandateId} className="connection-card" style={{ minHeight: "auto" }}>
            <header>
              <div className="connection-icon"><FileSignature size={19} /></div>
              <div>
                <span>{chainNames[m.chainId] ?? `Chain ${m.chainId}`}</span>
                <h2 style={{ fontSize: 18 }}>{m.mandateId.slice(0, 12)}…</h2>
              </div>
              <b className={`connection-state ${m.status === "active" ? "active" : m.status === "revoked" ? "idle" : "idle"}`}>
                {m.status}
              </b>
            </header>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {m.scopes.map((scope) => (
                  <span key={scope} style={{ padding: "3px 6px", border: "1px solid var(--ll-line)", borderRadius: 3, background: "var(--ll-blue-soft)", color: "var(--ll-blue)", font: "8px 'DM Mono',monospace" }}>
                    {scopeLabels[scope]?.label ?? scope}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 10, color: "var(--ll-muted)" }}>
                <div>
                  <span style={{ font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Max tx value</span>
                  <span style={{ display: "block", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{m.maxTransactionValue}</span>
                </div>
                <div>
                  <span style={{ font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Max daily value</span>
                  <span style={{ display: "block", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{m.maxDailyValue}</span>
                </div>
              </div>
              {m.contractAddress && (
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--ll-muted)" }}>
                  <span style={{ font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Contract: </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--ll-ink)" }}>{m.contractAddress.slice(0, 10)}…</span>
                </div>
              )}
            </div>

            <footer style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {m.status === "pending" && (
                <Button size="sm" onClick={() => activateMutation.mutate({ mandateId: m.mandateId, contractAddress: "0x" + Array.from({ length: 40 }, () => "0")[0] })}>
                  <CheckCircle2 size={12} /> Activate
                </Button>
              )}
              {m.status === "active" && (
                revokeConfirm === m.mandateId ? (
                  <Button variant="destructive" size="sm" onClick={() => void handleRevoke(m.mandateId)}>
                    Confirm revoke
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setRevokeConfirm(m.mandateId)}>
                    <Trash2 size={12} /> Revoke
                  </Button>
                )
              )}
            </footer>
          </article>
        ))}
      </div>

      {/* Create mandate form */}
      <section style={{ marginTop: 24 }}>
        {!showCreate ? (
          <Button variant="outline" onClick={() => setShowCreate(true)}>
            <FileSignature size={14} /> Create mandate
          </Button>
        ) : (
          <div className="connection-card" style={{ maxWidth: 640 }}>
            <header>
              <div className="connection-icon"><FileSignature size={19} /></div>
              <div>
                <span>New Sailor mandate</span>
                <h2 style={{ fontSize: 18 }}>Configure on-chain authority</h2>
              </div>
            </header>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                Chain
                <select value={formChain} onChange={(e) => setFormChain(Number(e.target.value))} style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }}>
                  {chains.map((c) => <option key={c.chainId} value={c.chainId}>{c.name}</option>)}
                </select>
              </label>

              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                Owner address
                <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="0x…" style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace" }} />
              </label>

              <div>
                <span style={{ display: "block", color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase", marginBottom: 6 }}>Scopes</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {Object.entries(scopeLabels).map(([key, { label, desc }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleScope(key)}
                      style={{
                        padding: "8px 6px",
                        border: `1px solid ${formScopes.includes(key) ? "var(--ll-blue)" : "var(--ll-line)"}`,
                        borderRadius: 4,
                        background: formScopes.includes(key) ? "var(--ll-blue-soft)" : "var(--ll-surface)",
                        color: formScopes.includes(key) ? "var(--ll-blue)" : "var(--ll-muted)",
                        font: "9px 'Chilanka',cursive",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <strong style={{ display: "block", fontSize: 10 }}>{label}</strong>
                      <small style={{ fontSize: 8, opacity: 0.7 }}>{desc}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                  Max tx value (wei)
                  <input type="text" value={formMaxTx} onChange={(e) => setFormMaxTx(e.target.value)} style={{ height: 34, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace", fontSize: 10 }} />
                </label>
                <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                  Max daily value (wei)
                  <input type="text" value={formMaxDaily} onChange={(e) => setFormMaxDaily(e.target.value)} style={{ height: 34, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace", fontSize: 10 }} />
                </label>
              </div>
            </div>

            <footer style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create mandate"}
              </Button>
            </footer>
          </div>
        )}
      </section>

      <section className="connection-warning" style={{ marginTop: 16 }}>
        <AlertTriangle size={18} />
        <div>
          <strong>Non-custodial by design</strong>
          <span>
            Sailor mandates define what the agent can do, but the agent never
            holds private keys. All signing happens through WalletConnect via
            your wallet. Mandate revocation is immediate and on-chain. Every
            execution attempt is validated against the mandate's scope and value
            caps before submission.
          </span>
        </div>
      </section>
    </div>
  );
}
