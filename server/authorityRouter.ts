/**
 * Authority control plane router (Ledgerline real-mode spec v1.1, Stage 0).
 *
 * Owner-only surface for the authority state machine. Every transition is
 * validated against the versioned state machine and audit-logged.
 * This router introduces no live authority by itself: the default state is
 * `disabled` and moving up the ladder requires one explicit owner call per step.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { changeAuthorityState, getAuthorityState } from "./db";
import {
  AUTHORITY_STATE_LABELS,
  AUTHORITY_STATE_MACHINE_VERSION,
  ALLOWED_TRANSITIONS,
  AuthorityState,
} from "@shared/authorityState";

const transitionSchema = z.object({
  to: AuthorityState,
  initiatedBy: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(4).max(800),
});

export const authorityRouter = router({
  /** Current authority state + truthful label + allowed next states. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const state = await getAuthorityState(ctx.user.id);
    return {
      state,
      label: AUTHORITY_STATE_LABELS[state],
      machineVersion: AUTHORITY_STATE_MACHINE_VERSION,
      allowedTransitions: ALLOWED_TRANSITIONS[state],
      labels: AUTHORITY_STATE_LABELS,
    };
  }),

  /** Owner-initiated transition (kill switch = transition to "paused" or "revoked"). */
  transition: protectedProcedure.input(transitionSchema).mutation(async ({ ctx, input }) => {
    // Only the owner acts on their own authority record; agents have no route here.
    const result = await changeAuthorityState(ctx.user.id, input.to, input.initiatedBy || ctx.user.id.toString(), input.reason);
    if (!result.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
    }
    return result;
  }),
});
