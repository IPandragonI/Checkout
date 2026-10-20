import { createClient, Provider, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Online rooms and accounts are optional: without env vars the app runs fully offline. */
export const onlineEnabled = Boolean(url && key);

/** OAuth buttons to show, e.g. "google,github". Each must also be enabled in the Supabase dashboard. */
export const authProviders: Provider[] = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim().toLowerCase())
  .filter((p): p is Provider => p === "google" || p === "github");

let client: SupabaseClient | null = null;

/**
 * Browser-only client. Auth runs entirely client-side with PKCE (no server routes),
 * so the app stays fully static on Vercel.
 */
export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / key missing).");
  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "checkout-auth",
    },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}
