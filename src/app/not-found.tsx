"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";

import { BackgroundOne } from "@/components/backgrounds/BackgroundOne";
import { Button } from "@/components/ui/button";
import { Cursor } from "@/components/landing/cursor";
import { Grain } from "@/components/landing/grain";
import { Reveal } from "@/components/landing/reveal";

export default function NotFound() {
  const wipeRef = useRef<HTMLHeadingElement>(null);

  const handleWipe = (event: MouseEvent<HTMLHeadingElement>) => {
    const el = wipeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(
      100,
      Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)
    );
    el.classList.remove("is-returning");
    el.style.setProperty("--wx", `${x}%`);
  };

  const handleWipeLeave = () => {
    const el = wipeRef.current;
    if (!el) return;
    el.classList.add("is-returning");
    el.style.setProperty("--wx", "0%");
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <BackgroundOne />
      <Grain />
      <Cursor />

      <section className="relative flex flex-1 flex-col px-5 sm:px-8">
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center sm:py-16">
          <Reveal variant="rise" delay={40}>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
              Error 404 : packet lost
            </p>
          </Reveal>

          <Reveal variant="clip" delay={120}>
            <h1
              ref={wipeRef}
              aria-label="404, lost signal"
              onMouseMove={handleWipe}
              onMouseLeave={handleWipeLeave}
              className="relative mt-6 inline-block text-[clamp(4.5rem,20vw,15rem)] font-semibold leading-[0.85] tracking-[-0.045em]"
            >
              <span aria-hidden className="block text-zinc-100">
                LOST
              </span>
              <span aria-hidden className="wipe-word-outline block">
                SIGNAL
              </span>
              <span
                aria-hidden
                className="wipe-text absolute inset-0 left-0 top-0"
              >
                <span className="wipe-word-cutout block">LOST</span>
                <span className="block text-zinc-100">SIGNAL</span>
              </span>
            </h1>
          </Reveal>

          <Reveal variant="rise" delay={220} className="mt-10 max-w-md">
            <p className="text-base text-zinc-400 sm:text-lg">
              This route never joined the mesh. The peer you are looking for
              is not here, and no relay on earth can bring it back.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-[4px]">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back home
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-[4px]"
              >
                <Link href="/send">Send a file instead</Link>
              </Button>
            </div>
          </Reveal>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/80 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          <span>Status : route not found</span>
          <span className="hidden sm:inline">ZeroHop : no server in the data path</span>
        </div>
      </section>
    </div>
  );
}
