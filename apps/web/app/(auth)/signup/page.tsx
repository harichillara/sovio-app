'use client';

import React, { useState } from 'react';
import { getSupabaseBrowserClient } from '../../../lib/supabase';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/account` },
    });
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ color: 'var(--sovio-accent)', fontSize: 28, fontWeight: 800, margin: 0 }}>
          Check your email
        </h1>
        <p style={{ color: 'var(--sovio-muted)', fontSize: 15 }}>
          We sent a confirmation link to <strong style={{ color: 'var(--sovio-text)' }}>{email}</strong>.
          Click the link to activate your account.
        </p>
        <a
          href="/login"
          style={{ color: 'var(--sovio-accent)', fontWeight: 600, textDecoration: 'none', fontSize: 15 }}
        >
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Branding */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: 'var(--sovio-accent)', fontSize: 32, fontWeight: 800, margin: 0 }}>
          Sovio
        </h1>
        <p style={{ color: 'var(--sovio-muted)', fontSize: 14, marginTop: 8 }}>
          Create your account
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: 'var(--sovio-surface)',
          borderRadius: 18,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--sovio-muted)', fontSize: 13, fontWeight: 600 }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                background: 'var(--sovio-surfaceAlt)',
                border: '1px solid var(--sovio-border)',
                borderRadius: 12,
                padding: '10px 14px',
                color: 'var(--sovio-text)',
                fontSize: 15,
                outline: 'none',
              }}
              placeholder="Your name"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--sovio-muted)', fontSize: 13, fontWeight: 600 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                background: 'var(--sovio-surfaceAlt)',
                border: '1px solid var(--sovio-border)',
                borderRadius: 12,
                padding: '10px 14px',
                color: 'var(--sovio-text)',
                fontSize: 15,
                outline: 'none',
              }}
              placeholder="you@email.com"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--sovio-muted)', fontSize: 13, fontWeight: 600 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                background: 'var(--sovio-surfaceAlt)',
                border: '1px solid var(--sovio-border)',
                borderRadius: 12,
                padding: '10px 14px',
                color: 'var(--sovio-text)',
                fontSize: 15,
                outline: 'none',
              }}
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <p style={{ color: 'var(--sovio-danger)', fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--sovio-accent)',
              color: 'var(--sovio-background)',
              border: 'none',
              borderRadius: 12,
              padding: '12px 0',
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--sovio-border)' }} />
          <span style={{ color: 'var(--sovio-muted)', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--sovio-border)' }} />
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleAuth}
          type="button"
          style={{
            background: 'var(--sovio-surfaceAlt)',
            color: 'var(--sovio-text)',
            border: '1px solid var(--sovio-border)',
            borderRadius: 12,
            padding: '12px 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Continue with Google
        </button>

        {/* Link to login */}
        <p style={{ color: 'var(--sovio-muted)', fontSize: 13, textAlign: 'center', margin: 0 }}>
          Already have an account?{' '}
          <a
            href="/login"
            style={{ color: 'var(--sovio-accent)', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
