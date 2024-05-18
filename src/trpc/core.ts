import { initTRPC, TRPCError } from "@trpc/server";
import type { createContext } from "./context";
import { clearTokens, verifyAccessToken } from "../modules/auth/model";
import { db, schema } from "../db/client";
import { and, eq } from "drizzle-orm";

const t = initTRPC.context<typeof createContext>().create();

export const middleware = t.middleware;
export const router = t.router;
export const publicProcedure = t.procedure;
export const trpcError = TRPCError;
export const createCallerFactory = t.createCallerFactory;

// user procedure
const isUser = middleware(({ ctx: { req, res }, next }) => {
  try {
    const { userId } = verifyAccessToken({ req });
    return next({
      ctx: {
        user: { userId },
      },
    });
  } catch (error) {
    clearTokens({ res });
    throw new trpcError({
      code: "UNAUTHORIZED",
    });
  }
});

const isAdmin = middleware(async ({ ctx: { req, res }, next }) => {
  let userId = null;
  try {
    userId = verifyAccessToken({ req }).userId;
  } catch (error) {
    clearTokens({ res });
    throw new trpcError({
      code: "UNAUTHORIZED",
    });
  }

  const user = await db.query.users.findFirst({
    where: and(eq(schema.users.id, userId), eq(schema.users.isAdmin, true)),
  });

  if (!user) {
    throw new trpcError({
      code: "UNAUTHORIZED",
    });
  }

  return next({
    ctx: {
      user: { userId: user.id },
    },
  });
});

export const protectedProcedure = publicProcedure.use(isUser);
export const adminProcedure = publicProcedure.use(isAdmin);
