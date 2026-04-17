import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * Data Subject Access Request (DSAR) intake endpoint.
 *
 * This endpoint lets any person — including a user whose account was deleted —
 * file a privacy request (export or delete) for data associated with an email.
 *
 * Security posture:
 *   - Auth is NOT required. A deleted user must still be able to file a DSAR
 *     for their prior account. This is a compliance requirement.
 *   - The response MUST NOT leak whether an email exists in our system.
 *     Always return 202 with a ticket for valid input, regardless of whether
 *     the email is known to us.
 *   - We rate-limit by email (3 requests / 24h) to defeat casual abuse.
 *   - Actual fulfillment (exporting or deleting data) happens asynchronously
 *     via an ops process operating on the `dsar_requests` queue.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  email: z.string().email().max(320),
  requestType: z.enum(['export', 'delete']),
});

const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_REQUESTS = 3;

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'DSAR route misconfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request. Provide { email, requestType: "export" | "delete" }.' },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const requestType = parsed.data.requestType;

  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch (err) {
    console.error('[sovio.dsar] supabase misconfiguration', err);
    return NextResponse.json(
      { error: 'DSAR intake is temporarily unavailable.' },
      { status: 503 },
    );
  }

  // Defensive rate-limit: count recent requests for this email.
  const since = new Date(
    Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { count: recentCount, error: rateError } = await supabase
    .from('dsar_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since);

  if (rateError) {
    console.error('[sovio.dsar] rate-limit query failed', rateError);
    return NextResponse.json(
      { error: 'DSAR intake is temporarily unavailable.' },
      { status: 503 },
    );
  }

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json(
      {
        error: 'Too many DSAR requests for this email in the last 24 hours. Please contact privacy support.',
      },
      { status: 429 },
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from('dsar_requests')
    .insert({
      email,
      request_type: requestType,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('[sovio.dsar] insert failed', insertError);
    // Do not leak detail; same 503 face as misconfiguration.
    return NextResponse.json(
      { error: 'DSAR intake is temporarily unavailable.' },
      { status: 503 },
    );
  }

  // Always 202, regardless of whether the email corresponds to a known user.
  // This is intentional: the endpoint must not reveal account existence.
  return NextResponse.json(
    {
      ok: true,
      ticketId: inserted.id,
      message:
        'Your privacy request has been received. We will process it and respond to the provided email address.',
    },
    { status: 202 },
  );
}
