import {
  ANCHORS,
  APPETITE_MULTIPLIER,
  SAFETY_BUFFER,
  SERVING_STYLE_MULTIPLIER,
} from "./anchors";
import type {
  ComputedDish,
  ComputedPlan,
  EventInput,
  PlanParams,
  Quantity,
  ShoppingLine,
  TimelineEntry,
} from "@/lib/plan/types";
import { label } from "@/lib/plan/presets";

// ---------- rounding & formatting ----------

/** Round a kg/l quantity UP to a shopping-friendly increment. */
function roundUpFriendly(value: number): number {
  if (value < 1) return Math.ceil(value / 0.05) * 0.05;
  if (value < 3) return Math.ceil(value / 0.25) * 0.25;
  if (value < 10) return Math.ceil(value / 0.5) * 0.5;
  return Math.ceil(value);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function display(value: number, unit: "kg" | "l" | "count"): string {
  if (unit === "count") return `${value}`;
  if (value < 1) {
    const small = Math.round(value * 1000);
    return unit === "kg" ? `${small} g` : `${small} ml`;
  }
  const v = round2(value);
  const s = Number.isInteger(v) ? `${v}` : `${v}`.replace(/0+$/, "");
  return `${s} ${unit}`;
}

function quantity(value: number, unit: "kg" | "l" | "count"): Quantity {
  return { value, unit, display: display(value, unit) };
}

function packSuggestion(value: number, unit: "kg" | "l" | "count"): string | null {
  if (unit !== "kg") return null;
  if (value >= 2) {
    const whole = Math.floor(value);
    const rem = round2(value - whole);
    return rem > 0 ? `${whole} × 1 kg + ${display(rem, "kg")}` : `${whole} × 1 kg`;
  }
  if (value >= 0.5) {
    const packs = Math.ceil(value / 0.5);
    return `${packs} × 500 g`;
  }
  return null;
}

// ---------- clock helpers ----------

function parseServeTime(serveTime: string | undefined): number | null {
  if (!serveTime) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(serveTime);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function clockLabel(serveMinutes: number | null, minutesBefore: number): string | null {
  if (serveMinutes === null) return null;
  let t = serveMinutes - minutesBefore;
  let daysBefore = 0;
  while (t < 0) {
    t += 24 * 60;
    daysBefore++;
  }
  const h = Math.floor(t / 60);
  const mm = `${t % 60}`.padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const prefix =
    daysBefore === 0 ? "" : daysBefore === 1 ? "Day before, " : `${daysBefore} days before, `;
  return `${prefix}${h12}:${mm} ${ampm}`;
}

function relativeLabel(minutesBefore: number): string {
  if (minutesBefore === 0) return "At serving time";
  const h = Math.floor(minutesBefore / 60);
  const m = minutesBefore % 60;
  if (h === 0) return `${m} min before serving`;
  if (m === 0) return `${h} h before serving`;
  return `${h} h ${m} min before serving`;
}

// ---------- the engine ----------

export function computePlan(input: EventInput, params: PlanParams): ComputedPlan {
  const appetiteMult = APPETITE_MULTIPLIER[input.appetite] ?? 1.0;
  const styleMult = SERVING_STYLE_MULTIPLIER[input.servingStyle] ?? 1.0;
  const serveMinutes = parseServeTime(input.serveTime || undefined);

  const dishes: ComputedDish[] = [];
  const shopping = new Map<
    string,
    { line: ShoppingLine; baseValue: number }
  >();
  const timeline: TimelineEntry[] = [];
  const leftovers: { dish: string; ideas: string[] }[] = [];

  for (const dish of params.dishes) {
    // 1. Clamp Claude's per-adult rate against the anchor table.
    const anchor = ANCHORS[dish.dishCategory];
    let perAdult = dish.perAdult;
    let clamped = false;
    let confidence = dish.confidence;
    let unitMismatchNote = "";
    if (anchor && anchor.unit === dish.cookedUnit) {
      if (perAdult < anchor.min || perAdult > anchor.max) {
        perAdult = Math.min(Math.max(perAdult, anchor.min), anchor.max);
        clamped = true;
        confidence = "medium";
      }
    } else if (anchor) {
      const massVolume =
        (anchor.unit === "kg" || anchor.unit === "l") &&
        (dish.cookedUnit === "kg" || dish.cookedUnit === "l");
      if (massVolume) {
        // kg<->l mismatch: cooked-food density ~1, so the numeric anchor
        // range still applies — clamp rather than leaving it unbounded.
        if (perAdult < anchor.min || perAdult > anchor.max) {
          perAdult = Math.min(Math.max(perAdult, anchor.min), anchor.max);
          clamped = true;
        }
        confidence = confidence === "high" ? "medium" : confidence;
      } else {
        // count<->mass mismatch: the range can't be applied; keep the value
        // but flag it loudly instead of silently trusting the model.
        confidence = "low";
        unitMismatchNote = ` (unit ${dish.cookedUnit} differs from caterer anchor ${anchor.unit} — verify)`;
      }
    }

    // 2. Deterministic quantity math (Claude never does this part).
    const effectiveGuests = input.adults + input.kids * dish.kidFactor;
    const raw = perAdult * effectiveGuests * appetiteMult * styleMult * SAFETY_BUFFER;
    const value =
      dish.cookedUnit === "count" ? Math.ceil(raw) : roundUpFriendly(raw);
    const rangeMin =
      dish.cookedUnit === "count"
        ? Math.ceil(raw * 0.9)
        : roundUpFriendly(raw * 0.9);
    const rangeSafe =
      dish.cookedUnit === "count"
        ? Math.ceil(raw * 1.12)
        : roundUpFriendly(raw * 1.12);

    const derivation =
      `${perAdult} ${dish.cookedUnit}/adult × (${input.adults} adults + ` +
      `${input.kids} kids × ${dish.kidFactor}) × ${appetiteMult} appetite × ` +
      `${styleMult} ${label(input.servingStyle).toLowerCase()} × ${SAFETY_BUFFER} safety ` +
      `= ${round2(raw)} ${dish.cookedUnit} → ${display(value, dish.cookedUnit)}` +
      (clamped ? ` (rate adjusted to caterer range for ${dish.dishCategory})` : "") +
      unitMismatchNote;

    dishes.push({
      name: dish.name,
      dishCategory: dish.dishCategory,
      quantity: quantity(value, dish.cookedUnit),
      rangeMin: quantity(rangeMin, dish.cookedUnit),
      rangeSafe: quantity(rangeSafe, dish.cookedUnit),
      derivation,
      confidence,
      clamped,
      note: dish.note,
    });

    // 3. Raw-ingredient shopping amounts, aggregated across dishes.
    for (const ing of dish.ingredients) {
      // Normalize g→kg and ml→l so the same ingredient aggregates cleanly.
      let unit: "kg" | "l" | "count";
      let per = ing.perAdult;
      if (ing.unit === "g") {
        unit = "kg";
        per = per / 1000;
      } else if (ing.unit === "ml") {
        unit = "l";
        per = per / 1000;
      } else {
        unit = ing.unit;
      }
      const amount = per * effectiveGuests * appetiteMult * styleMult * SAFETY_BUFFER;
      const key = `${ing.name.trim().toLowerCase()}|${unit}`;
      const existing = shopping.get(key);
      if (existing) {
        existing.baseValue += amount;
        if (!existing.line.fromDishes.includes(dish.name)) {
          existing.line.fromDishes.push(dish.name);
        }
      } else {
        shopping.set(key, {
          baseValue: amount,
          line: {
            category: ing.category,
            name: ing.name.trim(),
            value: 0,
            unit,
            display: "",
            packSuggestion: null,
            fromDishes: [dish.name],
          },
        });
      }
    }

    // 4. Timeline entries.
    for (const step of dish.prep.steps) {
      timeline.push({
        minutesBeforeServe: step.minutesBeforeServe,
        clock: clockLabel(serveMinutes, step.minutesBeforeServe),
        action: step.action,
        dish: dish.name,
      });
    }

    if (dish.leftoverIdeas.length > 0) {
      leftovers.push({ dish: dish.name, ideas: dish.leftoverIdeas });
    }
  }

  // Finalize shopping lines: round up, format, suggest packs.
  const CATEGORY_ORDER = [
    "grains_pulses",
    "vegetables_fruit",
    "dairy",
    "meat_seafood",
    "oil_fat",
    "spices_condiments",
    "other",
  ];
  const shoppingList: ShoppingLine[] = [...shopping.values()]
    .map(({ line, baseValue }) => {
      const rounded =
        line.unit === "count" ? Math.ceil(baseValue) : roundUpFriendly(baseValue);
      return {
        ...line,
        value: round2(rounded),
        display: display(rounded, line.unit),
        packSuggestion: packSuggestion(rounded, line.unit),
      };
    })
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name),
    );

  timeline.sort((a, b) => b.minutesBeforeServe - a.minutesBeforeServe);
  const timelineWithLabels = timeline.map((t) => ({
    ...t,
    clock: t.clock ?? relativeLabel(t.minutesBeforeServe),
  }));

  return {
    guests: { adults: input.adults, kids: input.kids, appetite: input.appetite },
    multipliers: {
      appetite: appetiteMult,
      servingStyle: styleMult,
      safetyBuffer: SAFETY_BUFFER,
    },
    dishes,
    shoppingList,
    timeline: timelineWithLabels,
    leftovers,
    generalNotes: params.generalNotes,
  };
}
