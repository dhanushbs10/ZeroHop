import Link from "next/link";
import { Zap } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-zinc-800 bg-zinc-900">
            <Zap className="h-3.5 w-3.5 text-zinc-300" />
          </span>
          <span className="font-mono text-sm font-semibold text-white">
            ZeroHop
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/send"
            className="rounded-[4px] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Send
          </Link>
          <Link
            href="/receive"
            className="rounded-[4px] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Receive
          </Link>
        </nav>
      </div>
    </header>
  );
}