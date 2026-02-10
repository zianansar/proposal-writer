import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import "./Tooltip.css";

// Counter for deterministic tooltip IDs (L2 fix)
let tooltipIdCounter = 0;

interface TooltipProps {
  /** Tooltip content text */
  content: string;
  /** Child element to wrap */
  children: ReactNode;
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Position relative to child */
  position?: "top" | "bottom" | "left" | "right";
}

/**
 * Accessible tooltip component (Story 6.5)
 * Shows on hover/focus with configurable delay and position
 */
export function Tooltip({
  content,
  children,
  delay = 300,
  position = "top",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useRef(`tooltip-${++tooltipIdCounter}`);

  const showTooltip = () => {
    if (!content) return; // Don't show empty tooltips
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // Handle Escape key to hide tooltip (L1 fix)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isVisible) {
      hideTooltip();
    }
  }, [isVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={handleKeyDown}
    >
      <div aria-describedby={isVisible ? tooltipId.current : undefined}>
        {children}
      </div>
      {isVisible && content && (
        <div
          id={tooltipId.current}
          role="tooltip"
          className={`tooltip tooltip--${position}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
