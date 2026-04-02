export default function Page() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '0 32px' }}>
      <section style={{ padding: '64px 28px', borderRadius: 28, background: 'var(--sovio-surface)', marginBottom: 32 }}>
        <p style={{ color: 'var(--sovio-accent)', fontWeight: 800, marginBottom: 8, fontSize: 14, letterSpacing: 1 }}>SOVIO</p>
        <h1 style={{ fontSize: 52, lineHeight: 1.05, margin: '0 0 16px', color: 'var(--sovio-text)' }}>
          Stop scrolling. Start doing.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--sovio-muted)', maxWidth: 640, margin: '0 0 32px' }}>
          Sovio helps you make real plans faster with smarter suggestions, lighter planning, and less effort.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <a href="#" style={{ display: 'inline-block', background: 'var(--sovio-accent)', color: 'var(--sovio-background)', padding: '14px 28px', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            Download the app
          </a>
          <a href="/pricing" style={{ display: 'inline-block', background: 'var(--sovio-surfaceAlt)', color: 'var(--sovio-text)', padding: '14px 28px', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            See pricing
          </a>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { icon: '\u2726', title: 'AI-powered plans', body: 'Sovio drafts plans, suggests times, and even writes your opening message. You just say yes.' },
          { icon: '\u26A1', title: 'Low-effort coordination', body: 'No more group chat ping-pong. Quick matching and smart suggestions get everyone aligned faster.' },
          { icon: '\u21BB', title: 'Replay missed moments', body: 'Skipped something? Sovio resurfaces it later so you never lose a good plan.' },
        ].map((f) => (
          <div key={f.title} style={{ background: 'var(--sovio-surface)', borderRadius: 22, padding: 24 }}>
            <p style={{ fontSize: 28, margin: '0 0 8px' }}>{f.icon}</p>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sovio-text)', margin: '0 0 8px' }}>{f.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sovio-muted)', margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </section>

      <section style={{ background: 'var(--sovio-accent)', borderRadius: 24, padding: '48px 32px', textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ color: 'var(--sovio-background)', fontSize: 32, fontWeight: 800, margin: '0 0 12px' }}>Do more. Think less.</h2>
        <p style={{ color: 'var(--sovio-surfaceAlt)', fontSize: 16, margin: '0 0 24px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Join the people who stopped scrolling and started doing.
        </p>
        <a href="#" style={{ display: 'inline-block', background: 'var(--sovio-background)', color: 'var(--sovio-accent)', padding: '14px 32px', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
          Get Sovio free
        </a>
      </section>
    </main>
  );
}
