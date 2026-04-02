'use client';

import { useMemo, useState } from 'react';
import type { WaitlistSignupInput } from '../../content/types';

interface WaitlistFormProps {
  source: string;
  compact?: boolean;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function WaitlistForm({ source, compact = false }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');

  const hint = useMemo(() => {
    if (status === 'success') {
      return message || 'You are in. Early access drops first here.';
    }

    if (status === 'error') {
      return message || 'Something slipped. Try again in a moment.';
    }

    return compact
      ? 'Get product drops, launch notes, and early access invites.'
      : 'Get launch access, product drops, and first access to the momentum layer.';
  }, [compact, message, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    const payload: WaitlistSignupInput = {
      email,
      source,
      referrer:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
    };

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to join right now.');
      }

      setStatus('success');
      setMessage(data.message ?? '');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'Unable to join right now.',
      );
    }
  }

  return (
    <form
      className={`waitlist-form ${compact ? 'waitlist-form--compact' : ''}`}
      onSubmit={handleSubmit}
    >
      <label className="waitlist-form__label" htmlFor={`waitlist-${source}`}>
        Join the waitlist
      </label>
      <div className="waitlist-form__row">
        <input
          id={`waitlist-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@email.com"
          className="waitlist-form__input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button
          type="submit"
          className="waitlist-form__button"
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Joining...' : 'Get access'}
        </button>
      </div>
      <p className={`waitlist-form__hint waitlist-form__hint--${status}`}>
        {hint}
      </p>
    </form>
  );
}
