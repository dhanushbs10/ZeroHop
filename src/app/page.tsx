"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { BackgroundOne } from "@/components/backgrounds/BackgroundOne";
import { Button } from "@/components/ui/button";
import { Cursor } from "@/components/landing/cursor";
import { Grain } from "@/components/landing/grain";
import { Hop } from "@/components/landing/hop";
import { Marquee } from "@/components/landing/marquee";
import { Reveal } from "@/components/landing/reveal";

const CLAIMS = [
  {
    number: "01",
    title: "A code, not an account",
    body: "Send opens a room and shows an 8-character code. The receiver types it in and you are paired. No signup, no profile, nothing to remember.",
  },
  {
    number: "02",
    title: "Direct pair, no middleman",
    body: "Your browser talks straight to theirs over WebRTC. The relay carries room control only. The file itself never touches a server.",
  },
  {
    number: "03",
    title: "Full speed on your network",
    body: "Same-network peers route at local LAN speed. Off-network peers take the fastest reachable path. Everything is encrypted in transit.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <BackgroundOne />
      <Grain />
      <Cursor />

      <section className="relative flex flex-1 flex-col justify-center px-4 pb-16 pt-24 sm:pt-32">
        <div className="mx-auto flex w-full max-w-4xl flex-col">
          <Reveal variant="rise">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
              {"// peer-to-peer file transfer"}
            </p>
          </Reveal>

          <Reveal variant="clip" delay={80}>
            <h1
              aria-label="ZeroHop: files hop from one device directly to another"
              className="mt-6 text-[clamp(4rem,18vw,13rem)] font-semibold leading-[0.85] tracking-[-0.04em]"
            >
              <span aria-hidden className="block text-zinc-100">
                FILES
              </span>
              <span aria-hidden className="text-outline block">
                HOP
              </span>
            </h1>
          </Reveal>

          <Reveal variant="rise" delay={160} className="mt-10 max-w-lg">
            <p className="text-base text-zinc-400 sm:text-lg">
              From one device straight to another, over WebRTC. No account,
              no server in the data path, no size cap.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row">
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
          </Reveal>

          <Reveal variant="rise" delay={240} className="mt-14 max-w-md">
            <Hop />
          </Reveal>
        </div>
      </section>

      <Marquee />

      <section className="relative px-4 py-20 sm:py-28">
        <div className="mx-auto w-full max-w-4xl">
          {CLAIMS.map((claim, index) => (
            <Reveal
              key={claim.number}
              variant="slide"
              delay={index * 60}
              className="group relative overflow-hidden border-t border-zinc-800 py-8 sm:py-10"
            >
              <span
                aria-hidden
                className="absolute inset-0 origin-left scale-x-0 bg-zinc-100 transition-transform duration-500 ease-out group-hover:scale-x-100"
              />
              <div className="relative flex items-baseline gap-6 sm:gap-10">
                <span className="font-mono text-xs text-zinc-600 transition-colors duration-500 group-hover:text-zinc-900 sm:text-sm">
                  {claim.number}
                </span>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 transition-colors duration-500 group-hover:text-zinc-900 sm:text-4xl">
                  {claim.title}
                </h2>
                <ArrowUpRight className="ml-auto h-5 w-5 shrink-0 text-zinc-600 transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-zinc-900 sm:h-6 sm:w-6" />
              </div>
              <p className="relative mt-3 max-w-xl text-sm text-zinc-500 transition-colors duration-500 group-hover:text-zinc-700 sm:ml-[5.5rem] sm:mt-4 sm:text-base">
                {claim.body}
              </p>
            </Reveal>
          ))}
          <Reveal variant="rise" delay={60}>
            <div className="border-t border-zinc-800 pt-10">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Start from this device
              </p>
              <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row">
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
          </Reveal>
        </div>
      </section>
    </div>
  );
}