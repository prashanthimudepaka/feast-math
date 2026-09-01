import Link from "next/link";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { label } from "@/lib/plan/presets";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user.name?.split(" ")[0] || "there";

  const myEvents = session
    ? await db
        .select()
        .from(events)
        .where(eq(events.userId, session.user.id))
        .orderBy(desc(events.createdAt))
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            Namaste, {firstName} 👋
          </h1>
          <p className="mt-1 text-stone-500 dark:text-stone-400">
            Plan exactly how much to cook for your next function.
          </p>
        </div>
        <Link
          href="/dashboard/events/new"
          className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
        >
          + New event
        </Link>
      </div>

      {myEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center dark:border-stone-700 dark:bg-stone-900">
          <p className="text-4xl">🍛</p>
          <h2 className="mt-3 text-lg font-semibold text-stone-900 dark:text-stone-50">
            No events yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500 dark:text-stone-400">
            Create your first event — guests, menu, serving style — and Feast
            Math computes the quantities, shopping list, and cooking timeline.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-5 inline-block rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
          >
            Plan your first event
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myEvents.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/events/${e.id}`}
              className="rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-amber-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-amber-700"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-stone-900 dark:text-stone-50">
                  {e.title}
                </h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.status === "planned"
                      ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                      : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                  }`}
                >
                  {e.status === "planned" ? "Plan ready" : "Needs planning"}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {label(e.eventType)} · {label(e.mealType)}
              </p>
              <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
                {e.adults} adults · {e.kids} kids
                {e.eventDate ? ` · ${e.eventDate}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
