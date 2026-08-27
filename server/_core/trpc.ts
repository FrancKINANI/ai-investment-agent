import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { checkRateLimit } from "../security";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * LL-SEC-001 FIX: Rate limit middleware for authenticated users.
 * Applies a sliding-window rate limit per userId on all protected procedures.
 * Fail closed: exceeded limit returns 429-like error.
 */
const rateLimitMiddleware = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  const userId = ctx.user.id;
  const result = checkRateLimit(`user:${userId}`);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.`,
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Extra boundary for mutations that alter authority, credentials, mandates or venue state. */
const requireSensitiveRequestBoundary = t.middleware(async opts => {
  const { ctx, path, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const origin = ctx.req.headers.origin;
  const host = ctx.req.headers.host;
  if (typeof origin === "string" && typeof host === "string") {
    const expectedOrigin = `${ctx.req.protocol}://${host}`;
    if (origin !== expectedOrigin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cross-origin sensitive mutation rejected." });
    }
  }
  const limit = checkRateLimit(`sensitive:${ctx.user.id}:${path}`, { maxRequests: 12, windowMs: 60_000 });
  if (!limit.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Sensitive mutation rate limit exceeded. Retry after ${Math.ceil(limit.retryAfterMs / 1_000)} seconds.`,
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Revalidates the administrator role from persistent storage on every call. */
const requireAdminFresh = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || ctx.user.role !== 'admin') {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  // Re-fetch user from DB to catch mid-session role revocation
  try {
    const { getUserByOpenId } = await import("../db");
    const freshUser = await getUserByOpenId(ctx.user.openId);
    if (!freshUser || freshUser.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin role has been revoked. Please sign in again." });
    }
    return next({
      ctx: {
        ...ctx,
        user: freshUser,
      },
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    // If DB is unavailable, fail closed — don't grant admin
    throw new TRPCError({ code: "FORBIDDEN", message: "Unable to verify admin role. Please try again." });
  }
});

export const protectedProcedure = t.procedure.use(requireUser).use(rateLimitMiddleware);
export const sensitiveProcedure = protectedProcedure.use(requireSensitiveRequestBoundary);

/**
 * Admin procedure: revalidates role from DB on every call (LL-SEC-008).
 * Use for critical operations: approval, authority transitions, binding changes.
 */
export const adminProcedure = protectedProcedure.use(requireAdminFresh);
