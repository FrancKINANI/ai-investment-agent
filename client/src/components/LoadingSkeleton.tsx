import React from "react";

type LoadingSkeletonProps = {
  className?: string;
  label: string;
  lines?: number;
};

export function LoadingSkeleton({ className = "", label, lines = 3 }: LoadingSkeletonProps) {
  return <div className={`loading-skeleton ${className}`.trim()} role="status" aria-label={label} aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: lines }, (_, index) => <i key={index} className={`loading-skeleton-line line-${index + 1}`} />)}
  </div>;
}
