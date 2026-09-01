import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-stone-50 px-4 py-12 dark:bg-stone-950">
      <Link
        href="/"
        className="mb-8 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50"
      >
        Feast Math
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 dark:border-stone-800 dark:bg-stone-900">
        {children}
      </div>
    </main>
  );
}
