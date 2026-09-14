import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when .env.local is missing, so the UI can say so instead of throwing. */
export const supabaseConfigured = Boolean(url && anonKey);

/** The project ref, shown in the dashboard so you can tell which backend you are on. */
export const supabaseProjectRef = url ? url.replace(/^https?:\/\//, "").split(".")[0] : "";

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (typeof window === "undefined") {
    if (!serverClient) {
      serverClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
        },
      });
    }
    return serverClient;
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
