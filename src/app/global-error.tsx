"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw, Zap } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof window !== "undefined") {
    console.error(error);
  }
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <main className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-zinc-800 bg-zinc-900">
            <Zap className="h-4 w-4 text-zinc-300" />
          </span>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Something broke : {error.digest ?? error.message ?? "unexpected error"}
          </p>
          <h1 className="mt-4 max-w-md text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
            This hop did not land
          </h1>
          <p className="mt-4 max-w-md text-base text-zinc-400">
            The page hit an unexpected error. Your files never leave your
            device, so nothing was lost in transit. Try again or head back
            home.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[4px] bg-zinc-100 px-8 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[4px] border border-zinc-800 bg-zinc-950 px-8 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
