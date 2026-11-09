import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "./cookie-options";

function readBrowserSupabaseConfig() {
  const url = document
    .querySelector<HTMLMetaElement>('meta[name="vemi-supabase-url"]')
    ?.content.trim();
  const publishableKey = document
    .querySelector<HTMLMetaElement>('meta[name="vemi-supabase-publishable-key"]')
    ?.content.trim();

  if (!url || !publishableKey) {
    throw new Error("Configurația publică Supabase lipsește din document.");
  }

  return { url, publishableKey };
}

export function createClient() {
  const { url, publishableKey } = readBrowserSupabaseConfig();

  return createBrowserClient(
    url,
    publishableKey,
    { cookieOptions: supabaseCookieOptions },
  );
}
