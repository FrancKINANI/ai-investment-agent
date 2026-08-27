/**
 * ExecutionBackendRegistry: Load and manage available execution backends.
 * 
 * Backends are configured via config/execution/backend.yaml or environment variables.
 * Registry enforces that only enabled backends are available to agents.
 */

import { PaperExecutionBackend } from "./paper.backend";
import { CEXExecutionBackend } from "./cex.backend";
import { OnchainExecutionBackend } from "./onchain.backend";
import type { ExecutionBackend, ExecutionBackendRegistry, ExecutionBackendType } from "@shared/executionBackend";

class DefaultExecutionBackendRegistry implements ExecutionBackendRegistry {
  private backends = new Map<ExecutionBackendType, ExecutionBackend>();
  private activeType: ExecutionBackendType = "paper"; // Default: paper/sandbox

  constructor() {
    // Always register paper (for testing + simulation)
    this.backends.set("paper", new PaperExecutionBackend());

    // Register other backends (may throw if config missing)
    try {
      this.backends.set("cex", new CEXExecutionBackend());
    } catch (error) {
      console.info("CEX backend not available:", error instanceof Error ? error.message : "unknown error");
    }

    try {
      this.backends.set("onchain", new OnchainExecutionBackend());
    } catch (error) {
      console.info("On-chain backend not available:", error instanceof Error ? error.message : "unknown error");
    }
  }

  backends(): Map<ExecutionBackendType, ExecutionBackend> {
    return new Map(this.backends);
  }

  get(type: ExecutionBackendType): ExecutionBackend | undefined {
    return this.backends.get(type);
  }

  active(): ExecutionBackend {
    const backend = this.backends.get(this.activeType);
    if (!backend) {
      throw new Error(`Active execution backend '${this.activeType}' is not registered.`);
    }
    return backend;
  }

  register(backend: ExecutionBackend): void {
    this.backends.set(backend.type, backend);
  }

  /**
   * Set the active backend (for config or testing).
   * Throws if the requested backend is not registered.
   */
  setActive(type: ExecutionBackendType): void {
    if (!this.backends.has(type)) {
      throw new Error(`Cannot set active backend: '${type}' is not registered.`);
    }
    this.activeType = type;
  }
}

// Singleton registry
let registry: ExecutionBackendRegistry | null = null;

export function getExecutionBackendRegistry(): ExecutionBackendRegistry {
  if (!registry) {
    registry = new DefaultExecutionBackendRegistry();
  }
  return registry;
}

/**
 * Set the global registry (for testing).
 */
export function setExecutionBackendRegistry(reg: ExecutionBackendRegistry): void {
  registry = reg;
}
