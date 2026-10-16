import type { ReactNode } from "react";

// Building blocks for the smaller public pages (/whop, /affiliates) so they
// share the landing page's hero and card treatment.

export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-bg-border">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora aurora-violet left-1/2 top-[-160px] h-[420px] w-[680px] -translate-x-1/2" />
      </div>
      <div className="bg-grid-fade absolute inset-0" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <span className="eyebrow anim-fade-up">{eyebrow}</span>
        <h1 className="anim-fade-up anim-d1 mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {children && (
          <div className="anim-fade-up anim-d2 mx-auto mt-5 max-w-xl text-balance text-text-muted">{children}</div>
        )}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mb-10 text-center">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {children && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">{children}</p>}
    </div>
  );
}

export function NumberedStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="bento flex flex-col p-6">
      <span className="text-xs font-semibold tracking-widest text-text-dim">{String(n).padStart(2, "0")}</span>
      <h3 className="mt-2 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{children}</p>
    </div>
  );
}
