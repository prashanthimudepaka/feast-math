import type { Metadata } from "next";
import { EventWizard } from "@/components/event-wizard";

export const metadata: Metadata = { title: "New event — Feast Math" };

export default function NewEventPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          New event
        </h1>
        <p className="mt-1 text-stone-500 dark:text-stone-400">
          Tell Feast Math about the function — it will compute exactly how much
          to cook and buy.
        </p>
      </div>
      <EventWizard />
    </div>
  );
}
