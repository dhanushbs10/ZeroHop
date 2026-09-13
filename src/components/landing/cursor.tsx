"use client";

import { useEffect, useRef, useState } from "react";

const LERP = 0.16;
const HOVER_SELECTOR =
  "a, button, input, [role='button'], [role='tab'], label, select, textarea";

export function Cursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!fine || reduced) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    setEnabled(true);
    document.documentElement.classList.add("landing-cursor-none");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let hovering = false;
    let frame = 0;

    const move = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;

      const target = event.target as Element | null;
      const nextHovering = Boolean(
        target && target.closest && target.closest(HOVER_SELECTOR)
      );
      if (nextHovering !== hovering) {
        hovering = nextHovering;
        ring.classList.toggle("is-hover", hovering);
      }
    };

    const loop = () => {
      ringX += (mouseX - ringX) * LERP;
      ringY += (mouseY - ringY) * LERP;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      frame = window.requestAnimationFrame(loop);
    };

    const hide = () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };
    const show = () => {
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    };

    window.addEventListener("mousemove", move, { passive: true });
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mouseenter", show);
    frame = window.requestAnimationFrame(loop);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("mouseenter", show);
      document.documentElement.classList.remove("landing-cursor-none");
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden>
      <div
        ref={dotRef}
        className="landing-cursor-dot pointer-events-none fixed left-0 top-0 z-[111]"
      />
      <div
        ref={ringRef}
        className="landing-cursor-ring pointer-events-none fixed left-0 top-0 z-[110]"
      />
    </div>
  );
}