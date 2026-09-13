"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BackgroundOne } from "@/components/backgrounds/BackgroundOne";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <BackgroundOne />
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          ZeroHop
        </h1>
        <p className="mt-5 max-w-md text-base text-zinc-400 sm:text-lg">
          Files hop from one device straight to another. Peer to peer over
          WebRTC, no account, no size cap.
        </p>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="min-w-[12rem] rounded-[4px]"
          >
            <Link href="/send">
              Begin a transfer
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-w-[12rem] rounded-[4px]"
          >
            <Link href="/receive">Join with a room code</Link>
          </Button>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center gap-2 text-sm text-zinc-500 sm:flex-row sm:gap-8">
        <span>No server in the data path</span>
        <span className="hidden text-zinc-700 sm:block">/</span>
        <span>Full speed on the same network</span>
        <span className="hidden text-zinc-700 sm:block">/</span>
        <span>Encrypted in transit</span>
      </div>
    </div>
  );
}