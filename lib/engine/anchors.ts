import type { DISH_CATEGORIES } from "@/lib/plan/types";

// Caterer anchor table: sane per-average-adult COOKED amounts for one dish
// inside a MULTI-DISH function meal. Claude is shown this table and asked to
// adjust within it; the engine clamps anything that escapes these bounds.
// Sources: institutional/bulk-cooking rules of thumb.

export type Anchor = {
  unit: "kg" | "l" | "count";
  min: number;
  max: number;
  typical: number;
};

export const ANCHORS: Partial<
  Record<(typeof DISH_CATEGORIES)[number], Anchor>
> = {
  rice_main: { unit: "kg", min: 0.15, max: 0.5, typical: 0.3 }, // cooked rice
  biryani: { unit: "kg", min: 0.25, max: 0.6, typical: 0.4 },
  wet_curry: { unit: "l", min: 0.06, max: 0.25, typical: 0.12 }, // sambar, rasam, gravies
  dal: { unit: "l", min: 0.05, max: 0.18, typical: 0.09 },
  dry_curry: { unit: "kg", min: 0.05, max: 0.15, typical: 0.08 },
  bread: { unit: "count", min: 1, max: 4, typical: 2 },
  tiffin_item: { unit: "count", min: 2, max: 5, typical: 3 }, // idli, dosa, vada as mains
  fried_snack: { unit: "count", min: 1, max: 3, typical: 2 },
  sweet: { unit: "count", min: 1, max: 3, typical: 1.5 },
  dessert_liquid: { unit: "l", min: 0.05, max: 0.15, typical: 0.09 },
  curd: { unit: "kg", min: 0.03, max: 0.12, typical: 0.06 },
  pickle_papad: { unit: "kg", min: 0.005, max: 0.03, typical: 0.012 },
  beverage: { unit: "l", min: 0.1, max: 0.3, typical: 0.18 },
  salad: { unit: "kg", min: 0.02, max: 0.08, typical: 0.04 },
};

export const APPETITE_MULTIPLIER: Record<string, number> = {
  light: 0.85,
  average: 1.0,
  heavy: 1.15,
};

export const SERVING_STYLE_MULTIPLIER: Record<string, number> = {
  banana_leaf: 1.0, // controlled portions, servers refill
  plated: 0.95, // most controlled
  buffet: 1.1, // self-serve piling + plate waste
  self_service: 1.05,
};

// Running out is a catastrophe; leftovers are not. Caterers over-provision.
export const SAFETY_BUFFER = 1.08;

export function anchorTableForPrompt(): string {
  return Object.entries(ANCHORS)
    .map(
      ([cat, a]) =>
        `- ${cat}: ${a.min}–${a.max} ${a.unit} per adult (typical ${a.typical} ${a.unit})`,
    )
    .join("\n");
}
