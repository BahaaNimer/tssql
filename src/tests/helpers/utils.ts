import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";
import { ENV_CONFIG } from "../../env.config";
import { createCallerFactory } from "../../trpc/core";
import { appRouter } from "../../trpc/router";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { SQLiteInsertValue } from "drizzle-orm/sqlite-core";

interface FastifyRequestWithCookie extends FastifyRequest {
  cookies: { [cookieName: string]: string | undefined };
}

const jwtSecret = ENV_CONFIG.JWT_SECRET;
export const createCaller = (
  (appRouter) =>
  ({
    req,
    res,
  }: {
    req?: Partial<FastifyRequestWithCookie>;
    res?: FastifyReply | object;
  }) => {
    const caller = createCallerFactory(appRouter);
    return caller({ req: req as FastifyRequest, res: res as FastifyReply });
  }
)(appRouter);

export const createAuthenticatedCaller = ({ userId }: { userId: number }) => {
  const accessToken = jwt.sign({ userId }, jwtSecret);
  return createCaller({
    req: { cookies: { accessToken } },
    res: {
      setCookie: () => {},
    },
  });
};

type User = {
  email: string;
  password: string;
  name: string;
  timezone: string;
  locale: string;
};
export const setupUser = async (user: User) => {
  //register user
  await createCaller({}).auth.register(user);
  const userInDb = await db.query.users.findFirst({
    where: eq(schema.users.email, user.email),
  });

  //create authenticated caller
  const authenticatedUser = createAuthenticatedCaller({
    userId: userInDb!.id,
  });

  //get OTP form db to verify User
  const verifyRequest = await db.query.emailVerifications.findFirst({
    where: eq(schema.emailVerifications.email, user.email),
  });

  //verify user
  const { teamId } = await authenticatedUser.auth.emailVerifySubmit({
    email: user.email,
    otpCode: verifyRequest!.otpCode,
  });

  return { teamId, authenticatedUser };
};

export const setupAdmin = async (user: User) => {
  const admin = (
    await db
      .insert(schema.users)
      .values({
        ...user,
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
  )[0];

  if (!admin) {
    throw new Error("couldn't create a new Admin.");
  }

  return {
    admin,
    authenticatedAdmin: createAuthenticatedCaller({ userId: admin.id }),
  };
};

export const getOrSetAdmin = async (
  user: User,
): ReturnType<typeof setupAdmin> => {
  const admin = await db.query.users.findFirst({
    where: and(
      eq(schema.users.email, user.email),
      eq(schema.users.isAdmin, true),
    ),
  });
  if (!admin) {
    return setupAdmin(user);
  }

  return {
    admin,
    authenticatedAdmin: createAuthenticatedCaller({ userId: admin.id }),
  };
};

export const setupTeam = async (userId = 1) => {
  return (
    await db
      .insert(schema.teams)
      .values({
        createdAt: new Date(),
        isPersonal: true,
        name: "soso team",
        updatedAt: new Date(),
        userId: userId,
      })
      .returning()
  )[0];
};

export const getOrSetTeam = async (userId = 1) => {
  let team = await db.query.teams.findFirst({
    where: eq(schema.teams.userId, userId),
  });
  if (!team) {
    team = await setupTeam(userId);
  }

  return team;
};

export const setupPlan = async (
  plan: SQLiteInsertValue<typeof schema.plans>,
) => {
  return (await db.insert(schema.plans).values(plan).returning())[0];
};

export const setupSubscriptionForTeam = async (teamId = 1, planId = 1) => {
  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, planId),
  });

  if (!plan) {
    throw Error("plan doesn't exits");
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });

  if (!team) {
    throw Error("team doesn't exits");
  }

  const subscription = (
    await db
      .insert(schema.subscriptions)
      .values({
        planId,
        teamId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
  )[0];

  if (!subscription?.id) {
    throw Error("subscription doesn't exits");
  }

  const order = (
    await db
      .insert(schema.orders)
      .values({
        price: plan.price,
        subscriptionId: subscription.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
  )[0];

  if (!order) {
    throw Error("subscription doesn't exits");
  }

  const subscriptionActivations = await db
    .insert(schema.subscriptionActivations)
    .values({
      orderId: order.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  console.log(subscriptionActivations);
  return {
    order,
    subscription,
    subscriptionActivations,
  };
};
