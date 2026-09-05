export interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

/** Respects prefers-reduced-motion (§12) via motion-reduce: to disable the pulse instead of forcing it on everyone. */
export function Skeleton({ width = "100%", height = "1rem", className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-gray-200 ${className}`}
      style={{ width, height }}
    />
  );
}
