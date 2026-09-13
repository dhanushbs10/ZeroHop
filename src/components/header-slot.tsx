"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function HeaderSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}