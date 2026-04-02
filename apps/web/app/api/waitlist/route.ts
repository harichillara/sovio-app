import { NextResponse } from 'next/server';
import type { WaitlistSignupInput } from '../../../content/types';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let payload: WaitlistSignupInput;

  try {
    payload = (await request.json()) as WaitlistSignupInput;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const email = payload.email?.trim().toLowerCase();
  const source = payload.source?.trim();
  const referrer = payload.referrer?.trim();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Enter a valid email address.' },
      { status: 400 },
    );
  }

  if (!source) {
    return NextResponse.json(
      { error: 'Missing waitlist source.' },
      { status: 400 },
    );
  }

  const body = {
    email,
    source,
    referrer,
    capturedAt: new Date().toISOString(),
  };

  const webhookUrl = process.env.WAITLIST_WEBHOOK_URL;

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Waitlist capture is temporarily unavailable.' },
        { status: 502 },
      );
    }
  } else {
    console.info('[sovio.waitlist.preview]', body);
  }

  return NextResponse.json({
    ok: true,
    message: 'You are on the list. We will pull you in early.',
  });
}
