import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, menuItems, plans, shares, shoppingItems } from "@/lib/db/schema";
import { label } from "@/lib/plan/presets";
import type { ComputedPlan } from "@/lib/plan/types";
import { GeneratePlanButton } from "@/components/generate-plan-button";
import { MenuEditor } from "@/components/menu-editor";
import { PlanView } from "@/components/plan-view";
import { ShareControls } from "@/components/share-controls";

function normalizeMenu(
  list: { name: string; category: string; note?: string | null }[],
): string {
  return list
    .map(
      (m) =>
        `${m.name.trim().toLowerCase()}|${m.category}|${(m.note ?? "").trim().toLowerCase()}`,
    )
    .sort()
    .join(";");
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, session.user.id)))
    .limit(1);
  if (!event) notFound();

  const menu = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.eventId, event.id))
    .orderBy(menuItems.sortOrder);

  const [latestPlan] = await db
    .select()
    .from(plans)
    .where(eq(plans.eventId, event.id))
    .orderBy(desc(plans.version))
    .limit(1);

  const items = latestPlan
    ? await db
        .select()
        .from(shoppingItems)
        .where(eq(shoppingItems.planId, latestPlan.id))
        .orderBy(shoppingItems.sortOrder)
    : [];

  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.eventId, event.id))
    .limit(1);

  const snapshotMenu =
    (
      latestPlan?.inputSnapshot as
        | { menu?: { name: string; category: string; note?: string }[] }
        | undefined
    )?.menu ?? [];
  const menuChanged = latestPlan
    ? normalizeMenu(menu) !== normalizeMenu(snapshotMenu)
    : false;

  const chips = [
    label(event.eventType),
    label(event.cuisine),
    label(event.mealType),
    label(event.servingStyle),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          {event.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300"
            >
              {c}
            </span>
          ))}
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            {event.adults} adults · {event.kids} kids
          </span>
          {event.eventDate && (
            <span className="text-xs text-stone-400">
              {event.eventDate}
              {event.serveTime ? ` · serving ${event.serveTime}` : ""}
            </span>
          )}
        </div>
        {event.dietaryNotes && (
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Dietary: {event.dietaryNotes}
          </p>
        )}
      </div>

      <MenuEditor
        eventId={event.id}
        items={menu.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          note: m.note,
        }))}
      />

      {!latestPlan && (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-900">
          <p className="text-3xl">🍛</p>
          <h2 className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-50">
            Ready to plan
          </h2>
          <p className="mx-auto mt-1 mb-5 max-w-md text-sm text-stone-500 dark:text-stone-400">
            Feast Math will work out per-dish quantities, an aggregated
            shopping list, and a cooking timeline for {event.adults} adults and{" "}
            {event.kids} kids.
          </p>
          <div className="mx-auto max-w-sm">
            <GeneratePlanButton eventId={event.id} hasPlan={false} />
          </div>
        </section>
      )}

      {latestPlan && menuChanged && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ The menu has changed since version {latestPlan.version} was
          generated — regenerate the plan to update quantities and the
          shopping list.
        </div>
      )}

      {latestPlan && (
        <>
          <PlanView
            computed={latestPlan.computed as ComputedPlan}
            version={latestPlan.version}
            model={latestPlan.model}
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
          <div className="max-w-sm">
            <GeneratePlanButton eventId={event.id} hasPlan={true} />
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Share &amp; print
              </h2>
              <a
                href={`/dashboard/events/${event.id}/print`}
                className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-500"
              >
                🖨️ Print view
              </a>
            </div>
            <ShareControls
              eventId={event.id}
              existingSlug={share?.slug ?? null}
            />
          </section>
        </>
      )}
    </div>
  );
}
