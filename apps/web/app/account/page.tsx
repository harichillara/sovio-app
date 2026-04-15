'use client';

import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../../lib/supabase';

interface Profile {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_tier: string;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = '/login';
        return;
      }

      setUser(authUser);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, email, avatar_url, subscription_tier')
        .eq('id', authUser.id)
        .single();

      setProfile(profileData as Profile | null);
      setLoading(false);
    })();
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '48px 32px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--sovio-muted)', fontSize: 15 }}>Loading...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <h1 style={{ color: 'var(--sovio-text)', fontSize: 28, fontWeight: 800, margin: 0 }}>
        Account
      </h1>

      {/* Profile section */}
      <div
        style={{
          background: 'var(--sovio-surface)',
          borderRadius: 18,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: 'var(--sovio-surfaceAlt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--sovio-accent)',
              overflow: 'hidden',
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (profile?.display_name?.[0] ?? 'S').toUpperCase()
            )}
          </div>

          <div>
            <h2 style={{ color: 'var(--sovio-text)', fontSize: 20, fontWeight: 800, margin: 0 }}>
              {profile?.display_name ?? 'Sovio User'}
            </h2>
            <p style={{ color: 'var(--sovio-muted)', fontSize: 14, margin: '4px 0 0' }}>
              {user?.email ?? ''}
            </p>
          </div>
        </div>

        {/* Subscription status */}
        <div
          style={{
            background: 'var(--sovio-surfaceAlt)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p style={{ color: 'var(--sovio-muted)', fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
              Plan
            </p>
            <p style={{ color: 'var(--sovio-text)', fontSize: 16, fontWeight: 800, margin: '4px 0 0' }}>
              Sovio {profile?.subscription_tier === 'pro' ? 'Pro' : 'Free'}
            </p>
          </div>
          <span
            style={{
              background: profile?.subscription_tier === 'pro' ? 'var(--sovio-accent)' : 'var(--sovio-border)',
              color: profile?.subscription_tier === 'pro' ? 'var(--sovio-background)' : 'var(--sovio-text)',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {profile?.subscription_tier === 'pro' ? 'PRO' : 'FREE'}
          </span>
        </div>
      </div>

      {/* Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a
          href="/account/privacy"
          style={{
            background: 'var(--sovio-surface)',
            borderRadius: 14,
            padding: '14px 18px',
            color: 'var(--sovio-text)',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 600,
            display: 'block',
          }}
        >
          Privacy Settings
        </a>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          background: 'var(--sovio-surface)',
          border: 'none',
          borderRadius: 14,
          padding: '14px 0',
          color: 'var(--sovio-danger)',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
