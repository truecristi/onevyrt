import type { ReactNode } from "react";

export interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** role="alert" so assistive tech announces the failure without the user needing to find it visually. */
export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <p className="text-sm font-semibold text-red-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-red-700">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
