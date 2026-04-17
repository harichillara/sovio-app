// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as Sentry from 'https://deno.land/x/sentry@7.120.3/index.mjs';
import { createRequestLogger } from '../_shared/logger.ts';
import { z } from '../_shared/validate.ts';
import { verifyStripeSignature } from '../_shared/stripe-verify.ts';

// Stripe event-shape schemas. Applied AFTER signature verification — we can't
// parse/transform the body before HMAC because the signature is over the exact
// bytes. These schemas turn "trust the deserialized JSON" into a structured
// contract, so a malformed payload (post-sig-valid, which Stripe shouldn't
// send but defensive coding) returns a clean 400 rather than crashing in a
// property access.
const StripeMetadataSchema = z.object({ user_id: z.string().uuid() }).passthrough();

const CheckoutSessionSchema = z.object({
  metadata: StripeMetadataSchema.optional(),
  current_period_end: z.number().int().positive(),
  customer: z.string(),
  subscription: z.string(),
});

const SubscriptionSchema = z.object({
  metadata: StripeMetadataSchema.optional(),
  status: z.string(),
  current_period_end: z.number().int().positive().nullable().optional(),
});

const StripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.unknown(),
  }),
});

const SENTRY_DSN = Deno.env.get('SENTRY_DSN') ?? '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
  });
  Sentry.setTag('fn', 'billing-webhook');
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Stripe webhook secret — will be set when Stripe goes live
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
// Default off: absent env var, empty string, or any value other than the
// literal "true" keeps us on the staged path. Flipping requires an explicit
// opt-in via `supabase secrets set STRIPE_READY=true` after go-live.
let STRIPE_READY = Deno.env.get('STRIPE_READY') === 'true';

// Fail-safe: never run the live path without a webhook secret. If the operator
// set STRIPE_READY=true but forgot (or mis-spelled) STRIPE_WEBHOOK_SECRET,
// force back to staged mode so we don't accept unverified webhook payloads.
if (STRIPE_READY && !STRIPE_WEBHOOK_SECRET) {
  const bootLogger = createRequestLogger('billing-webhook');
  bootLogger.error('stripe_ready_without_secret', {
    message: 'STRIPE_READY=true but STRIPE_WEBHOOK_SECRET is empty — forcing staged mode',
  });
  STRIPE_READY = false;
}

// Signature verification lives in `../_shared/stripe-verify.ts` so it can be
// unit-tested without spinning up this module's DB + Sentry side effects.

