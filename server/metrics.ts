/**
 * Prometheus Metrics Module
 *
 * Exposes /metrics endpoint for monitoring with Prometheus/Grafana.
 * Tracks HTTP requests, response times, errors, and custom business metrics.
 */

import { IncomingMessage, ServerResponse } from "http";

// ─── Metrics Storage ──────────────────────────────────────────────────────

type MetricType = "counter" | "histogram" | "gauge";

type Metric = {
  name: string;
  type: MetricType;
  help: string;
  value: number;
  labels?: Record<string, string>;
};

class MetricsRegistry {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  incrementCounter(name: string, value: number = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  }

  observeHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, value] of Array.from(this.counters.entries())) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Histograms
    for (const [name, values] of Array.from(this.histograms.entries())) {
      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const count = sorted.length;

      lines.push(`# TYPE ${name} histogram`);
      lines.push(`${name}_count ${count}`);
      lines.push(`${name}_sum ${sum.toFixed(3)}`);

      // Percentiles
      const percentiles = [0.5, 0.9, 0.95, 0.99];
      for (const p of percentiles) {
        const index = Math.ceil(p * count) - 1;
        const value = sorted[Math.max(0, index)];
        lines.push(`${name}{quantile="${p}"} ${value.toFixed(3)}`);
      }
    }

    // Gauges
    for (const [name, value] of Array.from(this.gauges.entries())) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    return lines.join("\n") + "\n";
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

// ─── Global Registry ──────────────────────────────────────────────────────

export const metrics = new MetricsRegistry();

// ─── HTTP Metrics ─────────────────────────────────────────────────────────

export function trackHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): void {
  const labels = `${method} ${path} ${statusCode}`;

  metrics.incrementCounter("http_requests_total");
  metrics.incrementCounter(`http_requests_by_status{status="${statusCode}"}`);
  metrics.observeHistogram("http_request_duration_seconds", durationMs / 1000);

  if (statusCode >= 500) {
    metrics.incrementCounter("http_errors_total");
  }
}

// ─── Business Metrics ─────────────────────────────────────────────────────

export function trackAgentExecution(venue: string, success: boolean): void {
  metrics.incrementCounter("agent_executions_total");
  metrics.incrementCounter(`agent_executions_by_venue{venue="${venue}"}`);
  if (!success) {
    metrics.incrementCounter("agent_execution_failures_total");
  }
}

export function trackOrderPlaced(platform: string, side: string): void {
  metrics.incrementCounter("orders_placed_total");
  metrics.incrementCounter(`orders_by_platform{platform="${platform}"}`);
  metrics.incrementCounter(`orders_by_side{side="${side}"}`);
}

export function trackSecurityAlert(level: string): void {
  metrics.incrementCounter("security_alerts_total");
  metrics.incrementCounter(`security_alerts_by_level{level="${level}"}`);
}

export function trackMandateAction(action: string): void {
  metrics.incrementCounter("mandate_actions_total");
  metrics.incrementCounter(`mandate_actions_by_type{action="${action}"}`);
}

// ─── Metrics Endpoint ─────────────────────────────────────────────────────

export function handleMetricsRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  const body = metrics.getMetrics();

  res.writeHead(200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  });
  res.end(body);
}

// ─── Metrics Middleware ───────────────────────────────────────────────────

export function createMetricsMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const method = req.method || "GET";
      const url = req.url || "/";
      const statusCode = res.statusCode || 200;

      // Don't track metrics endpoint itself
      if (url !== "/metrics") {
        trackHttpRequest(method, url, statusCode, duration);
      }
    });

    next();
  };
}
