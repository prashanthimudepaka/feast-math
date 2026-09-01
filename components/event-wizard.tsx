"use client";

import { useState, useTransition } from "react";
import { createEventAction } from "@/lib/actions/events";
import { label, suggestMenu } from "@/lib/plan/presets";
import {
  APPETITES,
  CUISINES,
  EVENT_TYPES,
  MEAL_TYPES,
  MENU_CATEGORIES,
  SERVING_STYLES,
  type EventInput,
} from "@/lib/plan/types";

const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";
const labelCls =
  "mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300";
const sectionCls =
  "rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 dark:border-stone-800 dark:bg-stone-900";

type MenuItem = { name: string; category: EventInput["menu"][number]["category"] };

export function EventWizard() {
  const [cuisine, setCuisine] = useState<EventInput["cuisine"]>("telugu");
  const [mealType, setMealType] = useState<EventInput["mealType"]>("lunch");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [newDish, setNewDish] = useState("");
  const [newDishCategory, setNewDishCategory] =
    useState<MenuItem["category"]>("main");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadSuggestions() {
    const suggested = suggestMenu(cuisine, mealType);
    setMenu((current) => {
      const existing = new Set(current.map((m) => m.name.toLowerCase()));
      const additions = suggested
        .filter((s) => !existing.has(s.name.toLowerCase()))
        .map((s) => ({ name: s.name, category: s.category }));
      return [...current, ...additions];
    });
  }

  function addDish() {
    const name = newDish.trim();
    if (!name) return;
    if (menu.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setNewDish("");
      return;
    }
    if (menu.length >= 20) {
      setError("Keep the menu to 20 dishes — remove one to add another.");
      return;
    }
    setMenu([...menu, { name, category: newDishCategory }]);
    setNewDish("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      eventType: String(form.get("eventType") ?? ""),
      cuisine,
      mealType,
      servingStyle: String(form.get("servingStyle") ?? ""),
      eventDate: String(form.get("eventDate") ?? ""),
      serveTime: String(form.get("serveTime") ?? ""),
      adults: String(form.get("adults") ?? ""),
      kids: String(form.get("kids") ?? "0"),
      appetite: String(form.get("appetite") ?? "average"),
      dietaryNotes: String(form.get("dietaryNotes") ?? ""),
      menu,
    };
    if (menu.length === 0) {
      setError("Add at least one dish — try “Load suggested menu”.");
      return;
    }
    startTransition(async () => {
      const result = await createEventAction(payload);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <section className={sectionCls}>
        <h2 className="mb-4 text-base font-semibold text-stone-900 dark:text-stone-50">
          The function
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className={labelCls}>
              Event name
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={120}
              placeholder="Housewarming lunch"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="eventType" className={labelCls}>
              Occasion
            </label>
            <select id="eventType" name="eventType" className={inputCls} defaultValue="housewarming">
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cuisine" className={labelCls}>
              Cuisine
            </label>
            <select
              id="cuisine"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value as EventInput["cuisine"])}
              className={inputCls}
            >
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mealType" className={labelCls}>
              Meal
            </label>
            <select
              id="mealType"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as EventInput["mealType"])}
              className={inputCls}
            >
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="servingStyle" className={labelCls}>
              Serving style
            </label>
            <select id="servingStyle" name="servingStyle" className={inputCls} defaultValue="buffet">
              {SERVING_STYLES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eventDate" className={labelCls}>
              Date <span className="text-stone-400">(optional)</span>
            </label>
            <input id="eventDate" name="eventDate" type="date" className={inputCls} />
          </div>
          <div>
            <label htmlFor="serveTime" className={labelCls}>
              Serving time <span className="text-stone-400">(optional)</span>
            </label>
            <input id="serveTime" name="serveTime" type="time" className={inputCls} />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="mb-4 text-base font-semibold text-stone-900 dark:text-stone-50">
          Guests
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="adults" className={labelCls}>
              Adults
            </label>
            <input
              id="adults"
              name="adults"
              type="number"
              min={1}
              max={2000}
              required
              defaultValue={50}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="kids" className={labelCls}>
              Kids (4–12)
            </label>
            <input
              id="kids"
              name="kids"
              type="number"
              min={0}
              max={1000}
              defaultValue={10}
              className={inputCls}
            />
          </div>
          <div>
            <span className={labelCls}>Appetite</span>
            <div className="flex gap-2">
              {APPETITES.map((a) => (
                <label
                  key={a}
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-stone-300 px-2 py-2.5 text-sm text-stone-700 has-[:checked]:border-amber-600 has-[:checked]:bg-amber-50 has-[:checked]:font-medium has-[:checked]:text-amber-800 dark:border-stone-700 dark:text-stone-300 dark:has-[:checked]:bg-amber-950/40 dark:has-[:checked]:text-amber-400"
                >
                  <input
                    type="radio"
                    name="appetite"
                    value={a}
                    defaultChecked={a === "average"}
                    className="sr-only"
                  />
                  {label(a)}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="dietaryNotes" className={labelCls}>
              Dietary notes <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="dietaryNotes"
              name="dietaryNotes"
              maxLength={500}
              rows={2}
              placeholder="e.g., pure veg, no onion or garlic"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">
            Menu <span className="text-sm font-normal text-stone-400">({menu.length}/20)</span>
          </h2>
          <button
            type="button"
            onClick={loadSuggestions}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
          >
            Load suggested menu
          </button>
        </div>

        {menu.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            No dishes yet. Load the suggested menu for your cuisine and meal, then
            adjust — or add dishes yourself.
          </p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {menu.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-700"
              >
                <span className="text-sm text-stone-900 dark:text-stone-100">
                  {m.name}
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                    {label(m.category)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => setMenu(menu.filter((x) => x.name !== m.name))}
                  className="rounded px-2 py-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newDish}
            onChange={(e) => setNewDish(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDish();
              }
            }}
            maxLength={80}
            placeholder="Add a dish, e.g. Gutti vankaya"
            className={inputCls + " flex-1"}
          />
          <select
            value={newDishCategory}
            onChange={(e) =>
              setNewDishCategory(e.target.value as MenuItem["category"])
            }
            className={inputCls + " sm:w-36"}
            aria-label="Dish category"
          >
            {MENU_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addDish}
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Add
          </button>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating event…" : "Create event"}
      </button>
    </form>
  );
}
