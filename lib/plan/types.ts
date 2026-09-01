import { z } from "zod";

// ---------- Wizard input ----------

export const EVENT_TYPES = [
  "housewarming",
  "wedding",
  "birthday",
  "pooja",
  "other",
] as const;
export const CUISINES = [
  "telugu",
  "andhra",
  "telangana",
  "tamil",
  "north_indian",
  "mixed",
] as const;
export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "tiffin"] as const;
export const SERVING_STYLES = [
  "banana_leaf",
  "buffet",
  "plated",
  "self_service",
] as const;
export const APPETITES = ["light", "average", "heavy"] as const;
export const MENU_CATEGORIES = [
  "welcome",
  "main",
  "side",
  "sweet",
  "special",
] as const;

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, "Give the event a name").max(120),
  eventType: z.enum(EVENT_TYPES),
  cuisine: z.enum(CUISINES),
  mealType: z.enum(MEAL_TYPES),
  servingStyle: z.enum(SERVING_STYLES),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  serveTime: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
    .optional()
    .or(z.literal("")),
  adults: z.coerce.number().int().min(1).max(2000),
  kids: z.coerce.number().int().min(0).max(1000),
  appetite: z.enum(APPETITES),
  dietaryNotes: z.string().trim().max(500).optional(),
  menu: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        category: z.enum(MENU_CATEGORIES),
        note: z.string().trim().max(120).optional(),
      }),
    )
    .min(1, "Add at least one dish")
    .max(20, "Keep the menu to 20 dishes"),
});

export type EventInput = z.infer<typeof eventInputSchema>;

// ---------- Claude's output: per-dish parameters (never final quantities) ----------

export const DISH_CATEGORIES = [
  "rice_main",
  "biryani",
  "wet_curry",
  "dal",
  "dry_curry",
  "bread",
  "tiffin_item",
  "fried_snack",
  "sweet",
  "dessert_liquid",
  "curd",
  "pickle_papad",
  "beverage",
  "salad",
  "other",
] as const;

export const INGREDIENT_CATEGORIES = [
  "grains_pulses",
  "vegetables_fruit",
  "dairy",
  "spices_condiments",
  "oil_fat",
  "meat_seafood",
  "other",
] as const;

export const dishParamsSchema = z.object({
  name: z.string().min(1).max(80),
  dishCategory: z.enum(DISH_CATEGORIES),
  cookedUnit: z.enum(["kg", "l", "count"]),
  perAdult: z.number().positive().max(5),
  kidFactor: z.number().min(0.2).max(1),
  note: z.string().max(300),
  confidence: z.enum(["high", "medium", "low"]),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        category: z.enum(INGREDIENT_CATEGORIES),
        perAdult: z.number().positive(),
        unit: z.enum(["kg", "g", "l", "ml", "count"]),
      }),
    )
    .min(1)
    .max(15),
  prep: z.object({
    steps: z
      .array(
        z.object({
          minutesBeforeServe: z.number().int().min(0).max(2880),
          action: z.string().min(1).max(200),
        }),
      )
      .min(1)
      .max(5),
  }),
  leftoverIdeas: z.array(z.string().max(120)).max(3),
});

export const planParamsSchema = z.object({
  dishes: z.array(dishParamsSchema).min(1).max(20),
  generalNotes: z.array(z.string().max(250)).max(5),
});

export type DishParams = z.infer<typeof dishParamsSchema>;
export type PlanParams = z.infer<typeof planParamsSchema>;

// ---------- Engine output ----------

export type Quantity = {
  value: number;
  unit: "kg" | "l" | "count";
  display: string;
};

export type ComputedDish = {
  name: string;
  dishCategory: (typeof DISH_CATEGORIES)[number];
  quantity: Quantity;
  rangeMin: Quantity;
  rangeSafe: Quantity;
  derivation: string;
  confidence: "high" | "medium" | "low";
  clamped: boolean;
  note: string;
};

export type ShoppingLine = {
  category: (typeof INGREDIENT_CATEGORIES)[number];
  name: string;
  value: number;
  unit: "kg" | "l" | "count";
  display: string;
  packSuggestion: string | null;
  fromDishes: string[];
};

export type TimelineEntry = {
  minutesBeforeServe: number;
  clock: string | null;
  action: string;
  dish: string;
};

export type ComputedPlan = {
  guests: { adults: number; kids: number; appetite: string };
  multipliers: {
    appetite: number;
    servingStyle: number;
    safetyBuffer: number;
  };
  dishes: ComputedDish[];
  shoppingList: ShoppingLine[];
  timeline: TimelineEntry[];
  leftovers: { dish: string; ideas: string[] }[];
  generalNotes: string[];
};
