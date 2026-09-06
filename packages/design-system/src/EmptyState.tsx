import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Required by §12/work-package contract: every list/collection needs an honest empty state, not a blank screen. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    // Phase 8 accessibility audit: border-gray-300 was 1.47:1 against
    // white, failing WCAG 2.2 SC 1.4.11's 3:1 non-text-contrast
    // requirement - gray-500 clears it (4.83:1), same fix as Input.tsx.
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-500 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
