import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Fallback colours — used when ErrorBoundary sits outside ThemeProvider */
/* ------------------------------------------------------------------ */
const FALLBACK_BG = '#0D0D0D';
const FALLBACK_TEXT = '#FFFFFF';
const FALLBACK_MUTED = '#888888';
const FALLBACK_ACCENT = '#BDFF2E';
const FALLBACK_ACCENT_TEXT = '#0D0D0D';

/* ------------------------------------------------------------------ */
/*  ErrorFallback (functional — can use hooks when a provider exists)  */
/* ------------------------------------------------------------------ */

interface ErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

/**
 * Default crash-recovery screen.
 *
 * Attempts to pull colours from ThemeProvider via `useTheme()`, but
 * gracefully falls back to hard-coded dark-theme tokens when the
 * provider is unavailable (e.g. when ErrorBoundary wraps ThemeProvider).
 */
export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  // ErrorBoundary intentionally sits outside ThemeProvider so it can catch
  // provider errors.  That means useTheme() would throw here.  We use the
  // hardcoded design-token fallbacks instead — they match Sovio's dark theme.
  const bg = FALLBACK_BG;
  const text = FALLBACK_TEXT;
  const muted = FALLBACK_MUTED;
  const accent = FALLBACK_ACCENT;
  const accentText = FALLBACK_ACCENT_TEXT;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: muted }]}>{error.message}</Text>
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Try Again"
        style={[styles.button, { backgroundColor: accent }]}
      >
        <Text style={[styles.buttonText, { color: accentText }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  ErrorBoundary (class component — React requirement)               */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /**
   * Optional observability hook — called alongside the internal `console.error`.
   * Apps can forward to Sentry / Datadog / etc. without `packages/ui` taking a
   * hard dependency on any SDK.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Custom fallback — ReactNode or render function
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset);
      }
      if (fallback !== undefined) {
        return fallback;
      }

      // Default fallback
      return <ErrorFallback error={error} onReset={this.handleReset} />;
    }

    return children;
  }
}

export default ErrorBoundary;

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
