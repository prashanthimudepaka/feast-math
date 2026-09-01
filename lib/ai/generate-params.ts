import Anthropic from "@anthropic-ai/sdk";
import { anchorTableForPrompt } from "@/lib/engine/anchors";
import {
  DISH_CATEGORIES,
  INGREDIENT_CATEGORIES,
  planParamsSchema,
  type EventInput,
  type PlanParams,
} from "@/lib/plan/types";

export const PLAN_MODEL = "claude-opus-5";

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    dishes: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exactly the dish name from the menu" },
          dishCategory: { type: "string", enum: [...DISH_CATEGORIES] },
          cookedUnit: { type: "string", enum: ["kg", "l", "count"] },
          perAdult: {
            type: "number",
            exclusiveMinimum: 0,
            maximum: 5,
            description:
              "Cooked amount ONE average adult eats of this dish given the full menu. No buffers.",
          },
          kidFactor: { type: "number", minimum: 0.2, maximum: 1 },
          note: { type: "string", maxLength: 300 },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          ingredients: {
            type: "array",
            minItems: 1,
            maxItems: 15,
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Canonical lowercase name, e.g. 'toor dal'" },
                category: { type: "string", enum: [...INGREDIENT_CATEGORIES] },
                perAdult: { type: "number", exclusiveMinimum: 0 },
                unit: { type: "string", enum: ["kg", "g", "l", "ml", "count"] },
              },
              required: ["name", "category", "perAdult", "unit"],
            },
          },
          prep: {
            type: "object",
            properties: {
              steps: {
                type: "array",
                minItems: 1,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    minutesBeforeServe: { type: "integer", minimum: 0, maximum: 2880 },
                    action: { type: "string", maxLength: 200 },
                  },
                  required: ["minutesBeforeServe", "action"],
                },
              },
            },
            required: ["steps"],
          },
          leftoverIdeas: { type: "array", maxItems: 3, items: { type: "string", maxLength: 120 } },
        },
        required: [
          "name",
          "dishCategory",
          "cookedUnit",
          "perAdult",
          "kidFactor",
          "note",
          "confidence",
          "ingredients",
          "prep",
          "leftoverIdeas",
        ],
      },
    },
    generalNotes: { type: "array", maxItems: 5, items: { type: "string", maxLength: 250 } },
  },
  required: ["dishes", "generalNotes"],
};

function systemPrompt(): string {
  return `You are a veteran Indian function caterer with 25 years of experience planning food for 50–500 guests, with deep knowledge of Telugu, Andhra, Telangana, Tamil and North Indian function menus.

CRITICAL ARCHITECTURE: you never compute final quantities. You output per-average-adult consumption RATES; a deterministic engine multiplies them by guest counts and applies appetite, serving-style, and safety multipliers. Therefore:

1. perAdult = the cooked amount ONE AVERAGE adult eats of this dish when the ENTIRE menu below is on the plate. A 10-dish menu means less of each dish than a 4-dish menu — account for menu breadth. Do NOT add any buffer or margin; the engine adds it.
2. Stay inside these caterer anchor ranges (per adult, cooked):
${anchorTableForPrompt()}
If your instinct falls outside a range, use the nearest bound and explain in "note".
3. kidFactor = fraction of the adult amount a typical child (4–12) eats of this dish.
4. ingredients = RAW shopping quantities per average adult for this dish, no buffers. Use canonical lowercase names so they aggregate across dishes: "rice (raw)", "toor dal", "onions", "tomatoes", "curd", "ghee", "oil". Group minor spices into a single line like "sambar spices & masala" per dish. Units: kg, g, l, ml, count only. Skip water and negligible items.
5. prep.steps: 1–5 realistic bulk-cooking steps with minutesBeforeServe (minutes before serving, max 2880 = 2 days). Think large vessels, home or small-caterer setting: soaking, chopping, cooking, tempering, final assembly.
6. leftoverIdeas: up to 3 practical next-day uses for that dish.
7. Respect the dietary notes STRICTLY (e.g., no onion/garlic for many pooja functions).
8. Some menu dishes carry a per-dish "note" — the host's customization (e.g., "extra ghee", "less spicy", "premium version with cashews and saffron"). Honor it: adjust the ingredient list (add/upgrade items), rates where relevant, and acknowledge the customization in that dish's "note" field.
9. confidence: "high" for staple function dishes you know cold, "medium"/"low" for unusual dishes or contexts.

Return the parameters ONLY by calling the submit_plan_parameters tool, with one entry per menu dish using EXACTLY the given dish names.`;
}

export async function generatePlanParams(
  input: EventInput,
): Promise<{ params: PlanParams; model: string }> {
  if (process.env.FEAST_MOCK_PLAN === "1") {
    const { mockPlanParams } = await import("./mock-params");
    return { params: mockPlanParams(input), model: "mock (offline demo)" };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPayload = {
    eventType: input.eventType,
    cuisine: input.cuisine,
    mealType: input.mealType,
    servingStyle: input.servingStyle,
    guests: { adults: input.adults, kids: input.kids, appetite: input.appetite },
    dietaryNotes: input.dietaryNotes || "none",
    menu: input.menu,
  };
  const basePrompt = `Plan parameters for this function:\n${JSON.stringify(userPayload, null, 2)}`;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nYour previous response failed validation with: ${lastError}\nCorrect these issues and call the tool again.`;

    const message = await client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 16000,
      system: systemPrompt(),
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: "submit_plan_parameters",
          description:
            "Submit per-adult consumption rates, ingredients, prep steps and leftover ideas for every dish on the menu.",
          input_schema: TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: {
        type: "tool",
        name: "submit_plan_parameters",
        disable_parallel_tool_use: true,
      },
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      lastError = "no tool call in response";
      continue;
    }
    const parsed = planParamsSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      continue;
    }

    // Reconcile against the menu: every dish exactly once, no inventions.
    const menuNames = new Set(input.menu.map((m) => m.name.trim().toLowerCase()));
    const dishNames = parsed.data.dishes.map((d) => d.name.trim().toLowerCase());
    const dishSet = new Set(dishNames);
    const missing = [...menuNames].filter((n) => !dishSet.has(n));
    const extra = dishNames.filter((n) => !menuNames.has(n));
    const hasDuplicates = dishNames.length !== dishSet.size;
    if (missing.length > 0 || extra.length > 0 || hasDuplicates) {
      lastError =
        `dishes do not match the menu — missing: [${missing.join(", ")}]; ` +
        `unexpected: [${extra.join(", ")}]${hasDuplicates ? "; duplicates present" : ""}. ` +
        `Return exactly one entry per menu dish using the exact given names.`;
      continue;
    }

    return { params: parsed.data, model: PLAN_MODEL };
  }
  throw new Error(`The model's plan parameters failed validation: ${lastError}`);
}
