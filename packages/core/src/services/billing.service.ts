import { supabase } from '../supabase/client';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

/**
 * Get the current subscription/entitlements for a user.
 */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  // If no entitlements row, return a default free subscription
  if (!data) {
    return {
      id: '',
      user_id: userId,
      plan: 'free',
      status: 'active',
      current_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      created_at: new Date().toISOString(),
    };
  }

  return data as Subscription;
}

/**
 * Create a checkout session via Edge Function.
 * Returns a checkout URL the user can be redirected to.
 */
export async function createCheckout(
  userId: string,
  plan: 'pro',
): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { userId, plan },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to create checkout');
  }

  return { url: data?.url ?? '' };
}

/**
 * Handle a Stripe webhook event (server-side).
 * Updates the entitlements table accordingly.
 */
export async function handleWebhook(event: {
  type: string;
  data: {
    userId: string;
    plan: 'free' | 'pro';
    status: 'active' | 'canceled' | 'past_due';
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    currentPeriodEnd?: string;
  };
}): Promise<void> {
  const { userId, plan, status, stripeSubscriptionId, stripeCustomerId, currentPeriodEnd } =
    event.data;

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.updated': {
      const { error } = await supabase.from('entitlements').upsert(
        {
          user_id: userId,
          plan,
          status,
          stripe_subscription_id: stripeSubscriptionId ?? null,
          stripe_customer_id: stripeCustomerId ?? null,
          current_period_end: currentPeriodEnd ?? null,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;

      // Also update profile tier
      await supabase
        .from('profiles')
        .update({ subscription_tier: plan })
        .eq('id', userId);
      break;
    }

    case 'customer.subscription.deleted': {
      const { error } = await supabase
        .from('entitlements')
        .update({ plan: 'free', status: 'canceled' })
        .eq('user_id', userId);
      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ subscription_tier: 'free' })
        .eq('id', userId);
      break;
    }
  }
}

/**
 * Cancel the user's subscription.
 */
export async function cancelSubscription(userId: string): Promise<void> {
  // Call edge function to cancel in Stripe
  const { error } = await supabase.functions.invoke('cancel-subscription', {
    body: { userId },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to cancel subscription');
  }

  // Update local entitlements
  await supabase
    .from('entitlements')
    .update({ status: 'canceled' })
    .eq('user_id', userId);

  // Update profile
  await supabase
    .from('profiles')
    .update({ subscription_tier: 'free' })
    .eq('id', userId);
}
