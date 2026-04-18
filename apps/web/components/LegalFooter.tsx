import Link from 'next/link';

export function LegalFooter() {
  return (
    <nav
      aria-label="Legal"
      style={{
        display: 'flex',
        gap: 16,
        fontSize: 12,
        color: 'var(--sovio-muted)',
      }}
    >
      <Link href="/terms" style={{ color: 'var(--sovio-muted)', textDecoration: 'none' }}>
        Terms
      </Link>
      <Link href="/privacy" style={{ color: 'var(--sovio-muted)', textDecoration: 'none' }}>
        Privacy
      </Link>
      <Link href="/cookies" style={{ color: 'var(--sovio-muted)', textDecoration: 'none' }}>
        Cookies
      </Link>
    </nav>
  );
}
