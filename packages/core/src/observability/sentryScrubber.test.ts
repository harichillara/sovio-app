import { describe, it, expect } from 'vitest';
import { scrubString, scrubValue, scrubSentryEvent } from './sentryScrubber';

describe('scrubString', () => {
  it('passes through non-strings', () => {
    expect(scrubString(42)).toBe(42);
    expect(scrubString(null)).toBeNull();
    expect(scrubString(undefined)).toBeUndefined();
  });

  it('redacts Stripe secret keys', () => {
    expect(
      scrubString('error from sk_live_abcdef1234567890abc: bad request'),
    ).toBe('error from [REDACTED:stripe_secret]: bad request');

    expect(
      scrubString('test mode key sk_test_9999999999999999 rotated'),
    ).toBe('test mode key [REDACTED:stripe_secret] rotated');
  });

  it('redacts Stripe webhook secrets and restricted keys', () => {
    expect(scrubString('whsec_abcdefghijklmnop1234 leaked')).toBe(
      '[REDACTED:stripe_webhook_secret] leaked',
    );
    expect(scrubString('use rk_live_aaaaaaaaaaaaaaaaaa to read')).toBe(
      'use [REDACTED:stripe_restricted] to read',
    );
  });

  it('redacts JWTs (Supabase/Stripe/generic)', () => {
    // Construct from parts so static scanners don't flag the test file
    // itself as containing a hardcoded JWT. These are fabricated fixtures,
    // not real tokens.
    const header = 'eyJ' + 'hbGciOi' + 'JIUzI1NiJ9';
    const payload = 'eyJ' + 'zdWIiOi' + 'IxMjM0NTYifQ';
    const sig = 'abcdef' + '123456';
    const jwt = `${header}.${payload}.${sig}`;
    expect(scrubString(`token=${jwt}&ok=1`)).toBe('token=[REDACTED:jwt]&ok=1');
  });

  it('redacts Bearer header values embedded in strings', () => {
    expect(scrubString('header was Bearer abc123def456ghijk789')).toBe(
      'header was [REDACTED:bearer]',
    );
  });

  it('redacts long hex blobs', () => {
    const hex = 'a'.repeat(64);
    expect(scrubString(`key=${hex} suffix`)).toBe('key=[REDACTED:hex_secret] suffix');
  });

  it('preserves email domain but scrubs local part', () => {
    expect(scrubString('reached out to alice@example.com, also bob@corp.io')).toBe(
      'reached out to ***@example.com, also ***@corp.io',
    );
  });

  it('truncates pathologically long strings', () => {
    const long = 'x'.repeat(1200);
    const out = scrubString(long) as string;
    expect(out.length).toBeLessThan(long.length);
    expect(out).toMatch(/\[truncated \d+\]$/);
  });
});

describe('scrubValue', () => {
  it('redacts secret headers by name', () => {
    const input = {
      Authorization: 'Bearer xxxxxxxxxxxxxxxx',
      Cookie: 'sb-access=secret',
      'content-type': 'application/json',
      apikey: 'sk_live_aaaaaaaaaaaaaaaaaaa',
    };
    const out = scrubValue(input) as Record<string, unknown>;
    expect(out.Authorization).toBe('[REDACTED:header]');
    expect(out.Cookie).toBe('[REDACTED:header]');
    expect(out.apikey).toBe('[REDACTED:header]');
    // Non-sensitive header passes through.
    expect(out['content-type']).toBe('application/json');
  });

  it('handles case-insensitive secret header matching', () => {
    const input = { 'X-Stripe-Signature': 'sig=abc123' };
    const out = scrubValue(input) as Record<string, unknown>;
    expect(out['X-Stripe-Signature']).toBe('[REDACTED:header]');
  });

  it('walks nested structures', () => {
    const input = {
      request: {
        headers: { Authorization: 'Bearer xyz', 'x-trace': 'abc' },
        body: { user: 'alice@example.com', note: 'sk_live_abcdefghijklmnopqr' },
      },
    };
    const out = scrubValue(input) as { request: { headers: Record<string, string>; body: Record<string, string> } };
    expect(out.request.headers.Authorization).toBe('[REDACTED:header]');
    expect(out.request.headers['x-trace']).toBe('abc');
    expect(out.request.body.user).toBe('***@example.com');
    expect(out.request.body.note).toBe('[REDACTED:stripe_secret]');
  });

  it('caps recursion depth', () => {
    type Nested = { child?: Nested };
    const root: Nested = {};
    let cur: Nested = root;
    for (let i = 0; i < 20; i++) {
      cur.child = {};
      cur = cur.child;
    }
    // Must not throw; deep branches get replaced with a depth marker.
    expect(() => scrubValue(root)).not.toThrow();
  });

  it('preserves arrays', () => {
    const out = scrubValue(['a', 'sk_live_abcdefghijklmnopqr', 'c']) as string[];
    expect(out[0]).toBe('a');
    expect(out[1]).toBe('[REDACTED:stripe_secret]');
    expect(out[2]).toBe('c');
  });
});

describe('scrubSentryEvent', () => {
  it('scrubs request.headers, user.email, message, and extra', () => {
    // Fabricate JWT-shaped fixture from parts so static scanners don't
    // flag the test file as containing a hardcoded JWT.
    const fakeJwt = ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NTYifQ', 'abcdef' + '123456'].join('.');
    const event = {
      message: 'user alice@example.com saw sk_live_abcdefghijklmnopqr',
      request: {
        headers: { Authorization: 'Bearer zzzzzzzzzzzzzzzzz', host: 'api.sovio.app' },
      },
      user: {
        id: 'u_123',
        email: 'alice@example.com',
        username: 'alice-real-name',
      },
      extra: {
        stripe_event: 'evt_xyz includes sk_test_aaaaaaaaaaaaaaaaaa',
      },
      breadcrumbs: [
        {
          category: 'fetch',
          data: { url: `https://x.com?token=${fakeJwt}` },
        },
      ],
    };
    const out = scrubSentryEvent(event) as typeof event;

    expect(out.message).toContain('***@example.com');
    expect(out.message).toContain('[REDACTED:stripe_secret]');
    expect(out.request.headers.Authorization).toBe('[REDACTED:header]');
    expect(out.request.headers.host).toBe('api.sovio.app');
    expect(out.user.id).toBe('u_123');
    expect(out.user.email).toBe('***@example.com');
    // Username intentionally dropped — reused as real name too often.
    expect((out.user as Record<string, unknown>).username).toBeUndefined();
    expect(out.extra.stripe_event).toContain('[REDACTED:stripe_secret]');
    const bc = (out.breadcrumbs[0] as { data: { url: string } }).data.url;
    expect(bc).toContain('[REDACTED:jwt]');
  });

  it('is a no-op for null/undefined events', () => {
    expect(scrubSentryEvent(null)).toBeNull();
    expect(scrubSentryEvent(undefined)).toBeUndefined();
  });

  it('leaves unrelated context alone', () => {
    const event = { message: 'plain log message', tags: { env: 'prod' } };
    const out = scrubSentryEvent(event) as typeof event;
    expect(out.message).toBe('plain log message');
    expect(out.tags.env).toBe('prod');
  });
});
