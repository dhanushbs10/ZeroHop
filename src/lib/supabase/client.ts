import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env.local before using account features.`
    );
  }
  return value;
}

export function createClient(): SupabaseClient {
  return createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}