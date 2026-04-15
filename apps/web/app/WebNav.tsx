'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '../lib/supabase';

export function WebNav() {
  const [isAuth, setIsAuth] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
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
    const supabase = getSupabaseBrowserClient();
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
