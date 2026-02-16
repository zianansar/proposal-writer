// Minimal Skeleton component (shadcn/ui API compatible)
import * as React from "react";

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={className} {...props} />,
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
