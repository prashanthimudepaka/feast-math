import { anchorTableForPrompt } from "@/lib/engine/anchors";
import {
  DISH_CATEGORIES,
  INGREDIENT_CATEGORIES,
  planParamsSchema,
  type EventInput,
  type PlanParams,
} from "@/lib/plan/types";

// Google AI Studio free tier — no card required, ~250 requests/day on flash,
// far above this app's own 10-generations/day rate limit.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// JSON Schema for the model's output. Gemini receives it verbatim in the
// system instruction; zod (planParamsSchema) is the actual enforcement.
const PARAMS_JSON_SCHEMA = {
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

Respond with ONLY one JSON object — no markdown fences, no commentary — that validates against this JSON Schema, with one dishes entry per menu dish using EXACTLY the given dish names:
${JSON.stringify(PARAMS_JSON_SCHEMA)}`;
}

/** The model produced unusable output (empty, invalid JSON) — the loop
 * retries once with this message as feedback. Real API failures (bad key,
 * quota, network) are NOT this error and propagate to the route. */
class ModelOutputError extends Error {}

/** Some models wrap JSON in markdown fences despite instructions. */
function stripFences(s: string): string {
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(s.trim());
  return m ? m[1] : s.trim();
}

// 2.5 Flash variants think by default, and thinking tokens share the output
// budget (finishReason MAX_TOKENS with truncated/empty JSON). Budget 0 turns
// thinking off — but only flash/flash-lite accept 0, and models without
// thinking reject thinkingConfig outright, so gate on the model name.
const canDisableThinking = /gemini-2\.5-flash/.test(GEMINI_MODEL);

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Transient 429/5xx and network blips get up to 2 backed-off retries (the
 * Anthropic SDK did this automatically; plain fetch must). Client errors
 * (400/401/403) throw immediately so the route's key/quota mapping fires. */
async function fetchGeminiWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (attempt >= 2) throw err;
      await sleep(500 * 2 ** attempt + Math.random() * 250);
      continue;
    }
    if (res.ok) return res;
    const body = (await res.text()).slice(0, 500);
    if (attempt < 2 && RETRYABLE_STATUS.has(res.status)) {
      // Honor small Retry-After hints; free-tier 429s can ask for tens of
      // seconds, which would blow the route budget — fall back to backoff.
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(
        retryAfter > 0 && retryAfter <= 5
          ? retryAfter * 1000
          : 500 * 2 ** attempt + Math.random() * 250,
      );
      continue;
    }
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }
}

async function callGemini(prompt: string): Promise<unknown> {
  const res = await fetchGeminiWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          // No maxOutputTokens: the model's own ceiling is the safest cap
          // across overridable models; the schema already bounds the JSON.
          ...(canDisableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    },
  );
  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  // A blocked prompt fails identically on retry — plain Error skips it.
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt (${data.promptFeedback.blockReason}).`);
  }

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (text) {
    try {
      return JSON.parse(stripFences(text));
    } catch {
      // fall through to the finishReason-aware errors below
    }
  }
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new ModelOutputError(
      "response was truncated at the output token limit — return more compact JSON (shorter notes, fewer leftover ideas)",
    );
  }
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Gemini stopped generation (${candidate.finishReason}).`);
  }
  throw new ModelOutputError(text ? "response was not valid JSON" : "empty response");
}

export async function generatePlanParams(
  input: EventInput,
): Promise<{ params: PlanParams; model: string }> {
  // Offline demo mode wins over everything: zero API calls, zero cost.
  if (process.env.FEAST_MOCK_PLAN === "1") {
    const { mockPlanParams } = await import("./mock-params");
    return { params: mockPlanParams(input), model: "mock (offline demo)" };
  }

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
        : `${basePrompt}\n\nYour previous response failed validation with: ${lastError}\nCorrect these issues and respond again.`;

    let candidate: unknown;
    try {
      candidate = await callGemini(prompt);
    } catch (err) {
      if (err instanceof ModelOutputError) {
        lastError = err.message;
        continue;
      }
      throw err;
    }

    const parsed = planParamsSchema.safeParse(candidate);
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

    return { params: parsed.data, model: GEMINI_MODEL };
  }
  throw new Error(`The model's plan parameters failed validation: ${lastError}`);
}
