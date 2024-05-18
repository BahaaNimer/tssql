import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  trpcError,
} from "../../trpc/core";
import { z } from "zod";
import { db, schema } from "../../db/client";
import { and, eq } from "drizzle-orm";
import { addDays, constructNow, differenceInDays } from "date-fns";

export const plans = router({
  getOne: publicProcedure
    .input(
      z.object({
        planId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { planId } = input;
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, planId),
      });

      if (!plan) {
        throw new trpcError({
          code: "NOT_FOUND",
        });
      }
      return plan;
    }),
  get: publicProcedure.query(async () => {
    try {
      return await db.query.plans.findMany();
    } catch (error) {
      return [];
    }
  }),
  create: adminProcedure
    .input(
      z.object({
        name: z.enum(["month", "year"]),
        price: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { name, price } = input;
        await db
          .insert(schema.plans)
          .values({
            name: name,
            price: price.toFixed(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return {
          success: true,
        };
      } catch (e) {
        console.error(e);
        return {
          success: false,
        };
      }
    }),
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.enum(["month", "year"]),
        price: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, name, price } = input;
      try {
        db.update(schema.plans)
          .set({
            name,
            price: price.toFixed(),
          })
          .where(eq(schema.plans.id, id));
        return {
          success: true,
        };
      } catch (e) {
        console.error(e);
        return {
          success: false,
        };
      }
    }),
  upgrade: protectedProcedure
    .input(
      z.object({
        planId: z.number(),
        teamId: z.number(),
      }),
    )
    .query(async ({ ctx: { user }, input }) => {
      const { planId, teamId } = input;

      const upgradedPlan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, planId),
      });

      if (!upgradedPlan) {
        throw new trpcError({
          code: "NOT_FOUND",
        });
      }

      const team = await db.query.teams.findFirst({
        where: and(
          eq(schema.plans.id, teamId),
          eq(schema.teams.userId, user.userId),
        ),
        with: {
          subscriptions: {
            with: {
              plan: true,
            },
          },
        },
      });

      if (!team) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "team not found",
        });
      }

      if (!team.subscriptions) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "This team is not subscribe.",
        });
      }

      if (!team.subscriptions.isActive) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "There is no active subscription for the given team.",
        });
      }

      if (team.subscriptions.plan.id === upgradedPlan.id) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "cant upgrade to the same plan.",
        });
      }

      if (team.subscriptions.plan.price > upgradedPlan.price) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "cant upgrade to plan less than the current plan.",
        });
      }

      const latestOrder = await db.query.orders.findFirst({
        where: eq(schema.orders.subscriptionId, team.subscriptions.id),
        with: {
          subscriptionActivations: true,
        },
        orderBy: (order, { desc }) => [desc(order.id)],
      });

      if (!latestOrder) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "invalid subscription.",
        });
      }

      if (!latestOrder.subscriptionActivations) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "not payed.",
        });
      }

      const remainingDays = differenceInDays(
        // assuming its 30 days only
        addDays(
          latestOrder.subscriptionActivations.createdAt,
          30,
        ).toISOString(),
        constructNow(new Date()).toISOString(),
      );
      const priceDifference =
        parseFloat(upgradedPlan.price) -
        parseFloat(team.subscriptions.plan.price);

      return Math.ceil((priceDifference / 30) * remainingDays); // Assuming monthly cycles
    }),
});
