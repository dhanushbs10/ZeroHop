"use client";

import { useEffect, useRef } from "react";

const NOISE_SIZE = 200;

export function Grain() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = NOISE_SIZE;
    canvas.height = NOISE_SIZE;

    const image = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.floor(Math.random() * 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      const value = Math.floor(Math.random() * 255);
      const grays = new Uint8ClampedArray(NOISE_SIZE * NOISE_SIZE * 4);
      for (let i = 0; i < grays.length; i += 4) {
        grays[i] = value;
        grays[i + 1] = value;
        grays[i + 2] = value;
        grays[i + 3] = 255;
      }
      ctx.putImageData(
        new ImageData(grays, NOISE_SIZE, NOISE_SIZE),
        0,
        0
      );
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={ref}
      className="grain pointer-events-none fixed -inset-[5%] z-[60]"
      aria-hidden
    />
  );
}