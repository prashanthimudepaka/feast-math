import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, menuItems, plans, shares, shoppingItems } from "@/lib/db/schema";
import { label } from "@/lib/plan/presets";
import type { ComputedPlan } from "@/lib/plan/types";
import { PlanDocument } from "@/components/plan-document";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = {
  title: "Shared plan — Feast Math",
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug || slug.length > 64) notFound();

  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.slug, slug))
    .limit(1);
  if (!share) notFound();

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, share.eventId))
    .limit(1);
  if (!event) notFound();

  const [latestPlan] = await db
    .select()
    .from(plans)
    .where(eq(plans.eventId, event.id))
    .orderBy(desc(plans.version))
    .limit(1);

  const menu = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.eventId, event.id))
    .orderBy(menuItems.sortOrder);

  const items = latestPlan
    ? await db
        .select()
        .from(shoppingItems)
        .where(eq(shoppingItems.planId, latestPlan.id))
        .orderBy(shoppingItems.sortOrder)
    : [];

  return (
    <main className="flex-1 bg-stone-50 px-4 py-10 dark:bg-stone-950 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-6 flex w-full max-w-3xl items-center justify-between">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-50"
        >
          Feast Math
        </Link>
        {latestPlan && <PrintButton />}
      </div>

      {!latestPlan ? (
        <div className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900">
          <p className="text-3xl">🍛</p>
          <h1 className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-50">
            {event.title}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            The host hasn&apos;t generated a food plan for this event yet.
            Check back soon.
          </p>
        </div>
      ) : (
        <PlanDocument
          title={event.title}
          chips={[
            label(event.eventType),
            label(event.cuisine),
            label(event.mealType),
            label(event.servingStyle),
          ]}
          guestsLine={`${event.adults} adults · ${event.kids} kids`}
          dateLine={
            event.eventDate
              ? `${event.eventDate}${event.serveTime ? ` · serving ${event.serveTime}` : ""}`
              : null
          }
          dietaryNotes={event.dietaryNotes}
          menu={menu.map((m) => ({ name: m.name, note: m.note }))}
          computed={latestPlan.computed as ComputedPlan}
          version={latestPlan.version}
          model={latestPlan.model}
          generatedOn={latestPlan.createdAt.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          items={items.map((i) => ({
            id: i.id,
            category: i.category,
            name: i.name,
            quantity: Number(i.quantity),
            unit: i.unit,
            packSuggestion: i.packSuggestion,
            checked: i.checked,
          }))}
        />
      )}
    </main>
  );
}
