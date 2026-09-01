"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { error } = await authClient.signOut();
          if (!error) {
            router.push("/");
            router.refresh();
            return;
          }
        } catch {
          // fall through to reset so the button stays usable
        }
        setBusy(false);
      }}
      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
