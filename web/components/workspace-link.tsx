"use client";
import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps } from "react";
function Pending() {
  const { pending } = useLinkStatus();
  return <span className="workspace-link-pending" data-pending={pending} aria-hidden="true" />;
}
// Prefetch loading boundaries on intent, without warming the whole toolkit.
export function WorkspaceLink({ children, onMouseEnter, onFocus, prefetch, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  const warm = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!connection?.saveData && !/^(slow-)?2g$/.test(connection?.effectiveType ?? "")) setIntent(true);
  };
  return <Link {...props} prefetch={prefetch ?? (intent ? null : false)}
    onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) warm(); }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) warm(); }}>
    {children}<Pending />
  </Link>;
}
