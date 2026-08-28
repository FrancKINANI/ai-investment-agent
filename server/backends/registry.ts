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
  private backendMap = new Map<ExecutionBackendType, ExecutionBackend>();
  private activeType: ExecutionBackendType = "paper"; // Default: paper/sandbox

  constructor() {
    // Always register paper (for testing + simulation)
    this.backendMap.set("paper", new PaperExecutionBackend());

    // Register other backends (may throw if config missing)
    try {
      this.backendMap.set("cex", new CEXExecutionBackend());
    } catch (error) {
      console.info("CEX backend not available:", error instanceof Error ? error.message : "unknown error");
    }

    try {
      this.backendMap.set("onchain", new OnchainExecutionBackend());
    } catch (error) {
      console.info("On-chain backend not available:", error instanceof Error ? error.message : "unknown error");
    }
  }

  backends(): Map<ExecutionBackendType, ExecutionBackend> {
    return new Map(this.backendMap);
  }

  get(type: ExecutionBackendType): ExecutionBackend | undefined {
    return this.backendMap.get(type);
  }

  active(): ExecutionBackend {
    const backend = this.backendMap.get(this.activeType);
    if (!backend) {
      throw new Error(`Active execution backend '${this.activeType}' is not registered.`);
    }
    return backend;
  }

  register(backend: ExecutionBackend): void {
    this.backendMap.set(backend.type, backend);
  }

  /**
   * Set the active backend (for config or testing).
   * Throws if the requested backend is not registered.
   */
  setActive(type: ExecutionBackendType): void {
    if (!this.backendMap.has(type)) {
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
