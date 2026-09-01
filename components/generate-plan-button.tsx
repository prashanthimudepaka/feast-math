"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LOADING_LINES = [
  "Consulting the caterer's notebook…",
  "Weighing rice against guest count…",
  "Balancing sambar to the menu…",
  "Portioning sweets for the kids…",
  "Rounding everything to full packets…",
  "Writing the cooking timeline…",
];

export function GeneratePlanButton({
  eventId,
  hasPlan,
}: {
  eventId: string;
  hasPlan: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (busy) {
      timerRef.current = setInterval(
        () => setLineIndex((i) => (i + 1) % LOADING_LINES.length),
        2600,
      );
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [busy]);

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/generate`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
        // Keep the busy state until the refreshed page replaces this view.
        return;
      }
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-lg bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-wait disabled:opacity-80"
      >
        {busy
          ? LOADING_LINES[lineIndex]
          : hasPlan
            ? "Regenerate plan (new version)"
            : "Generate plan"}
      </button>
      {busy && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          This takes 30–60 seconds — the AI caterer is working through your menu
          dish by dish.
        </p>
      )}
    </div>
  );
}
