import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import {
  createAuthenticatedCaller,
  createCaller,
  getOrSetAdmin,
  getOrSetTeam,
  setupAdmin,
  setupPlan,
  setupSubscriptionForTeam,
  setupUser,
} from "../helpers/utils";
import resetDb from "../helpers/resetDb";
import { trpcError } from "../../trpc/core";
import type { Plan } from "../../types";
import { TRPCError } from "@trpc/server";
import type { SQLiteInsertValue } from "drizzle-orm/sqlite-core/query-builders/insert";

const plan = {
  id: 1,
  name: "month",
  price: "100",
  createdAt: new Date(),
  updatedAt: new Date(),
};
describe("plans router", async () => {
  beforeAll(async () => {
    await resetDb();
  });

  describe("getOne", async () => {
    it("should fetch a specific plan by ID", async () => {
      await db.insert(schema.plans).values(plan);
      const planId = 1;
      const fetchedPlan = await createCaller({}).plans.getOne({
        planId,
      });
      expect(fetchedPlan).toBeDefined();
    });

    it("should throw error if plan not found", async () => {
      const planId = 999;
      await expect(
        createCaller({}).plans.getOne({
          planId,
        }),
      ).rejects.toThrowError(new trpcError({ code: "NOT_FOUND" }));
    });
  });

  describe("get", async () => {
    it("should fetch all plans", async () => {
      await db.insert(schema.plans).values({ ...plan, id: 2, price: "200" });
      await db.insert(schema.plans).values({ ...plan, id: 3, price: "300" });
      const allPlans = await createCaller({}).plans.get();
      expect(Array.isArray(allPlans)).toBe(true);
      expect(allPlans.length).toBeGreaterThan(0);
    });
  });

  describe("create", async () => {
    it("should create a new plan", async () => {
      const admin = await setupAdmin({
        name: "admin",
        email: "admin@admin1.com",
        locale: "en",
        password: "123123",
        timezone: "UTC",
      });

      const newPlan: Plan = {
        id: 1,
        name: "month",
        price: 50,
      };

      const creationResult =
        await admin.authenticatedAdmin.plans.create(newPlan);
      expect(creationResult.success).toBe(true);
    });

    it("should throw error if creation fails", async () => {
      const admin = await getOrSetAdmin({
        name: "admin",
        email: "admin@admin.com",
        locale: "en",
        password: "123123",
        timezone: "UTC",
      });

      const invalidName = {
        name: "soso",
        price: 50,
      };

      await expect(
        admin.authenticatedAdmin.plans.create(invalidName as Plan),
      ).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("update", async () => {
    it("should update an existing plan", async () => {
      const updatedPlanData: Plan = {
        id: 1,
        name: "year",
        price: 100,
      };

      const updateResult = await createAuthenticatedCaller({
        userId: 1,
      }).plans.update(updatedPlanData);
      expect(updateResult.success).toBe(true);
    });
  });

  describe("upgrade", async () => {
    it("should throw if the team doesn't exist", async () => {
      const upgradeRequest = {
        planId: 2,
        teamId: 1,
      };

      await expect(
        createAuthenticatedCaller({ userId: 1 }).plans.upgrade(upgradeRequest),
      ).rejects.toThrowError(
        new trpcError({ code: "NOT_FOUND", message: "team not found" }),
      );
    });

    it("should throw if the team is not subscribe.", async () => {
      const team = await getOrSetTeam();
      if (!team) {
        throw new Error("couldn't create team.");
      }

      const upgradeRequest = {
        planId: 2,
        teamId: team.id,
      };
      await expect(
        createAuthenticatedCaller({ userId: 1 }).plans.upgrade(upgradeRequest),
      ).rejects.toThrowError(
        new trpcError({
          code: "NOT_FOUND",
          message: "This team is not subscribe.",
        }),
      );
    });

    it("should calculate the prorated upgrade price", async () => {
      const planToSubscribe: SQLiteInsertValue<typeof schema.plans> = {
        name: "month",
        price: "20",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const planToUpgrade: SQLiteInsertValue<typeof schema.plans> = {
        name: "month",
        price: "50",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const currentPlan = await setupPlan(planToSubscribe);
      const upgradePlan = await setupPlan(planToUpgrade);
      const user = await setupUser({
        email: "bahaa@bahaa.com",
        locale: "en",
        name: "Bahaa",
        password: "hello world!",
        timezone: "Asia_Amman",
      });
      await setupSubscriptionForTeam(user.teamId, currentPlan?.id);
      const upgradeRequest = {
        planId: upgradePlan?.id as number,
        teamId: user.teamId,
      };

      const upgradePrice =
        await user.authenticatedUser.plans.upgrade(upgradeRequest);
      expect(upgradePrice).toBeDefined();
      expect(typeof upgradePrice).toBe("number");
      // Add more specific assertions based on your business logic and expectations
    });
  });
});
