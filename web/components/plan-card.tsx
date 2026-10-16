import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/plans";

// One plan card, as shown on /pricing and /whop. `children` is the checkout
// area at the bottom; `previous` adds the "Everything in X, plus" line.
export function PlanCard({
  plan,
  previous,
  className = "",
  children,
}: {
  plan: Plan;
  previous?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`bento flex flex-col p-6 ${plan.highlight ? "ring-1 ring-white/25" : ""} ${className}`}
      style={plan.highlight ? { boxShadow: "0 0 50px -18px rgba(255,255,255,0.35)" } : undefined}
    >
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-muted">{plan.name}</span>
          {plan.highlight && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
              Recommended
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
          {plan.price !== "£0" && <span className="text-sm text-text-muted">/mo</span>}
        </div>
        <p className="mt-2 text-sm text-text-muted">{plan.blurb}</p>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5 text-sm">
        {previous && <li className="text-xs text-text-dim">Everything in {previous}, plus:</li>}
        {plan.highlights.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
              <Check className="h-2.5 w-2.5 text-text" />
            </span>
            <span className="text-text">{f}</span>
          </li>
        ))}
      </ul>

      {children}
    </div>
  );
}
