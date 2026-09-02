import { ANCHORS } from "@/lib/engine/anchors";
import type { DISH_CATEGORIES, EventInput, PlanParams } from "@/lib/plan/types";

type DishCat = (typeof DISH_CATEGORIES)[number];

// Offline demo mode (FEAST_MOCK_PLAN=1): produces structurally identical,
// plausible parameters without calling the API. Used for development and
// demos; real generations replace this the moment a Gemini API key is
// configured and the flag is off.

const KEYWORDS: [RegExp, DishCat][] = [
  [/biryani/i, "biryani"],
  [/pulihora|tamarind rice|jeera rice|fried rice|bagara|lemon rice/i, "rice_main"],
  [/\brice\b/i, "rice_main"],
  // Beverages must outrank wet_curry: bare "butter"/"masala" would otherwise
  // classify Buttermilk and Masala chaas as curries (≈⅓ under-provisioned).
  [/buttermilk|chaas|coffee|tea|juice|panakam/i, "beverage"],
  [/sambar|rasam|kurma|masala\b|gravy|butter|makhani|stew/i, "wet_curry"],
  [/\bdal\b|pappu/i, "dal"],
  [/curry|sabzi|fry|poriyal|thoran/i, "dry_curry"],
  [/roti|naan|chapati|puri|paratha/i, "bread"],
  [/idli|dosa|upma|pongal|vada/i, "tiffin_item"],
  [/pakora|bajji|samosa|snack/i, "fried_snack"],
  [/payasam|kheer|basundi/i, "dessert_liquid"],
  [/laddu|jamun|kesari|halwa|sweet|barfi|mysore pak/i, "sweet"],
  [/curd|raita|perugu/i, "curd"],
  [/pickle|papad|chutney|podi/i, "pickle_papad"],
  [/salad|kosambari/i, "salad"],
];

function guessCategory(name: string): DishCat {
  for (const [re, cat] of KEYWORDS) {
    if (re.test(name)) return cat;
  }
  return "other";
}

export function mockPlanParams(input: EventInput): PlanParams {
  return {
    dishes: input.menu.map((m) => {
      const cat = guessCategory(m.name);
      const anchor = ANCHORS[cat];
      const perAdult = anchor?.typical ?? 0.08;
      const unit = anchor?.unit ?? "kg";
      return {
        name: m.name,
        dishCategory: cat,
        cookedUnit: unit,
        perAdult,
        kidFactor: 0.5,
        note: `Demo estimate for ${m.name} (offline mock — not AI-generated).`,
        confidence: "medium" as const,
        ingredients: [
          {
            name: `${m.name.toLowerCase()} main ingredients`,
            category: "other" as const,
            perAdult: unit === "count" ? Math.max(1, perAdult) : perAdult * 0.6,
            unit: unit === "count" ? ("count" as const) : (unit as "kg" | "l"),
          },
          {
            name: "onions",
            category: "vegetables_fruit" as const,
            perAdult: 15,
            unit: "g" as const,
          },
          {
            name: "oil",
            category: "oil_fat" as const,
            perAdult: 5,
            unit: "ml" as const,
          },
        ],
        prep: {
          steps: [
            {
              minutesBeforeServe: 180,
              action: `Prep ingredients for ${m.name}`,
            },
            { minutesBeforeServe: 90, action: `Cook ${m.name}` },
          ],
        },
        leftoverIdeas: [`Refrigerate leftover ${m.name} and use within a day.`],
      };
    }),
    generalNotes: [
      "This is an OFFLINE DEMO plan (mock mode). Add a free Gemini API key (aistudio.google.com) and unset FEAST_MOCK_PLAN for real AI-calibrated parameters.",
    ],
  };
}
