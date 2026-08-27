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

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Extra boundary for mutations that alter authority, credentials, mandates or
 * venue state. Browser requests must be same-origin and requests are bounded
 * per authenticated identity and RPC path. Non-browser server callers have no
 * Origin header and continue through their explicit authentication boundary.
 */
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

export const sensitiveProcedure = protectedProcedure.use(requireSensitiveRequestBoundary);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
