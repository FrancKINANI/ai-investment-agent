import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getExecutionBackendRegistry } from "../backends/registry";
import { createOperatorAction } from "../db";
import { nanoid } from "nanoid";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // ── Execution backend management ────────────────────────────────────────

  /** List available execution backends and current active one. */
  executionBackends: publicProcedure.query(() => {
    const registry = getExecutionBackendRegistry();
    const backends = registry.backends();
    const active = registry.active();
    return {
      activeType: active.type,
      activeLabel: active.label,
      backends: Array.from(backends.entries()).map(([type, backend]) => ({
        type,
        label: backend.label,
        isCurrent: type === active.type,
      })),
    };
  }),

  /** Switch the active execution backend (admin only). */
  switchExecutionBackend: adminProcedure
    .input(z.object({
      backend: z.enum(["paper", "cex"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = getExecutionBackendRegistry();
      const target = registry.get(input.backend);
      if (!target) {
        throw new Error(`Backend "${input.backend}" is not registered.`);
      }

      const previous = registry.active().type;
      registry.setActive(input.backend);

      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "agent_configured",
        status: "success",
        subject: `Execution backend: ${target.label}`,
        detail: `Owner switched execution backend from ${previous} to ${input.backend}. ${input.backend === "cex" ? "Live Binance orders are now possible when authority + mandate + key conditions are met." : "Paper execution mode. No real capital at risk."}`,
        payload: { previous, current: input.backend, label: target.label },
      });

      return {
        success: true,
        previous,
        current: input.backend,
        label: target.label,
      };
    }),
});
