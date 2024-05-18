import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const boolean = (col: string) => integer(col, { mode: "boolean" });
const timestamp = (col: string) => integer(col, { mode: "timestamp" });

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey().notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    hashedPassword: text("hashedPassword"),
    emailVerified: boolean("emailVerified").default(false).notNull(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
    locale: text("locale").notNull(),
    timezone: text("timezone"),
    isAdmin: boolean("isAdmin").default(false).notNull(),
  },
  (table) => {
    return {
      emailIdx: uniqueIndex("emailIdx").on(table.email),
    };
  },
);

export const userRelations = relations(users, ({ many }) => ({
  teams: many(teams),
  emailVerifications: many(emailVerifications),
}));

export const emailVerifications = sqliteTable("emailVerifications", {
  id: integer("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  email: text("email").notNull(),
  otpCode: text("otpCode").notNull(),
  attempts: integer("attempts").default(0).notNull(),
});

export const emailVerificationRelations = relations(
  emailVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerifications.userId],
      references: [users.id],
    }),
  }),
);

export const emailChangeRequests = sqliteTable("emailChangeRequests", {
  id: integer("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  newEmail: text("newEmail").notNull(),
  otpCode: text("otpCode").notNull(),
});

export const passwordResetRequests = sqliteTable("passwordResetRequests", {
  id: integer("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  token: text("token").notNull(),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
  isPersonal: boolean("isPersonal").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
});

export const teamsRelations = relations(teams, ({ one }) => ({
  user: one(users, {
    fields: [teams.userId],
    references: [users.id],
  }),
  subscriptions: one(subscriptions, {
    fields: [teams.id],
    references: [subscriptions.teamId],
  }),
}));

export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
  price: text("price").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey().notNull(),
  planId: integer("planId")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict", onUpdate: "restrict" }),
  teamId: integer("teamId")
    .notNull()
    .references(() => teams.id, { onDelete: "restrict", onUpdate: "restrict" }),
  isActive: boolean("isActive"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const subscriptionRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    plan: one(plans, {
      fields: [subscriptions.planId],
      references: [plans.id],
    }),
    team: one(teams, {
      fields: [subscriptions.teamId],
      references: [teams.id],
    }),
    orders: many(orders),
  }),
);

// we are create new order if the subscription is active and subscription expired
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey().notNull(),
  subscriptionId: integer("subscriptionId")
    .notNull()
    .references(() => subscriptions.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
  price: text("price").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const orderRelations = relations(orders, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [orders.id],
    references: [subscriptions.id],
  }),
  subscriptionActivations: one(subscriptionActivations, {
    fields: [orders.id],
    references: [subscriptionActivations.orderId],
  }),
}));

export const subscriptionActivations = sqliteTable("subscriptionActivations", {
  id: integer("id").primaryKey().notNull(),
  orderId: integer("orderId")
    .notNull()
    .references(() => orders.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const subscriptionActivationsRelations = relations(
  subscriptionActivations,
  ({ one }) => ({
    order: one(orders, {
      fields: [subscriptionActivations.orderId],
      references: [orders.id],
    }),
  }),
);
