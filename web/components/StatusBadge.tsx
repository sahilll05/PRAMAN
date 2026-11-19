"use client";

import { cn } from "@/lib/utils";
import type { VerdictBadge } from "@/lib/status";

const badgeStyles: Record<VerdictBadge, string> = {
  ACTIVE: "badge-active",
  REVOKED: "badge-revoked",
  SUPERSEDED: "badge-superseded",
  EXPIRED: "badge-expired",
  STALE: "badge-stale",
  CHALLENGED: "badge-challenged",
};

const badgeIcons: Record<VerdictBadge, string> = {
  ACTIVE: "✓",
  REVOKED: "✕",
  SUPERSEDED: "→",
  EXPIRED: "⌛",
  STALE: "⚠",
  CHALLENGED: "⚡",
};

interface StatusBadgeProps {
  badge: VerdictBadge;
  className?: string;
}

export function StatusBadge({ badge, className }: StatusBadgeProps) {
  return (
    <span className={cn(badgeStyles[badge], className)}>
      <span className="mr-1">{badgeIcons[badge]}</span>
      {badge}
    </span>
  );
}
