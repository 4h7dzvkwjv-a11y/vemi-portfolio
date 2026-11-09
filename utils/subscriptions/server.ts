import { createClient } from "@/utils/supabase/server";

export type SubscriptionPlanCode = "go" | "assisted";
export type SubscriptionBillingPeriod = "one_month" | "three_months";

export type SubscriptionEntitlement =
  | {
      authenticated: false;
      active: false;
      reason: "not_authenticated";
      subscription: null;
    }
  | {
      authenticated: true;
      active: false;
      reason: "none" | "lookup_failed";
      subscription: null;
    }
  | {
      authenticated: true;
      active: true;
      reason: "active";
      subscription: {
        id: string;
        planCode: SubscriptionPlanCode;
        billingPeriod: SubscriptionBillingPeriod;
        startsAt: string;
        expiresAt: string;
      };
    };

export async function getSubscriptionEntitlement(): Promise<SubscriptionEntitlement> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (!userId) {
    return {
      authenticated: false,
      active: false,
      reason: "not_authenticated",
      subscription: null,
    };
  }

  if (claimsError) {
    console.error("[subscriptions] claims verification failed", {
      code: claimsError.code,
    });

    return {
      authenticated: true,
      active: false,
      reason: "lookup_failed",
      subscription: null,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id,plan_code,billing_period,starts_at,expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("expires_at", now)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] entitlement lookup failed", {
      code: error.code,
    });

    return {
      authenticated: true,
      active: false,
      reason: "lookup_failed",
      subscription: null,
    };
  }

  if (!data) {
    return {
      authenticated: true,
      active: false,
      reason: "none",
      subscription: null,
    };
  }

  return {
    authenticated: true,
    active: true,
    reason: "active",
    subscription: {
      id: data.id,
      planCode: data.plan_code as SubscriptionPlanCode,
      billingPeriod: data.billing_period as SubscriptionBillingPeriod,
      startsAt: data.starts_at,
      expiresAt: data.expires_at,
    },
  };
}

export async function hasActiveSubscription(
  allowedPlans: readonly SubscriptionPlanCode[] = ["go", "assisted"],
) {
  const entitlement = await getSubscriptionEntitlement();
  return entitlement.active && allowedPlans.includes(entitlement.subscription.planCode);
}
