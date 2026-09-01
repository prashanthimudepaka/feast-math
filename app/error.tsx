"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-stone-50 px-4 py-24 text-center dark:bg-stone-950">
      <p className="text-4xl">🍳</p>
      <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
        Something burned in the kitchen
      </h1>
      <p className="max-w-sm text-sm text-stone-500 dark:text-stone-400">
        An unexpected error occurred. Your data is safe — try again in a
        moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
      >
        Try again
      </button>
    </main>
  );
}
