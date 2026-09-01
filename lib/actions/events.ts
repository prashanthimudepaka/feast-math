"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, menuItems, plans, shares, shoppingItems } from "@/lib/db/schema";
import { eventInputSchema, MENU_CATEGORIES } from "@/lib/plan/types";
import { isUuid } from "@/lib/validation";

export async function createEventAction(
  raw: unknown,
): Promise<{ error: string } | never> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const parsed = eventInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }
  const input = parsed.data;

  const [event] = await db
    .insert(events)
    .values({
      userId: session.user.id,
      title: input.title,
      eventType: input.eventType,
      cuisine: input.cuisine,
      mealType: input.mealType,
      servingStyle: input.servingStyle,
      eventDate: input.eventDate ? input.eventDate : null,
      serveTime: input.serveTime ? input.serveTime : null,
      adults: input.adults,
      kids: input.kids,
      appetiteProfile: { appetite: input.appetite },
      dietaryNotes: input.dietaryNotes ?? null,
      status: "draft",
    })
    .returning({ id: events.id });

  if (input.menu.length > 0) {
    await db.insert(menuItems).values(
      input.menu.map((m, i) => ({
        eventId: event.id,
        name: m.name,
        category: m.category,
        source: "user",
        sortOrder: i,
      })),
    );
  }

  redirect(`/dashboard/events/${event.id}`);
}

export async function toggleShoppingItemAction(
  itemId: string,
  checked: boolean,
): Promise<{ ok: boolean }> {
  if (!isUuid(itemId)) return { ok: false };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false };

  // Ownership check: item -> plan -> event -> userId.
  const rows = await db
    .select({ itemId: shoppingItems.id })
    .from(shoppingItems)
    .innerJoin(plans, eq(shoppingItems.planId, plans.id))
    .innerJoin(events, eq(plans.eventId, events.id))
    .where(and(eq(shoppingItems.id, itemId), eq(events.userId, session.user.id)))
    .limit(1);
  if (rows.length === 0) return { ok: false };

  await db
    .update(shoppingItems)
    .set({ checked })
    .where(eq(shoppingItems.id, itemId));
  return { ok: true };
}

// ---------- menu customization (add / replace / enrich) ----------

const menuItemInputSchema = z.object({
  name: z.string().trim().min(1, "Dish name is required").max(80),
  category: z.enum(MENU_CATEGORIES),
  note: z.string().trim().max(120).optional(),
});

async function ownedEventId(
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!isUuid(eventId)) return false;
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function addMenuItemAction(
  eventId: string,
  raw: unknown,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not signed in." };
  if (!(await ownedEventId(session.user.id, eventId)))
    return { error: "Event not found." };

  const parsed = menuItemInputSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid dish." };

  const existing = await db
    .select({
      count: sql<number>`count(*)::int`,
      maxOrder: max(menuItems.sortOrder),
    })
    .from(menuItems)
    .where(eq(menuItems.eventId, eventId));
  if ((existing[0]?.count ?? 0) >= 20)
    return { error: "Menu is at the 20-dish limit — remove one first." };

  const dup = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(
      and(
        eq(menuItems.eventId, eventId),
        sql`lower(${menuItems.name}) = lower(${parsed.data.name})`,
      ),
    )
    .limit(1);
  if (dup.length > 0) return { error: "That dish is already on the menu." };

  await db.insert(menuItems).values({
    eventId,
    name: parsed.data.name,
    category: parsed.data.category,
    note: parsed.data.note || null,
    source: "user",
    sortOrder: (existing[0]?.maxOrder ?? 0) + 1,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

export async function updateMenuItemAction(
  itemId: string,
  raw: unknown,
): Promise<{ error?: string }> {
  if (!isUuid(itemId)) return { error: "Dish not found." };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not signed in." };

  const parsed = menuItemInputSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid dish." };

  const rows = await db
    .select({ eventId: menuItems.eventId })
    .from(menuItems)
    .innerJoin(events, eq(menuItems.eventId, events.id))
    .where(and(eq(menuItems.id, itemId), eq(events.userId, session.user.id)))
    .limit(1);
  if (rows.length === 0) return { error: "Dish not found." };

  // Same duplicate guard as add — a rename must not collide with another
  // dish (double React keys, double-counted quantities). Excluding the row
  // itself keeps case-only renames and no-op saves working.
  const dup = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(
      and(
        eq(menuItems.eventId, rows[0].eventId),
        sql`lower(${menuItems.name}) = lower(${parsed.data.name})`,
        ne(menuItems.id, itemId),
      ),
    )
    .limit(1);
  if (dup.length > 0) return { error: "That dish is already on the menu." };

  await db
    .update(menuItems)
    .set({
      name: parsed.data.name,
      category: parsed.data.category,
      note: parsed.data.note || null,
    })
    .where(eq(menuItems.id, itemId));
  revalidatePath(`/dashboard/events/${rows[0].eventId}`);
  return {};
}

export async function deleteMenuItemAction(
  itemId: string,
): Promise<{ error?: string }> {
  if (!isUuid(itemId)) return { error: "Dish not found." };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not signed in." };

  const rows = await db
    .select({ eventId: menuItems.eventId })
    .from(menuItems)
    .innerJoin(events, eq(menuItems.eventId, events.id))
    .where(and(eq(menuItems.id, itemId), eq(events.userId, session.user.id)))
    .limit(1);
  if (rows.length === 0) return { error: "Dish not found." };

  await db.delete(menuItems).where(eq(menuItems.id, itemId));
  revalidatePath(`/dashboard/events/${rows[0].eventId}`);
  return {};
}

// ---------- share links ----------

export async function createShareAction(
  eventId: string,
): Promise<{ slug?: string; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not signed in." };
  if (!(await ownedEventId(session.user.id, eventId)))
    return { error: "Event not found." };

  const existing = await db
    .select({ slug: shares.slug })
    .from(shares)
    .where(eq(shares.eventId, eventId))
    .limit(1);
  if (existing.length > 0) return { slug: existing[0].slug };

  // Unique index on eventId + conflict-safe insert: a double-click race
  // yields one slug, never two live links the UI can't see or revoke.
  const slug = randomBytes(9).toString("base64url");
  const inserted = await db
    .insert(shares)
    .values({ eventId, slug, role: "family" })
    .onConflictDoNothing({ target: shares.eventId })
    .returning({ slug: shares.slug });
  if (inserted.length === 0) {
    const winner = await db
      .select({ slug: shares.slug })
      .from(shares)
      .where(eq(shares.eventId, eventId))
      .limit(1);
    if (winner.length > 0) {
      revalidatePath(`/dashboard/events/${eventId}`);
      return { slug: winner[0].slug };
    }
    return { error: "Could not create the link. Please try again." };
  }
  revalidatePath(`/dashboard/events/${eventId}`);
  return { slug: inserted[0].slug };
}

export async function revokeShareAction(
  eventId: string,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not signed in." };
  if (!(await ownedEventId(session.user.id, eventId)))
    return { error: "Event not found." };

  await db.delete(shares).where(eq(shares.eventId, eventId));
  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}
