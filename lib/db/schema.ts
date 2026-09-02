import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

// Better Auth's tables (user, session, account, verification) live in
// ./auth-schema and are re-exported at the bottom of this file.

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventType: text("event_type").notNull(), // housewarming | wedding | birthday | pooja | other
    cuisine: text("cuisine").notNull(), // telugu | andhra | telangana | tamil | north_indian | ...
    mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | tiffin
    servingStyle: text("serving_style").notNull(), // banana_leaf | buffet | plated | self_service
    eventDate: date("event_date"),
    serveTime: text("serve_time"), // "12:30" — anchors the reverse cooking timeline
    adults: integer("adults").notNull().default(0),
    kids: integer("kids").notNull().default(0),
    appetiteProfile: jsonb("appetite_profile"), // { light, average, heavy, kidsSmall, kidsOlder }
    dietaryNotes: text("dietary_notes"),
    status: text("status").notNull().default("draft"), // draft | planned | shopping | done
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("events_user_idx").on(t.userId)],
);

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(), // welcome | main | special | sweet | side
  source: text("source").notNull().default("user"), // suggested | user
  reason: text("reason"), // why the AI suggested it — shown in the UI
  note: text("note"), // user's customization, e.g. "extra ghee", "less spicy"
  sortOrder: integer("sort_order").notNull().default(0),
});

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    inputSnapshot: jsonb("input_snapshot").notNull(), // event + menu as sent to the model
    params: jsonb("params").notNull(), // the model's per-dish rates & multipliers
    computed: jsonb("computed").notNull(), // deterministic engine output: quantities, ranges, timeline, leftovers
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("plans_event_version_idx").on(t.eventId, t.version)],
);

export const shoppingItems = pgTable("shopping_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // grains | vegetables | dairy | spices | other
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(), // kg | g | l | ml | count | packet
  packSuggestion: text("pack_suggestion"), // "2 × 1 kg"
  checked: boolean("checked").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    role: text("role").notNull().default("family"), // family | caterer | shopper
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // One live slug per event: concurrent createShareAction calls must not
  // mint parallel links the UI can never show or revoke.
  (t) => [uniqueIndex("shares_event_unique_idx").on(t.eventId)],
);

// Rate limiting counts ATTEMPTS (inserted before the model call), so failed
// generations burn quota and the check-then-act race fails closed.
export const generationAttempts = pgTable(
  "generation_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("generation_attempts_user_time_idx").on(t.userId, t.createdAt)],
);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  dishName: text("dish_name").notNull(),
  predictedQty: numeric("predicted_qty", { precision: 10, scale: 2 }),
  unit: text("unit"),
  verdict: text("verdict").notNull(), // too_little | right | too_much
  actualQty: numeric("actual_qty", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export * from "./auth-schema";
