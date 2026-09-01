import type { ComputedPlan } from "@/lib/plan/types";

// Linear, print-friendly rendering of a full plan. Server component —
// used by the public share page and the owner's print view.

type ItemRow = {
  id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  packSuggestion: string | null;
  checked: boolean;
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

const h2Cls =
  "mt-8 mb-3 border-b border-stone-300 pb-1 text-sm font-bold uppercase tracking-wide text-stone-700 dark:border-stone-700 dark:text-stone-300 print:text-black";

export function PlanDocument({
  title,
  chips,
  guestsLine,
  dateLine,
  dietaryNotes,
  menu,
  computed,
  version,
  model,
  generatedOn,
  items,
}: {
  title: string;
  chips: string[];
  guestsLine: string;
  dateLine: string | null;
  dietaryNotes: string | null;
  menu: { name: string; note: string | null }[];
  computed: ComputedPlan;
  version: number;
  model: string;
  generatedOn: string;
  items: ItemRow[];
}) {
  const grouped = items.reduce<Record<string, ItemRow[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <article className="mx-auto w-full max-w-3xl text-stone-900 dark:text-stone-100 print:text-black">
      <header className="border-b-2 border-stone-900 pb-4 dark:border-stone-100 print:border-black">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-500 print:text-black">
          Feast Math · food plan
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 print:text-black">
          {chips.join(" · ")} · {guestsLine}
          {dateLine ? ` · ${dateLine}` : ""}
        </p>
        {dietaryNotes && (
          <p className="mt-1 text-sm font-medium">Dietary: {dietaryNotes}</p>
        )}
      </header>

      <section>
        <h2 className={h2Cls}>Menu ({menu.length})</h2>
        <p className="text-sm leading-7">
          {menu.map((m, i) => (
            <span key={m.name}>
              {i > 0 && " · "}
              {m.name}
              {m.note ? (
                <em className="text-stone-500 print:text-black"> ({m.note})</em>
              ) : null}
            </span>
          ))}
        </p>
      </section>

      <section>
        <h2 className={h2Cls}>Cooking quantities</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500 dark:border-stone-700 print:text-black">
                <th className="py-1.5 pr-3">Dish</th>
                <th className="py-1.5 pr-3">Cook</th>
                <th className="py-1.5 pr-3">Range</th>
                <th className="py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {computed.dishes.map((d) => (
                <tr
                  key={d.name}
                  className="border-b border-stone-200 align-top dark:border-stone-800"
                >
                  <td className="py-2 pr-3 font-medium">{d.name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap font-bold">
                    {d.quantity.display}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-stone-500 print:text-black">
                    {d.rangeMin.display} – {d.rangeSafe.display}
                  </td>
                  <td className="py-2 text-stone-500 print:text-black">
                    {d.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className={h2Cls}>Shopping list</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(grouped).map(([category, rows]) => (
            <div key={category} className="break-inside-avoid">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400 print:text-black">
                {INGREDIENT_LABELS[category] ?? category}
              </h3>
              <ul className="text-sm leading-7">
                {rows.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>
                      {item.checked ? "☑" : "☐"} {item.name}
                    </span>
                    <span className="whitespace-nowrap font-medium">
                      {fmt(item.quantity, item.unit)}
                      {item.packSuggestion ? ` (${item.packSuggestion})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={h2Cls}>Cooking timeline</h2>
        <ol className="text-sm leading-7">
          {computed.timeline.map((t, i) => (
            <li key={`${t.dish}-${i}`} className="flex gap-3">
              <span className="w-40 shrink-0 font-semibold">{t.clock}</span>
              <span>
                {t.action}{" "}
                <span className="text-stone-400 print:text-black">
                  — {t.dish}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {computed.leftovers.length > 0 && (
        <section>
          <h2 className={h2Cls}>Leftover plan</h2>
          <ul className="text-sm leading-7">
            {computed.leftovers.map((l) => (
              <li key={l.dish}>
                <span className="font-medium">{l.dish}:</span>{" "}
                {l.ideas.join("; ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {computed.generalNotes.length > 0 && (
        <section>
          <h2 className={h2Cls}>Caterer's notes</h2>
          <ul className="list-disc pl-5 text-sm leading-7">
            {computed.generalNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-stone-300 pt-3 text-xs text-stone-400 dark:border-stone-700 print:text-black">
        Plan version {version} · generated {generatedOn} · quantities include a
        caterer-style safety buffer · Feast Math
      </footer>
    </article>
  );
}
