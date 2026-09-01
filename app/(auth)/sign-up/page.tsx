import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalSession, isGoogleEnabled } from "@/lib/auth";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account — Feast Math" };

export default async function SignUpPage() {
  const session = await getOptionalSession(await headers());
  if (session) redirect("/dashboard");

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-stone-900 dark:text-stone-50">
        Create your account
      </h1>
      <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
        Plan the food for your next function in minutes.
      </p>
      <SignUpForm googleEnabled={isGoogleEnabled} />
      <p className="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-amber-700 hover:underline dark:text-amber-500"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
