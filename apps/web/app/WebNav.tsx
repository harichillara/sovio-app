'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function WebNav() {
  const [isAuth, setIsAuth] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setIsAuth(!!session);
      } catch {
        setIsAuth(false);
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (!checked) {
    return (
      <nav className="site-nav__links">
        <Link href="/">Home</Link>
        <Link href="/pricing">Pricing</Link>
      </nav>
    );
  }

  if (isAuth) {
    return (
      <nav className="site-nav__links">
        <Link href="/">Home</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/account">Account</Link>
        <a href="#" onClick={handleSignOut}>
          Sign Out
        </a>
      </nav>
    );
  }

  return (
    <nav className="site-nav__links">
      <Link href="/">Home</Link>
      <Link href="/pricing">Pricing</Link>
      <Link href="/login">Login</Link>
    </nav>
  );
}
