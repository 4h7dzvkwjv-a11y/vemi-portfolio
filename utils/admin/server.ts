import "server-only";

import { createClient } from "../supabase/server";

export type AdminContext = Awaited<ReturnType<typeof getAdminContext>>;

export async function getAdminContext() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (claimsError || !userId) {
    return { authorized: false as const, status: 401 as const, supabase, userId: null };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError || roleRow?.role !== "admin") {
    return { authorized: false as const, status: 403 as const, supabase, userId };
  }

  return { authorized: true as const, status: 200 as const, supabase, userId };
}
