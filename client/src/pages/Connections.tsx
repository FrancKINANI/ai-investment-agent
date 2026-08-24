import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Cable, ChevronRight, CircleAlert, Landmark, Network, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const adapters = [
  { icon: Landmark, name: "Binance", category: "Centralised exchange", scopes: ["market.read", "account.read", "trade (future mandate)"], note: "Separate read and trade credentials; withdrawal access is never accepted.", docs: "Future adapter" },
  { icon: Network, name: "EVM protocols", category: "On-chain venues", scopes: ["chain.read", "mandated action (future)"], note: "Read-only chain data is available now. Real activity requires a dedicated non-custodial mandate or signer boundary.", docs: "Read-only available" },
  { icon: Cable, name: "Polymarket", category: "Prediction market", scopes: ["market.read", "signed order (future mandate)"], note: "Order acknowledgement and on-chain settlement must be reconciled separately.", docs: "Future adapter" },
];

export default function Connections() {
  const { isAuthenticated } = useAuth();
  const connectionsQuery = trpc.autonomy.connections.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createMutation = trpc.autonomy.createSimulationConnection.useMutation({ onSuccess: () => connectionsQuery.refetch() });
  const enableSimulation = async (venue: "binance" | "evm" | "polymarket", capabilities: string[]) => {
    try {
      await createMutation.mutateAsync({ venue, capabilities });
      toast.success("Simulated adapter enabled", { description: "No credential, account, wallet, or external order was connected." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable simulated adapter.");
    }
  };

  return <div className="workspace-page connections-page">
    <header className="workspace-heading"><span className="eyebrow">VENUE ADAPTERS</span><h1>Connect venues as <em>bounded capabilities.</em></h1><p>Connections are not generic “logins.” Each adapter has a known authority scope, wallet role, simulation/real mode, and revocation path. No live venue is configured in this project today.</p></header>
    <div className="connection-grid">{adapters.map((adapter) => {
      const Icon = adapter.icon;
      const venue = adapter.name === "Binance" ? "binance" : adapter.name === "EVM protocols" ? "evm" : "polymarket" as const;
      const connection = connectionsQuery.data?.find((entry) => entry.venue === venue);
      return <article className="connection-card" key={adapter.name}>
        <header><div className="connection-icon"><Icon size={19} /></div><div><span>{adapter.category}</span><h2>{adapter.name}</h2></div><b className={`connection-state ${connection ? "active" : "idle"}`}>{connection?.state ?? "Disconnected"}</b></header>
        <p>{adapter.note}</p><div className="scope-chips">{adapter.scopes.map((scope) => <span key={scope}>{scope}</span>)}</div>
        <footer><small><ShieldCheck size={13} /> {connection ? "Simulated adapter active" : adapter.docs}</small>{connection ? <Button variant="outline" onClick={() => toast.message(`${adapter.name} is simulation-only. Real credentials and execution remain unavailable.`)}>Review simulation scope <ChevronRight size={14} /></Button> : <Button variant="outline" disabled={!isAuthenticated || createMutation.isPending} onClick={() => void enableSimulation(venue, adapter.scopes)}>Enable simulation adapter <ChevronRight size={14} /></Button>}</footer>
      </article>;
    })}</div>
    <section className="connection-warning"><CircleAlert size={18} /><div><strong>Connection status is truthful by design.</strong><span>Simulation adapter records are persisted. Ledgerline will show a live venue only after its official integration, credential isolation, simulation coverage, owner mandate, and revocation path have been implemented.</span></div></section>
  </div>;
}
