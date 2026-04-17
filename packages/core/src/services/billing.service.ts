import { supabase } from '../supabase/client';
import { getEntitlement } from './entitlements.service';
import { EventTypes, trackEvent, type EventType } from './events.service';

type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
type BillingMode = 'checkout' | 'staged' | 'already-active';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro';
  status: SubscriptionStatus;
  pro_until: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  provider: 'staged' | 'stripe';
  is_pro_active: boolean;
  cancel_at_period_end: boolean;
}

export interface CheckoutIntentResult {
  url: string;
  mode: BillingMode;
  message: string;
}

const STRIPE_READY = false;

function getEntitlementEndDate(subscription: Pick<Subscription, 'pro_until' | 'current_period_end'>) {
  return subscription.pro_until ?? subscription.current_period_end;
}

// Grace period to account for client/server clock skew (5 minutes)
const CLOCK_SKEW_GRACE_MS = 5 * 60 * 1000;

function hasActiveProAccess(subscription: Pick<Subscription, 'plan' | 'pro_until' | 'current_period_end'>) {
  if (subscription.plan !== 'pro') return false;
  const endDate = getEntitlementEndDate(subscription);
  if (!endDate) return false;
  return new Date(endDate).getTime() > (Date.now() - CLOCK_SKEW_GRACE_MS);
}

async function syncProfileTier(userId: string, tier: 'free' | 'pro') {
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: tier })
    .eq('id', userId);

  if (error) throw error;
}

async function trackBillingEvent(userId: string, eventType: EventType, payload: Record<string, string | null | undefined>) {
  try {
    await trackEvent(userId, eventType, payload, 'billing');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Don't let analytics failures break billing flows
    console.warn('Could not track billing event', message);
  }
}

async function normalizeExpiredSubscription(subscription: Subscription): Promise<Subscription> {
  if (!subscription.is_pro_active && subscription.plan === 'pro') {
    const { data, error } = await supabase
      .from('entitlements')
      .update({
        plan: 'free',
        status: 'canceled',
        pro_until: null,
        current_period_end: null,
      })
      .eq('id', subscription.id)
      .select('*')
      .single();

    if (error) throw error;
    await syncProfileTier(subscription.user_id, 'free');

    return mapEntitlementRow(data as SubscriptionRow);
  }

  return subscription;
}

type SubscriptionRow = Awaited<ReturnType<typeof getEntitlement>> & {
  status?: SubscriptionStatus;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

function mapEntitlementRow(row: SubscriptionRow): Subscription {
  const plan = row.plan;
  const status = row.status ?? 'active';
  const pro_until = row.pro_until ?? null;
  const current_period_end = row.current_period_end ?? null;
  const is_pro_active = hasActiveProAccess({ plan, pro_until, current_period_end });

  return {
    id: row.id,
    user_id: row.user_id,
    plan,
    status,
    pro_until,
    current_period_end,
    stripe_customer_id: row.stripe_customer_id ?? null,
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    created_at: row.created_at,
    provider: STRIPE_READY ? 'stripe' : 'staged',
    is_pro_active,
    cancel_at_period_end: status === 'canceled' && is_pro_active,
  };
}

/**
 * Get the current subscription/entitlements for a user.
 * Uses entitlements as the source of truth while Stripe stays staged.
 */
export async function getSubscription(userId: string): Promise<Subscription> {
  const entitlement = await getEntitlement(userId);
  const mapped = mapEntitlementRow(entitlement);

  return normalizeExpiredSubscription(mapped);
}

/**
 * Stage the checkout flow while Stripe stays offline.
 * We still capture intent so we can enable billing without rebuilding the UX.
 */
export async function createCheckout(
  userId: string,
  plan: 'pro',
): Promise<CheckoutIntentResult> {
  const subscription = await getSubscription(userId);

  if (subscription.is_pro_active) {
    return {
      url: '',
      mode: 'already-active',
      message: 'Pro is already active on this account.',
    };
  }

  if (!STRIPE_READY) {
    await trackBillingEvent(userId, EventTypes.BILLING_INTEREST_REQUESTED, {
      plan,
      source: 'mobile',
      provider: 'staged',
    });

    return {
      url: '',
      mode: 'staged',
      message:
        'Payments are still in staged rollout. We saved your interest and will unlock Pro billing soon.',
    };
  }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { userId, plan },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to create checkout');
  }

  return {
    url: data?.url ?? '',
    mode: 'checkout',
    message: 'Checkout is ready.',
  };
}

/**
 * Cancel the user's subscription while preserving access through the paid period.
 * When Stripe is offline, we still mark the request and keep the product state honest.
 */
export async function cancelSubscription(userId: string): Promise<Subscription> {
  const subscription = await getSubscription(userId);

  if (!subscription.is_pro_active) {
    return subscription;
  }

  const entitlementEnd = getEntitlementEndDate(subscription);

  if (!STRIPE_READY) {
    await trackBillingEvent(userId, EventTypes.BILLING_CANCELLATION_REQUESTED, {
      source: 'mobile',
      provider: 'staged',
      currentPeriodEnd: entitlementEnd,
    });
    console.warn('[billing] Stripe not ready — cancellation recorded as intent, not executed');
    // Return subscription with cancel_at_period_end so UI reflects the user's intent
    return { ...subscription, cancel_at_period_end: true };
  }

  const { error: cancelError } = await supabase.functions.invoke('cancel-subscription', {
    body: { userId },
  });

  if (cancelError) {
    throw new Error(cancelError.message ?? 'Failed to cancel subscription');
  }

  const { data, error } = await supabase
    .from('entitlements')
    .update({ status: 'canceled' })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;

  const nextSubscription = mapEntitlementRow(data as SubscriptionRow);
  await syncProfileTier(userId, nextSubscription.is_pro_active ? 'pro' : 'free');
  return nextSubscription;
}
