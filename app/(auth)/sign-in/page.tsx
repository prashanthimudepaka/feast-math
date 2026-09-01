import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalSession, isGoogleEnabled } from "@/lib/auth";
import { SignInForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in — Feast Math" };

export default async function SignInPage() {
  const session = await getOptionalSession(await headers());
  if (session) redirect("/dashboard");

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-stone-900 dark:text-stone-50">
        Welcome back
      </h1>
      <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
        Sign in to your event plans.
      </p>
      <SignInForm googleEnabled={isGoogleEnabled} />
      <p className="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
        New here?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-amber-700 hover:underline dark:text-amber-500"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
