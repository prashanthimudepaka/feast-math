import { NextResponse } from "next/server";
import { and, eq, gte, max, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  events,
  generationAttempts,
  menuItems,
  plans,
  shoppingItems,
} from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";
import { generatePlanParams } from "@/lib/ai/generate-params";
import { computePlan } from "@/lib/engine/compute";
import { eventInputSchema, type EventInput } from "@/lib/plan/types";

// Real LLM calls (plus one validation retry) can exceed the default
// serverless budget; mock mode never gets near this.
export const maxDuration = 60;

const DAILY_GENERATION_LIMIT = 10;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Mock mode needs no API key — only block real-API mode without one.
  if (!process.env.GEMINI_API_KEY && process.env.FEAST_MOCK_PLAN !== "1") {
    return NextResponse.json(
      { error: "Plan generation is not configured (missing API key)." },
      { status: 503 },
    );
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, session.user.id)))
    .limit(1);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const menu = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.eventId, event.id))
    .orderBy(menuItems.sortOrder);
  if (menu.length === 0) {
    return NextResponse.json(
      { error: "Add at least one dish to the menu first." },
      { status: 400 },
    );
  }

  // Daily rate limit: reserve quota BEFORE the model call by inserting an
  // attempt row, then counting attempts (own row included). Insert-before-
  // count fails closed under concurrency — parallel requests can over-block
  // by one, never over-spend — and failed generations still burn quota.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  await db.insert(generationAttempts).values({ userId: session.user.id });
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generationAttempts)
    .where(
      and(
        eq(generationAttempts.userId, session.user.id),
        gte(generationAttempts.createdAt, startOfDay),
      ),
    );
  if (count > DAILY_GENERATION_LIMIT) {
    return NextResponse.json(
      { error: `Daily limit of ${DAILY_GENERATION_LIMIT} plan generations reached. Try again tomorrow.` },
      { status: 429 },
    );
  }

  const appetite =
    (event.appetiteProfile as { appetite?: string } | null)?.appetite ??
    "average";
  const inputCandidate: EventInput = {
    title: event.title,
    eventType: event.eventType as EventInput["eventType"],
    cuisine: event.cuisine as EventInput["cuisine"],
    mealType: event.mealType as EventInput["mealType"],
    servingStyle: event.servingStyle as EventInput["servingStyle"],
    eventDate: event.eventDate ?? "",
    serveTime: event.serveTime ?? "",
    adults: event.adults,
    kids: event.kids,
    appetite: appetite as EventInput["appetite"],
    dietaryNotes: event.dietaryNotes ?? undefined,
    menu: menu.map((m) => ({
      name: m.name,
      category: m.category as EventInput["menu"][number]["category"],
      ...(m.note ? { note: m.note } : {}),
    })),
  };
  const inputParsed = eventInputSchema.safeParse(inputCandidate);
  if (!inputParsed.success) {
    return NextResponse.json(
      { error: "Stored event data is invalid. Edit the event and try again." },
      { status: 400 },
    );
  }
  const input = inputParsed.data;

  try {
    const { params: planParams, model } = await generatePlanParams(input);
    const computed = computePlan(input, planParams);

    const [{ maxVersion }] = await db
      .select({ maxVersion: max(plans.version) })
      .from(plans)
      .where(eq(plans.eventId, event.id));
    const version = (maxVersion ?? 0) + 1;

    const [plan] = await db
      .insert(plans)
      .values({
        eventId: event.id,
        version,
        inputSnapshot: input,
        params: planParams,
        computed,
        model,
      })
      .returning({ id: plans.id });

    if (computed.shoppingList.length > 0) {
      await db.insert(shoppingItems).values(
        computed.shoppingList.map((line, i) => ({
          planId: plan.id,
          category: line.category,
          name: line.name,
          quantity: String(line.value),
          unit: line.unit,
          packSuggestion: line.packSuggestion,
          checked: false,
          sortOrder: i,
        })),
      );
    }

    await db
      .update(events)
      .set({ status: "planned", updatedAt: new Date() })
      .where(eq(events.id, event.id));

    return NextResponse.json({ planId: plan.id, version });
  } catch (err) {
    console.error("[feast-math] plan generation failed:", err);
    const message = err instanceof Error ? err.message : "";
    if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "The Gemini API key is invalid. Re-copy it from aistudio.google.com → Get API key, or enable demo mode (FEAST_MOCK_PLAN=1).",
        },
        { status: 502 },
      );
    }
    if (/RESOURCE_EXHAUSTED|quota/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "The free Gemini quota is exhausted for now. Try again in a minute (rate limit) or tomorrow (daily quota).",
        },
        { status: 502 },
      );
    }
    if (/blocked the prompt|stopped generation/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "The AI declined this request (content filter). Adjust unusual dish names or notes and try again.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Plan generation failed. Please try again in a moment — your menu and event are saved.",
        // Provider error passthrough for the event owner (this route is
        // auth-gated); Google error bodies carry no secrets.
        detail: message.slice(0, 300),
      },
      { status: 502 },
    );
  }
}
