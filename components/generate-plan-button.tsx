"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [lineIndex, setLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Spinner stays until the refreshed server data actually renders, then the
  // button re-enables — otherwise a successful regenerate left it stuck.
  const working = busy || isPending;

  useEffect(() => {
    if (working) {
      timerRef.current = setInterval(
        () => setLineIndex((i) => (i + 1) % LOADING_LINES.length),
        2600,
      );
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [working]);

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/generate`, {
        method: "POST",
      });
      if (res.ok) {
        startTransition(() => router.refresh());
        setBusy(false); // isPending carries the spinner from here
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
        disabled={working}
        className="rounded-lg bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-wait disabled:opacity-80"
      >
        {working
          ? LOADING_LINES[lineIndex]
          : hasPlan
            ? "Regenerate plan (new version)"
            : "Generate plan"}
      </button>
      {working && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          This takes 30–60 seconds — the AI caterer is working through your menu
          dish by dish.
        </p>
      )}
    </div>
  );
}
