import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 * Uses the SERVICE_ROLE_KEY — bypasses RLS.
 * NEVER import this from a Client Component or send to the browser.
 * Only use from API routes, Server Components, or Server Actions.
 */
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
