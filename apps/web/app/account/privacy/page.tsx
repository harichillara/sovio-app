'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
      }}
    >
      <div>
        <p
          style={{
            color: disabled ? 'var(--sovio-muted)' : 'var(--sovio-text)',
            fontSize: 15,
            fontWeight: 600,
            margin: 0,
          }}
        >
          {label}
        </p>
        <p style={{ color: 'var(--sovio-muted)', fontSize: 13, margin: '4px 0 0' }}>
          {description}
        </p>
      </div>
      <label
        style={{
          position: 'relative',
          width: 48,
          height: 28,
          flexShrink: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: checked ? 'var(--sovio-accent)' : 'var(--sovio-border)',
            borderRadius: 14,
            transition: 'background 0.2s',
          }}
        />
        <span
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            background: '#fff',
            borderRadius: 11,
            top: 3,
            left: checked ? 23 : 3,
            transition: 'left 0.2s',
          }}
        />
      </label>
    </div>
  );
}

export default function PrivacySettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharePresence, setSharePresence] = useState(true);
  const [allowAILearn, setAllowAILearn] = useState(true);
  const [allowAutoReply, setAllowAutoReply] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      setUserId(user.id);

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('key, value')
        .eq('user_id', user.id)
        .in('key', ['privacy_share_presence', 'privacy_ai_learn', 'privacy_auto_reply']);

      if (prefs) {
        for (const p of prefs) {
          if (p.key === 'privacy_share_presence') setSharePresence(p.value === 'true');
          if (p.key === 'privacy_ai_learn') setAllowAILearn(p.value === 'true');
          if (p.key === 'privacy_auto_reply') setAllowAutoReply(p.value === 'true');
        }
      }

      setLoading(false);
    })();
  }, []);

  const savePref = async (key: string, value: boolean) => {
    if (!userId) return;
    const supabase = getSupabase();
    await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, key, value: String(value) }, { onConflict: 'user_id,key' });
  };

  const handleExportData = () => {
    alert("We'll email you a link to download your data within 48 hours.");
  };

  const handleDeleteAccount = () => {
    if (
      confirm(
        'This will permanently delete your account and all associated data. This action cannot be undone. Are you sure?',
      )
    ) {
      alert('Your account will be deleted within 30 days. You will receive a confirmation email.');
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 32px', textAlign: 'center' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/account" style={{ color: 'var(--sovio-muted)', textDecoration: 'none', fontSize: 20 }}>
          &larr;
        </a>
        <h1 style={{ color: 'var(--sovio-text)', fontSize: 28, fontWeight: 800, margin: 0 }}>
          Privacy
        </h1>
      </div>

      <div
        style={{
          background: 'var(--sovio-surface)',
          borderRadius: 18,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toggle
          label="Share presence with friends"
          description="Let your friends see when you're active"
          checked={sharePresence}
          onChange={(v) => {
            setSharePresence(v);
            savePref('privacy_share_presence', v);
          }}
        />
        <div style={{ height: 1, background: 'var(--sovio-border)' }} />
        <Toggle
          label="Allow AI to learn from my messages"
          description="Improve AI suggestions based on your conversations"
          checked={allowAILearn}
          onChange={(v) => {
            setAllowAILearn(v);
            savePref('privacy_ai_learn', v);
          }}
        />
        <div style={{ height: 1, background: 'var(--sovio-border)' }} />
        <Toggle
          label="Allow auto-reply"
          description="AI responds on your behalf in safe contexts"
          checked={allowAutoReply}
          onChange={(v) => {
            setAllowAutoReply(v);
            savePref('privacy_auto_reply', v);
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={handleExportData}
          style={{
            background: 'var(--sovio-surface)',
            border: 'none',
            borderRadius: 14,
            padding: '14px 0',
            color: 'var(--sovio-text)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Export my data
        </button>

        <button
          onClick={handleDeleteAccount}
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
          Delete my account
        </button>
      </div>
    </div>
  );
}