/**
 * Billing webhook handler.
 * Currently in staged mode — logs events but does not process Stripe webhooks.
 * When STRIPE_READY is flipped, this will verify signatures and update entitlements.
 */
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = createRequestLogger('billing-webhook');

  try {
    if (!STRIPE_READY) {
      // In staged mode, just acknowledge the webhook. We DO NOT log the body
      // (even a slice) — it may contain PII or billing identifiers. Only the
      // fact that a webhook arrived and its size is useful for ops.
      const body = await req.text();
      logger.info('webhook_received', { staged: true, body_bytes: body.length });

      return new Response(
        JSON.stringify({
          received: true,
          mode: 'staged',
          message: 'Stripe is not yet active. Event logged.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---- Stripe-live path (dormant until STRIPE_READY = true) ----

    const body = await req.text();

    // Verify Stripe webhook signature
    const signatureHeader = req.headers.get('stripe-signature');
    if (!signatureHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      logger.error('webhook_secret_missing');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await verifyStripeSignature(body, signatureHeader, STRIPE_WEBHOOK_SECRET);

    // Parse the outer envelope through zod. Anything not matching the basic
    // `{ id, type, data.object }` shape is rejected as a 400 — we'd rather
    // loudly fail than silently skip an unrecognized event whose shape shifted.
    let event: z.infer<typeof StripeEventSchema>;
    try {
      event = StripeEventSchema.parse(JSON.parse(body));
    } catch (parseErr: any) {
      logger.warn('event_shape_invalid', { err: parseErr?.message });
      return new Response(
        JSON.stringify({ error: 'invalid_event_shape' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Idempotency claim. Stripe delivery is at-least-once — retries from
    // their side, manual "Resend" from the dashboard, or a worker crash
    // between "applied the update" and "returned 200" would all re-deliver
    // the same event.id. We INSERT here as our *first* DB write after
    // signature verification. The PK on event_id means exactly one concurrent
    // delivery wins the race; duplicates get zero rows back and short-circuit.
    //
    // We return 200 on duplicate (not 409) because Stripe treats 2xx as
    // "delivered, stop retrying" — which is what we want. A 4xx here would
    // make Stripe keep retrying a duplicate it already delivered successfully.
    const claim = await supabase
      .from('processed_stripe_events')
      .insert({ event_id: event.id, event_type: event.type })
      .select('event_id');

    if (claim.error) {
      // Unique-violation means another worker already claimed this event.
      // Postgres error code 23505 is unique_violation. Any other error is
      // a real DB fault — re-raise so the top-level catch returns 500 and
      // Stripe retries.
      if ((claim.error as any).code === '23505') {
        logger.info('duplicate_event_ignored', { event_id: event.id, event_type: event.type });
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw claim.error;
    }

    let processed = false;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = CheckoutSessionSchema.safeParse(event.data.object);
        if (!session.success) {
          logger.warn('checkout_session_shape_invalid', { event_id: event.id });
          break;
        }
        const userId = session.data.metadata?.user_id;
        if (!userId) break;

        await supabase.from('entitlements').upsert(
          {
            user_id: userId,
            plan: 'pro',
            status: 'active',
            pro_until: new Date(session.data.current_period_end * 1000).toISOString(),
            stripe_customer_id: session.data.customer,
            stripe_subscription_id: session.data.subscription,
          },
          { onConflict: 'user_id' },
        );

        await supabase
          .from('profiles')
          .update({ subscription_tier: 'pro' })
          .eq('id', userId);

        processed = true;
        break;
      }

      case 'customer.subscription.updated': {
        const sub = SubscriptionSchema.safeParse(event.data.object);
        if (!sub.success) {
          logger.warn('subscription_shape_invalid', { event_id: event.id });
          break;
        }
        const userId = sub.data.metadata?.user_id;
        if (!userId) break;

        const isActive = sub.data.status === 'active' || sub.data.status === 'trialing';

        await supabase.from('entitlements').upsert(
          {
            user_id: userId,
            plan: isActive ? 'pro' : 'free',
            status: sub.data.status,
            pro_until: sub.data.current_period_end
              ? new Date(sub.data.current_period_end * 1000).toISOString()
              : null,
          },
          { onConflict: 'user_id' },
        );

        await supabase
          .from('profiles')
          .update({ subscription_tier: isActive ? 'pro' : 'free' })
          .eq('id', userId);

        processed = true;
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = SubscriptionSchema.safeParse(event.data.object);
        if (!sub.success) {
          logger.warn('subscription_shape_invalid', { event_id: event.id });
          break;
        }
        const userId = sub.data.metadata?.user_id;
        if (!userId) break;

        await supabase
          .from('entitlements')
          .update({
            plan: 'free',
            status: 'canceled',
            pro_until: null,
          })
          .eq('user_id', userId);

        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', userId);

        processed = true;
        break;
      }
    }

    // Only log recognized events that were actually processed
    if (processed) {
      await supabase.from('audit_log').insert({
        actor_type: 'system',
        action: `stripe_${event.type}`,
        target: { event_id: event.id },
      });
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    logger.error('unhandled_error', { err });
    // Signature-verification failures land here too — those are either config
    // drift or active attack, so they should go to Sentry along with everything
    // else in this top-level catch.
    if (SENTRY_DSN) Sentry.captureException(err);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
