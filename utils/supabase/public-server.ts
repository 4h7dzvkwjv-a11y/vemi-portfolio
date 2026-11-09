import "server-only";

import { createClient } from "@supabase/supabase-js";

function requiredPublicSupabaseValue(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configurația publică Supabase lipsește: ${name}.`);
  return value;
}

/**
 * Public catalog reads must always run with the anonymous RLS semantics.
 * In particular, they must not inherit an authenticated/admin browser session.
 */
export function createPublicCatalogClient() {
  return createClient(
    requiredPublicSupabaseValue("NEXT_PUBLIC_SUPABASE_URL"),
    requiredPublicSupabaseValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
