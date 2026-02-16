// Minimal Progress component (shadcn/ui API compatible)
import * as React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0-100
  max?: number; // Default 100
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={className}
        {...props}
      >
        <div className="progress-indicator" style={{ width: `${percentage}%` }} />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
