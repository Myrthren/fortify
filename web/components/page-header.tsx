import type { LucideIcon } from "lucide-react";

/**
 * Shared dashboard page header — eyebrow + title + subtitle with entrance animation.
 * Keeps every tool page's header consistent with the new UI system.
 */
export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  subtitle,
  badge,
  action,
}: {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="anim-fade-up mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <span className="eyebrow">
            {Icon && <Icon className="h-3.5 w-3.5" />} {eyebrow}
          </span>
        )}
        <div className="mt-2 flex items-center gap-2.5">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-2 max-w-2xl text-text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
