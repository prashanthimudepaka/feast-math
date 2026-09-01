"use client";

import { useState, useTransition } from "react";
import {
  addMenuItemAction,
  deleteMenuItemAction,
  updateMenuItemAction,
} from "@/lib/actions/events";
import { label } from "@/lib/plan/presets";
import { MENU_CATEGORIES } from "@/lib/plan/types";

type MenuRow = {
  id: string;
  name: string;
  category: string;
  note: string | null;
};

const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";
const smallBtnCls =
  "rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800";

function RowEditor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: { name: string; category: string; note: string };
  pending: boolean;
  onSave: (values: { name: string; category: string; note: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [note, setNote] = useState(initial.note);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Dish name"
        aria-label="Dish name"
        className={inputCls + " sm:flex-1"}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Dish category"
        className={inputCls + " sm:w-32"}
      >
        {MENU_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {label(c)}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={120}
        placeholder="Enrichment, e.g. extra ghee, less spicy"
        aria-label="Customization note"
        className={inputCls + " sm:flex-1"}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave({ name, category, note })}
          className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : onCancel ? "Save" : "Add dish"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={smallBtnCls}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function MenuEditor({
  eventId,
  items,
}: {
  eventId: string;
  items: MenuRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setError(result.error);
      } else {
        after?.();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Menu ({items.length}/20)
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
          >
            + Add dish
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-700"
          >
            {editingId === m.id ? (
              <RowEditor
                initial={{
                  name: m.name,
                  category: m.category,
                  note: m.note ?? "",
                }}
                pending={pending}
                onSave={(v) =>
                  run(
                    () =>
                      updateMenuItemAction(m.id, {
                        name: v.name,
                        category: v.category,
                        note: v.note || undefined,
                      }),
                    () => setEditingId(null),
                  )
                }
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-stone-900 dark:text-stone-100">
                    {m.name}
                  </span>
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                    {label(m.category)}
                  </span>
                  {m.note && (
                    <p className="mt-0.5 truncate text-xs italic text-amber-700 dark:text-amber-500">
                      ✦ {m.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditingId(m.id);
                      setAdding(false);
                      setError(null);
                    }}
                    className={smallBtnCls}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${m.name}`}
                    onClick={() => run(() => deleteMenuItemAction(m.id))}
                    className={smallBtnCls}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-3 rounded-lg border border-dashed border-amber-300 p-3 dark:border-amber-800">
          <RowEditor
            initial={{ name: "", category: "main", note: "" }}
            pending={pending}
            onSave={(v) =>
              run(
                () =>
                  addMenuItemAction(eventId, {
                    name: v.name,
                    category: v.category,
                    note: v.note || undefined,
                  }),
                () => setAdding(false),
              )
            }
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </section>
  );
}
