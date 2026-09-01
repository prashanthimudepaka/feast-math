"use client";

import { useEffect, useState, useTransition } from "react";
import { createShareAction, revokeShareAction } from "@/lib/actions/events";

export function ShareControls({
  eventId,
  existingSlug,
}: {
  eventId: string;
  existingSlug: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Read the origin after mount — reading window.location during render
  // makes the server and client HTML disagree (hydration mismatch).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = existingSlug ? `${origin}/share/${existingSlug}` : null;

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed — select the link text manually.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {shareUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {shareUrl}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await revokeShareAction(eventId);
                  if (res.error) setError(res.error);
                });
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              {pending ? "Revoking…" : "Revoke"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await createShareAction(eventId);
                if (res.error) setError(res.error);
              });
            }}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
          >
            {pending ? "Creating link…" : "Create share link"}
          </button>
          <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
            Anyone with the link can view the plan (read-only) — perfect for
            family or the caterer. No account needed.
          </p>
        </div>
      )}
    </div>
  );
}
