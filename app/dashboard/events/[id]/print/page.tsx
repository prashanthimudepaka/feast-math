import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, menuItems, plans, shoppingItems } from "@/lib/db/schema";
import { label } from "@/lib/plan/presets";
import type { ComputedPlan } from "@/lib/plan/types";
import { PlanDocument } from "@/components/plan-document";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Print plan — Feast Math" };

export default async function PrintPlanPage({
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

  const [latestPlan] = await db
    .select()
    .from(plans)
    .where(eq(plans.eventId, event.id))
    .orderBy(desc(plans.version))
    .limit(1);
  if (!latestPlan) redirect(`/dashboard/events/${event.id}`);

  const menu = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.eventId, event.id))
    .orderBy(menuItems.sortOrder);

  const items = await db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.planId, latestPlan.id))
    .orderBy(shoppingItems.sortOrder);

  return (
    <div className="print:bg-white">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/dashboard/events/${event.id}`}
          className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-500"
        >
          ← Back to event
        </Link>
        <PrintButton />
      </div>
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
    </div>
  );
}
