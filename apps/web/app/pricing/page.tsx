export default function PricingPage() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '0 32px' }}>
      <section style={{ textAlign: 'center', padding: '48px 0 32px' }}>
        <h1 style={{ fontSize: 44, margin: '0 0 12px', color: 'var(--sovio-text)' }}>Simple pricing</h1>
        <p style={{ fontSize: 18, color: 'var(--sovio-muted)', margin: 0 }}>
          Start free. Upgrade when you want more.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 48 }}>
        <div style={{ background: 'var(--sovio-surface)', borderRadius: 24, padding: 32 }}>
          <p style={{ color: 'var(--sovio-accent)', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>FREE</p>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--sovio-text)' }}>$0</h2>
          <p style={{ color: 'var(--sovio-muted)', fontSize: 14, margin: '0 0 24px' }}>Forever free</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['AI plan suggestions', 'Basic coordination', '100 AI tokens/month', 'Replay last 7 days', '5 active plans'].map((f) => (
              <li key={f} style={{ fontSize: 14, color: 'var(--sovio-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--sovio-success)', fontWeight: 800 }}>&#10003;</span> {f}
              </li>
            ))}
          </ul>
          <a href="#" style={{ display: 'block', textAlign: 'center', marginTop: 28, background: 'var(--sovio-surfaceAlt)', color: 'var(--sovio-text)', padding: '14px 0', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            Get started
          </a>
        </div>

        <div style={{ background: 'var(--sovio-accent)', borderRadius: 24, padding: 32 }}>
          <p style={{ color: 'var(--sovio-background)', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>SOVIO PRO</p>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--sovio-background)' }}>$6.99<span style={{ fontSize: 16, fontWeight: 600 }}>/mo</span></h2>
          <p style={{ color: 'var(--sovio-surfaceAlt)', fontSize: 14, margin: '0 0 24px' }}>Do more. Think less.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Unlimited AI tokens', 'Priority plan generation', 'AI-drafted replies', 'Full Replay history', 'Unlimited active plans', 'Auto-reply in safe contexts', 'Deeper momentum insights'].map((f) => (
              <li key={f} style={{ fontSize: 14, color: 'var(--sovio-surfaceAlt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--sovio-background)', fontWeight: 800 }}>&#10003;</span> {f}
              </li>
            ))}
          </ul>
          <a href="#" style={{ display: 'block', textAlign: 'center', marginTop: 28, background: 'var(--sovio-background)', color: 'var(--sovio-accent)', padding: '14px 0', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            Upgrade to Pro
          </a>
        </div>
      </section>
    </main>
  );
}
