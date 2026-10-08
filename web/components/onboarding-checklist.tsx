import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

type Step = { title: string; description: string; href: string; done: boolean };

export function OnboardingChecklist({ steps }: { steps: Step[] }) {
  const completed = steps.filter((step) => step.done).length;
  if (completed === steps.length) return null;

  return (
    <section className="card-elevated mb-8 p-5 sm:p-6" aria-label="Getting started">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Getting started</p>
          <h2 className="mt-1 text-lg font-semibold">Make Fortify useful for your business</h2>
        </div>
        <span className="text-xs text-text-muted">{completed} of {steps.length} complete</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${completed / steps.length * 100}%` }} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <Link key={step.href} href={step.href} className="group rounded-lg border border-bg-border p-3 transition hover:border-white/20">
            <div className="flex items-center gap-2 text-sm font-medium">
              {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-text-dim" />}
              {step.title}
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-text-dim transition group-hover:translate-x-0.5" />
            </div>
            <p className="mt-1 text-xs text-text-muted">{step.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
