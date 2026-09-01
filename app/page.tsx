import Link from "next/link";
import { headers } from "next/headers";
import { getOptionalSession } from "@/lib/auth";

const features = [
  {
    icon: "🛒",
    title: "Exact shopping list",
    body: "Per-ingredient quantities, aggregated across dishes and rounded to real pack sizes.",
  },
  {
    icon: "⏱️",
    title: "Cooking timeline",
    body: "A backwards-planned schedule from serving time — what to soak, chop, and start when.",
  },
  {
    icon: "♻️",
    title: "Leftover plan",
    body: "A safety buffer sized like a caterer would, plus what to do with what remains.",
  },
];

export default async function Home() {
  const session = await getOptionalSession(await headers());

  return (
    <main className="flex flex-1 flex-col items-center bg-stone-50 px-4 dark:bg-stone-950">
      <section className="flex w-full max-w-3xl flex-col items-center py-24 text-center">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium tracking-wide text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-400">
          AI event-food planning
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl dark:text-stone-50"
          style={{ textWrap: "balance" }}
        >
          Feeding 60 people?
          <br />
          Feast Math tells you how much to cook.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600 dark:text-stone-400">
          Guest count, menu, and serving style in — a complete shopping list,
          cooking timeline, and leftover plan out. The caterer&apos;s head
          math, done properly.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
            >
              Open your dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="rounded-lg bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
              >
                Get started free
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid w-full max-w-4xl gap-4 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900"
          >
            <p className="text-2xl">{f.icon}</p>
            <h2 className="mt-3 font-semibold text-stone-900 dark:text-stone-50">
              {f.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-stone-500 dark:text-stone-400">
              {f.body}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
