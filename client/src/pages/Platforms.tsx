import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unplug,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

const platforms = [
  { id: "binance", name: "Binance", category: "Centralised exchange" },
  { id: "okx", name: "OKX", category: "Centralised exchange" },
  { id: "coinbase", name: "Coinbase", category: "Centralised exchange" },
  { id: "kraken", name: "Kraken", category: "Centralised exchange" },
  { id: "polymarket", name: "Polymarket", category: "Prediction market" },
] as const;

const recommendedPermissions = ["spot:trade", "spot:read"];

type BinKey = { keyId: string; platform: string; label: string; keyPrefix: string; state: string };

function LiveTradingSection({ binanceKeys }: { binanceKeys: BinKey[] }) {
  const [selectedKey, setSelectedKey] = useState(binanceKeys[0]?.keyId ?? "");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [showOrderConfirm, setShowOrderConfirm] = useState(false);

  const balanceQuery = trpc.live.balances.useQuery(
    { platformKeyId: selectedKey },
    { enabled: !!selectedKey, retry: false, refetchInterval: 30_000 }
  );
  const tickerQuery = trpc.live.ticker.useQuery(
    { symbol },
    { enabled: !!symbol, retry: false, refetchInterval: 10_000 }
  );
  const placeOrderMutation = trpc.live.placeOrder.useMutation({
    onSuccess: () => {
      setShowOrderConfirm(false);
      toast.error("Live venue mutations remain sealed.");
    },
    onError: () => toast.error("Live venue mutations remain sealed; no order was sent."),
  });

  const ticker = tickerQuery.data;
  const balances = balanceQuery.data ?? [];
  const usdtBalance = balances.find((b) => b.asset === "USDT" || b.asset === "BUSD");

  const handlePlaceOrder = () => {
    if (!selectedKey) return toast.error("Select an API key first.");
    if (!symbol) return toast.error("Enter a symbol.");
    if (orderType === "LIMIT" && !price) return toast.error("Limit orders require a price.");
    if (!quantity && !price) return toast.error("Enter a quantity or quote amount.");
    setShowOrderConfirm(true);
  };

  const confirmOrder = () => {
    placeOrderMutation.mutate();
  };

  return (
    <section style={{ marginTop: 24 }}>
      <span className="eyebrow" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <Zap size={12} /> LIVE TRADING
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Balances */}
        <div style={{ padding: 18, border: "1px solid var(--ll-line)", borderRadius: 7, background: "var(--ll-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <strong style={{ color: "var(--ll-ink)", fontSize: 12 }}>Account Balances</strong>
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={{ height: 28, padding: "0 6px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontSize: 9 }}>
              {binanceKeys.map((k) => <option key={k.keyId} value={k.keyId}>{k.label} ({k.keyPrefix})</option>)}
            </select>
          </div>
          {usdtBalance && (
            <div style={{ padding: "10px 0", borderBottom: "1px solid var(--ll-line)", marginBottom: 8 }}>
              <span style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Available USDT</span>
              <strong style={{ display: "block", color: "var(--ll-ink)", fontSize: 20, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                ${usdtBalance.free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              <span style={{ color: "var(--ll-muted)", fontSize: 9 }}>
                Locked: ${usdtBalance.locked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div style={{ display: "grid", gap: 4 }}>
            {balances.filter((b) => b.asset !== "USDT" && b.asset !== "BUSD" && b.total > 0).slice(0, 8).map((b) => (
              <div key={b.asset} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ll-ink)", padding: "3px 0", borderBottom: "1px solid var(--ll-line)" }}>
                <span style={{ fontWeight: 500 }}>{b.asset}</span>
                <span style={{ fontFamily: "'DM Mono',monospace" }}>{b.total.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
            ))}
            {balances.length === 0 && <span style={{ color: "var(--ll-muted)", fontSize: 10 }}>No balances found.</span>}
          </div>
        </div>

        {/* Order Form */}
        <div style={{ padding: 18, border: "1px solid var(--ll-line)", borderRadius: 7, background: "var(--ll-surface)" }}>
          <strong style={{ color: "var(--ll-ink)", fontSize: 12 }}>Place Order</strong>
          {ticker && (
            <div style={{ marginTop: 8, padding: "8px 0", borderBottom: "1px solid var(--ll-line)" }}>
              <span style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>{ticker.symbol}</span>
              <strong style={{ display: "block", color: "var(--ll-ink)", fontSize: 18, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              <span style={{ color: Number(ticker.priceChangePercent) >= 0 ? "var(--ll-success)" : "var(--ll-danger)", fontSize: 10 }}>
                {Number(ticker.priceChangePercent) >= 0 ? "+" : ""}{ticker.priceChangePercent}%
              </span>
            </div>
          )}
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
              Symbol
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} style={{ height: 34, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace" }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" onClick={() => setOrderSide("BUY")} style={{ flex: 1, height: 32, border: `1px solid ${orderSide === "BUY" ? "var(--ll-success)" : "var(--ll-line)"}`, borderRadius: 4, background: orderSide === "BUY" ? "color-mix(in srgb, var(--ll-success) 12%, var(--ll-surface))" : "var(--ll-surface-2)", color: orderSide === "BUY" ? "var(--ll-success)" : "var(--ll-muted)", font: "9px 'DM Mono',monospace", cursor: "pointer" }}>BUY</button>
                <button type="button" onClick={() => setOrderSide("SELL")} style={{ flex: 1, height: 32, border: `1px solid ${orderSide === "SELL" ? "var(--ll-danger)" : "var(--ll-line)"}`, borderRadius: 4, background: orderSide === "SELL" ? "color-mix(in srgb, var(--ll-danger) 12%, var(--ll-surface))" : "var(--ll-surface-2)", color: orderSide === "SELL" ? "var(--ll-danger)" : "var(--ll-muted)", font: "9px 'DM Mono',monospace", cursor: "pointer" }}>SELL</button>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" onClick={() => setOrderType("MARKET")} style={{ flex: 1, height: 32, border: `1px solid ${orderType === "MARKET" ? "var(--ll-blue)" : "var(--ll-line)"}`, borderRadius: 4, background: orderType === "MARKET" ? "var(--ll-blue-soft)" : "var(--ll-surface-2)", color: orderType === "MARKET" ? "var(--ll-blue)" : "var(--ll-muted)", font: "9px 'DM Mono',monospace", cursor: "pointer" }}>MARKET</button>
                <button type="button" onClick={() => setOrderType("LIMIT")} style={{ flex: 1, height: 32, border: `1px solid ${orderType === "LIMIT" ? "var(--ll-blue)" : "var(--ll-line)"}`, borderRadius: 4, background: orderType === "LIMIT" ? "var(--ll-blue-soft)" : "var(--ll-surface-2)", color: orderType === "LIMIT" ? "var(--ll-blue)" : "var(--ll-muted)", font: "9px 'DM Mono',monospace", cursor: "pointer" }}>LIMIT</button>
              </div>
            </div>
            <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
              {orderType === "MARKET" ? "Quote amount (USDT)" : "Quantity"}
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={orderType === "MARKET" ? "100" : "0.001"} style={{ height: 34, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace" }} />
            </label>
            {orderType === "LIMIT" && (
              <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                Price (USDT)
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={{ height: 34, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontFamily: "'DM Mono',monospace" }} />
              </label>
            )}
            <Button onClick={handlePlaceOrder} disabled={!selectedKey || placeOrderMutation.isPending} style={{ marginTop: 4 }}>
              {placeOrderMutation.isPending ? "Placing…" : `Place ${orderSide} order`}
            </Button>
          </div>
        </div>
      </div>

      {/* Order confirmation dialog */}
      {showOrderConfirm && (
        <div style={{ marginTop: 12, padding: 16, border: "2px solid var(--ll-warn, #e0a030)", borderRadius: 7, background: "color-mix(in srgb, var(--ll-warn, #e0a030) 8%, var(--ll-surface))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} style={{ color: "var(--ll-warn, #e0a030)" }} />
            <strong style={{ color: "var(--ll-ink)", fontSize: 12 }}>Confirm Live Order</strong>
          </div>
          <p style={{ color: "var(--ll-muted)", fontSize: 10, margin: "0 0 8px", lineHeight: 1.5 }}>
            You are about to place a <strong style={{ color: orderSide === "BUY" ? "var(--ll-success)" : "var(--ll-danger)" }}>{orderSide}</strong> {orderType} order for <strong>{symbol}</strong>.
            {orderType === "MARKET" && quantity && <span> Amount: ${Number(quantity).toLocaleString()} USDT.</span>}
            {orderType === "LIMIT" && <span> {quantity} @ ${Number(price).toLocaleString()}.</span>}
            This is a real order on Binance. All actions are logged and audited.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setShowOrderConfirm(false)}>Cancel</Button>
            <Button size="sm" onClick={confirmOrder} disabled={placeOrderMutation.isPending}>
              {placeOrderMutation.isPending ? "Placing…" : "Confirm order"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Platforms() {
  const { isAuthenticated } = useAuth();
  const keysQuery = trpc.security.platforms.listKeys.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const addKeyMutation = trpc.security.platforms.addKey.useMutation({
    onSuccess: () => {
      keysQuery.refetch();
      setShowAddForm(false);
      resetForm();
    },
  });

  const testMutation = trpc.security.platforms.testConnection.useMutation({
    onSuccess: () => keysQuery.refetch(),
  });

  const disableMutation = trpc.security.platforms.disable.useMutation({
    onSuccess: () => keysQuery.refetch(),
  });

  const deleteMutation = trpc.security.platforms.delete.useMutation({
    onSuccess: () => {
      keysQuery.refetch();
      setDeleteConfirm(null);
    },
  });

  const updateLimitsMutation = trpc.security.platforms.updateLimits.useMutation({
    onSuccess: () => {
      keysQuery.refetch();
      setEditingLimits(null);
    },
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Add form state
  const [formPlatform, setFormPlatform] = useState<string>("binance");
  const [formLabel, setFormLabel] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formApiSecret, setFormApiSecret] = useState("");
  const [formPermissions, setFormPermissions] = useState("spot:trade,spot:read");
  const [formWithdraw, setFormWithdraw] = useState(false);
  const [formMaxOrder, setFormMaxOrder] = useState("");
  const [formAllocated, setFormAllocated] = useState("");
  const [formDailyLimit, setFormDailyLimit] = useState("");

  // Limits editing state
  const [limitsMaxOrder, setLimitsMaxOrder] = useState("");
  const [limitsAllocated, setLimitsAllocated] = useState("");
  const [limitsDaily, setLimitsDaily] = useState("");

  const resetForm = () => {
    setFormPlatform("binance");
    setFormLabel("");
    setFormApiKey("");
    setFormApiSecret("");
    setFormPermissions("spot:trade,spot:read");
    setFormWithdraw(false);
    setFormMaxOrder("");
    setFormAllocated("");
    setFormDailyLimit("");
  };

  const handleAddKey = async () => {
    if (!formApiKey.trim() || !formApiSecret.trim()) {
      return toast.error("API key and secret are required.");
    }
    if (formWithdraw) {
      toast.warning("Warning: Adding a key with withdrawal permissions is a security risk.", {
        duration: 6000,
      });
    }
    try {
      await addKeyMutation.mutateAsync({
        platform: formPlatform as "binance" | "okx" | "coinbase" | "kraken" | "polymarket",
        label: formLabel || `${formPlatform} key`,
        apiKey: formApiKey,
        apiSecret: formApiSecret,
        permissions: formPermissions.split(",").map((p) => p.trim()).filter(Boolean),
        hasWithdrawPermission: formWithdraw,
        maxOrderUsd: formMaxOrder ? Number(formMaxOrder) : undefined,
        allocatedCapitalUsd: formAllocated ? Number(formAllocated) : undefined,
        dailyTradeLimit: formDailyLimit ? Number(formDailyLimit) : undefined,
      });
      toast.success("API key added successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add API key.");
    }
  };

  const handleTest = async (keyId: string) => {
    try {
      await testMutation.mutateAsync({ keyId });
      toast.success("Connection test passed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed.");
    }
  };

  const handleDisable = async (keyId: string) => {
    try {
      await disableMutation.mutateAsync({ keyId });
      toast.success("API key disabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disable key.");
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await deleteMutation.mutateAsync({ keyId });
      toast.success("API key deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete key.");
    }
  };

  const handleUpdateLimits = async (keyId: string) => {
    try {
      await updateLimitsMutation.mutateAsync({
        keyId,
        maxOrderUsd: limitsMaxOrder ? Number(limitsMaxOrder) : undefined,
        allocatedCapitalUsd: limitsAllocated ? Number(limitsAllocated) : undefined,
        dailyTradeLimit: limitsDaily ? Number(limitsDaily) : undefined,
      });
      toast.success("Limits updated.");
      setEditingLimits(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update limits.");
    }
  };

  const startEditLimits = (key: { maxOrderUsd: number | null; allocatedCapitalUsd: number | null; dailyTradeLimit: number | null }) => {
    setLimitsMaxOrder(key.maxOrderUsd?.toString() ?? "");
    setLimitsAllocated(key.allocatedCapitalUsd?.toString() ?? "");
    setLimitsDaily(key.dailyTradeLimit?.toString() ?? "");
  };

  const keys = keysQuery.data ?? [];

  return (
    <div className="workspace-page">
      <header className="workspace-heading">
        <span className="eyebrow">PLATFORMS &amp; API KEYS</span>
        <h1>
          Connect exchanges as <em>bounded capabilities.</em>
        </h1>
        <p>
          API keys grant read and trade access only. Withdrawal permissions are
          strongly discouraged and trigger a critical security alert. Secrets are
          encrypted at rest and never shown in clear text after initial entry.
        </p>
      </header>

      {/* Existing keys */}
      <div className="connection-grid" style={{ marginTop: 22 }}>
        {keys.length === 0 && (
          <div className="connection-card" style={{ gridColumn: "1 / -1", display: "grid", placeContent: "center", minHeight: 180 }}>
            <p style={{ textAlign: "center", color: "var(--ll-muted)" }}>
              No API keys configured. Add a key below to connect a platform.
            </p>
          </div>
        )}
        {keys.map((key) => {
          const platform = platforms.find((p) => p.id === key.platform);
          return (
            <article className="connection-card" key={key.keyId}>
              <header>
                <div className="connection-icon">
                  <KeyRound size={19} />
                </div>
                <div>
                  <span>{platform?.category ?? key.platform}</span>
                  <h2>{key.label}</h2>
                </div>
                <b className={`connection-state ${key.state === "active" ? "active" : "idle"}`}>
                  {key.state}
                </b>
              </header>

              <div style={{ marginTop: 14 }}>
                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <dt style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Key prefix</dt>
                    <dd style={{ color: "var(--ll-ink)", fontSize: 11, marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
                      {key.keyPrefix}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Permissions</dt>
                    <dd style={{ color: "var(--ll-ink)", fontSize: 10, marginTop: 4 }}>
                      {key.permissions.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>Withdraw</dt>
                    <dd style={{ color: key.hasWithdrawPermission ? "var(--ll-danger)" : "var(--ll-muted)", fontSize: 10, marginTop: 4 }}>
                      {key.hasWithdrawPermission ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <ShieldAlert size={12} /> Enabled
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <ShieldCheck size={12} /> Disabled
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {key.hasWithdrawPermission && (
                <div style={{ marginTop: 10, padding: "8px 10px", borderLeft: "2px solid var(--ll-danger)", background: "color-mix(in srgb, var(--ll-danger) 8%, var(--ll-surface))", fontSize: 10, color: "var(--ll-danger)" }}>
                  <strong>⚠ Withdrawal permissions are enabled.</strong>
                  <span style={{ display: "block", marginTop: 3, color: "var(--ll-muted)" }}>
                    This key can move funds off the platform. Ledgerline recommends disabling withdrawal access.
                  </span>
                </div>
              )}

              {/* Limits section */}
              {editingLimits === key.keyId ? (
                <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--ll-line)", borderRadius: 5, background: "var(--ll-surface)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                      Max order (USD)
                      <input type="number" value={limitsMaxOrder} onChange={(e) => setLimitsMaxOrder(e.target.value)} style={{ height: 32, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontSize: 10 }} />
                    </label>
                    <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                      Allocated capital (USD)
                      <input type="number" value={limitsAllocated} onChange={(e) => setLimitsAllocated(e.target.value)} style={{ height: 32, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontSize: 10 }} />
                    </label>
                    <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                      Daily trade limit
                      <input type="number" value={limitsDaily} onChange={(e) => setLimitsDaily(e.target.value)} style={{ height: 32, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface-2)", color: "var(--ll-ink)", fontSize: 10 }} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                    <Button variant="outline" size="sm" onClick={() => setEditingLimits(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => void handleUpdateLimits(key.keyId)}>Save limits</Button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", fontSize: 9, color: "var(--ll-muted)" }}>
                  {key.maxOrderUsd && <span>Max order: ${key.maxOrderUsd.toLocaleString()}</span>}
                  {key.allocatedCapitalUsd && <span>Allocated: ${key.allocatedCapitalUsd.toLocaleString()}</span>}
                  {key.dailyTradeLimit && <span>Daily limit: {key.dailyTradeLimit}</span>}
                  {!key.maxOrderUsd && !key.allocatedCapitalUsd && !key.dailyTradeLimit && <span>No limits configured</span>}
                </div>
              )}

              <footer>
                <small>
                  <ShieldCheck size={13} /> {key.state === "active" ? "Key active" : key.state === "disabled" ? "Key disabled" : "Testing"}
                </small>
                <div className="proposal-actions">
                  <Button variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => void handleTest(key.keyId)}>
                    <Zap size={12} /> Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingLimits(key.keyId); startEditLimits(key); }}>
                    Limits
                  </Button>
                  {key.state === "active" ? (
                    <Button variant="outline" size="sm" onClick={() => void handleDisable(key.keyId)}>
                      <Unplug size={12} /> Disable
                    </Button>
                  ) : null}
                  {deleteConfirm === key.keyId ? (
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete(key.keyId)}>
                      Confirm delete
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(key.keyId)}>
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {/* Add key form */}
      <section style={{ marginTop: 24 }}>
        {!showAddForm ? (
          <Button variant="outline" onClick={() => setShowAddForm(true)}>
            <KeyRound size={14} /> Add API key
          </Button>
        ) : (
          <div className="connection-card" style={{ maxWidth: 640 }}>
            <header>
              <div className="connection-icon"><KeyRound size={19} /></div>
              <div>
                <span>Add new API key</span>
                <h2>Configure platform credentials</h2>
              </div>
            </header>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                Platform
                <select value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)} style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }}>
                  {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>

              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                Label
                <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g. Main trading key" style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
              </label>

              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                API Key
                <input type="password" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} placeholder="Enter API key" style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
              </label>

              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                API Secret
                <input type="password" value={formApiSecret} onChange={(e) => setFormApiSecret(e.target.value)} placeholder="Enter API secret" style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
              </label>

              <label style={{ display: "grid", gap: 5, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace", textTransform: "uppercase" }}>
                Permissions (comma-separated)
                <input type="text" value={formPermissions} onChange={(e) => setFormPermissions(e.target.value)} placeholder="spot:trade,spot:read" style={{ height: 36, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                <input type="checkbox" id="withdraw-check" checked={formWithdraw} onChange={(e) => setFormWithdraw(e.target.checked)} style={{ width: 16, height: 16 }} />
                <label htmlFor="withdraw-check" style={{ color: formWithdraw ? "var(--ll-danger)" : "var(--ll-muted)", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                  <ShieldAlert size={13} /> Enable withdrawal permission (strongly discouraged)
                </label>
              </div>

              {formWithdraw && (
                <div style={{ padding: "8px 10px", borderLeft: "2px solid var(--ll-danger)", background: "color-mix(in srgb, var(--ll-danger) 8%, var(--ll-surface))", fontSize: 10, color: "var(--ll-danger)" }}>
                  <strong>⚠ Security warning</strong>
                  <span style={{ display: "block", marginTop: 3, color: "var(--ll-muted)" }}>
                    Withdrawal permissions allow moving funds off the platform. A critical security alert will be generated. Only enable this if you understand the risks.
                  </span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                  Max order (USD)
                  <input type="number" value={formMaxOrder} onChange={(e) => setFormMaxOrder(e.target.value)} placeholder="10000" style={{ height: 32, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
                </label>
                <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                  Allocated capital (USD)
                  <input type="number" value={formAllocated} onChange={(e) => setFormAllocated(e.target.value)} placeholder="50000" style={{ height: 32, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
                </label>
                <label style={{ display: "grid", gap: 4, color: "var(--ll-muted)", font: "8px 'DM Mono',monospace" }}>
                  Daily trade limit
                  <input type="number" value={formDailyLimit} onChange={(e) => setFormDailyLimit(e.target.value)} placeholder="100" style={{ height: 32, padding: "0 8px", border: "1px solid var(--ll-line)", borderRadius: 4, background: "var(--ll-surface)", color: "var(--ll-ink)" }} />
                </label>
              </div>
            </div>

            <footer style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <Button variant="outline" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</Button>
              <Button onClick={() => void handleAddKey()} disabled={addKeyMutation.isPending}>
                {addKeyMutation.isPending ? "Adding…" : "Add key"}
              </Button>
            </footer>
          </div>
        )}
      </section>

      {/* Live Trading Section */}
      {keys.filter((k) => k.platform === "binance" && k.state === "active").length > 0 && (
        <LiveTradingSection binanceKeys={keys.filter((k) => k.platform === "binance" && k.state === "active")} />
      )}

      <section className="connection-warning" style={{ marginTop: 16 }}>
        <AlertTriangle size={18} />
        <div>
          <strong>Security posture</strong>
          <span>
            API keys are stored encrypted and never displayed in full after initial entry. CEX keys
            should be restricted to trading-only permissions. Withdrawal access triggers a critical
            alert. All key operations are logged to the immutable Activity record.
          </span>
        </div>
      </section>
    </div>
  );
}
