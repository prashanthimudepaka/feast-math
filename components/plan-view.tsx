"use client";

import { useState, useTransition } from "react";
import { toggleShoppingItemAction } from "@/lib/actions/events";
import type { ComputedPlan } from "@/lib/plan/types";

type ShoppingItemRow = {
  id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  packSuggestion: string | null;
  checked: boolean;
};

const TABS = ["quantities", "shopping", "timeline", "leftovers"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  quantities: "Quantities",
  shopping: "Shopping list",
  timeline: "Timeline",
  leftovers: "Leftovers",
};

const INGREDIENT_LABELS: Record<string, string> = {
  grains_pulses: "Grains & pulses",
  vegetables_fruit: "Vegetables & fruit",
  dairy: "Dairy",
  meat_seafood: "Meat & seafood",
  oil_fat: "Oil & ghee",
  spices_condiments: "Spices & condiments",
  other: "Other",
};

function fmt(value: number, unit: string): string {
  if (unit === "count") return `${value}`;
  if (value < 1 && (unit === "kg" || unit === "l")) {
    return `${Math.round(value * 1000)} ${unit === "kg" ? "g" : "ml"}`;
  }
  const v = Math.round(value * 100) / 100;
  return `${v} ${unit}`;
}

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  const styles =
    level === "high"
      ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-400"
      : level === "medium"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
        : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {level} confidence
    </span>
  );
}

export function PlanView({
  computed,
  version,
  model,
  items,
}: {
  computed: ComputedPlan;
  version: number;
  model: string;
  items: ShoppingItemRow[];
}) {
  const [tab, setTab] = useState<Tab>("quantities");
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.checked])),
  );
  const [, startTransition] = useTransition();

  const checkedCount = items.filter((i) => checkedMap[i.id]).length;

  function toggle(id: string) {
    const next = !checkedMap[id];
    setCheckedMap((m) => ({ ...m, [id]: next })); // optimistic
    startTransition(async () => {
      const res = await toggleShoppingItemAction(id, next);
      if (!res.ok) setCheckedMap((m) => ({ ...m, [id]: !next })); // revert
    });
  }

  const grouped = items.reduce<Record<string, ShoppingItemRow[]>>(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Plan sections"
          className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800"
        >
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-50"
                  : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-400 dark:text-stone-500">
          Version {version} · {model}
        </span>
      </div>

      {tab === "quantities" && (
        <div className="flex flex-col gap-3">
          {computed.dishes.map((d) => (
            <div
              key={d.name}
              className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-stone-900 dark:text-stone-50">
                  {d.name}
                </h3>
                <ConfidenceChip level={d.confidence} />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-500">
                {d.quantity.display}
                <span className="ml-2 text-sm font-normal text-stone-400">
                  range {d.rangeMin.display} – {d.rangeSafe.display}
                </span>
              </p>
              {d.note && (
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {d.note}
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-amber-700 hover:underline dark:text-amber-500">
                  Why this number?
                </summary>
                <p className="mt-1 font-mono text-xs leading-5 text-stone-500 dark:text-stone-400">
                  {d.derivation}
                </p>
              </details>
            </div>
          ))}
          {computed.generalNotes.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="mb-1 font-semibold">Caterer's notes</p>
              <ul className="list-disc pl-5">
                {computed.generalNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "shopping" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {checkedCount} / {items.length} items purchased
          </p>
          {Object.entries(grouped).map(([category, rows]) => (
            <div
              key={category}
              className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                {INGREDIENT_LABELS[category] ?? category}
              </h3>
              <ul className="flex flex-col">
                {rows.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-800/60">
                      <input
                        type="checkbox"
                        checked={checkedMap[item.id] ?? false}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 accent-amber-700"
                      />
                      <span
                        className={`flex-1 text-sm ${
                          checkedMap[item.id]
                            ? "text-stone-400 line-through"
                            : "text-stone-900 dark:text-stone-100"
                        }`}
                      >
                        {item.name}
                      </span>
                      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                        {fmt(item.quantity, item.unit)}
                        {item.packSuggestion && (
                          <span className="ml-2 text-xs font-normal text-stone-400">
                            ({item.packSuggestion})
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "timeline" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
          <ol className="flex flex-col gap-3">
            {computed.timeline.map((t, i) => (
              <li key={`${t.dish}-${i}`} className="flex gap-3">
                <span className="w-36 shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-500">
                  {t.clock}
                </span>
                <span className="text-sm text-stone-700 dark:text-stone-300">
                  {t.action}
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                    {t.dish}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === "leftovers" && (
        <div className="flex flex-col gap-3">
          {computed.leftovers.length === 0 ? (
            <p className="text-sm text-stone-500">No leftover suggestions.</p>
          ) : (
            computed.leftovers.map((l) => (
              <div
                key={l.dish}
                className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
              >
                <h3 className="font-semibold text-stone-900 dark:text-stone-50">
                  {l.dish}
                </h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-stone-600 dark:text-stone-400">
                  {l.ideas.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Refrigerate cooked food within 2 hours and reheat thoroughly before
            reuse.
          </p>
        </div>
      )}
    </div>
  );
}
