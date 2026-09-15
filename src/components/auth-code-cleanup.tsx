"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";

export function AuthCodeCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;
    const supabase = getSupabase();
    supabase.auth
      .exchangeCodeForSession(code)
      .catch(() => {})
      .finally(() => {
        url.searchParams.delete("code");
        const next = url.pathname + url.search + url.hash;
        window.history.replaceState({}, "", next || "/");
        window.dispatchEvent(new Event("supabase:code-exchanged"));
      });
  }, []);
  return null;
}
