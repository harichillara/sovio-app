import type { ReactNode } from 'react';

interface SectionShellProps {
  id?: string;
  eyebrow?: string;
  title: string;
  summary?: string;
  align?: 'left' | 'center';
  children: ReactNode;
}

export function SectionShell({
  id,
  eyebrow,
  title,
  summary,
  align = 'left',
  children,
}: SectionShellProps) {
  return (
    <section id={id} className={`section-shell section-shell--${align}`}>
      <div className="site-frame">
        <div className={`section-shell__intro section-shell__intro--${align}`}>
          {eyebrow ? <p className="section-shell__eyebrow">{eyebrow}</p> : null}
          <h2 className="section-shell__title">{title}</h2>
          {summary ? <p className="section-shell__summary">{summary}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
