import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

import { OUTCOME_STATUSES, type OutcomeStatus } from "./useUpdateProposalOutcome";
import "./OutcomeDropdown.css";

/** Display labels: underscores → spaces, capitalize each word */
export function formatLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface OutcomeDropdownProps {
  currentStatus: OutcomeStatus;
  onSelect: (status: OutcomeStatus) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

/**
 * Dropdown listbox for selecting proposal outcome status (Story 7.2).
 *
 * AC-1: Shows all 7 statuses with current highlighted.
 * AC-3: Rendered via portal to escape virtualized list overflow.
 * AC-4: Full keyboard navigation (Escape, Arrow keys, Enter).
 */
export function OutcomeDropdown({
  currentStatus,
  onSelect,
  onClose,
  anchorRect,
}: OutcomeDropdownProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const currentIndex = OUTCOME_STATUSES.indexOf(currentStatus);
  const [focusedIndex, setFocusedIndex] = useState(currentIndex >= 0 ? currentIndex : 0);

  // Focus the list on mount
  useEffect(() => {
    listRef.current?.focus();
  }, []);

  // AC-3: Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture phase + setTimeout so the badge click that opened us doesn't immediately close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [onClose]);

  // M5: Close on scroll to prevent dropdown detachment from badge
  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [onClose]);

  // AC-4: Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex((prev) => Math.min(prev + 1, OUTCOME_STATUSES.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          onSelect(OUTCOME_STATUSES[focusedIndex]);
          break;
        case "Tab":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [focusedIndex, onClose, onSelect],
  );

  // Scroll focused option into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const focused = list.children[focusedIndex] as HTMLElement | undefined;
    focused?.scrollIntoView?.({ block: "nearest" });
  }, [focusedIndex]);

  // L1: Position below anchor badge with viewport clamping
  const DROPDOWN_HEIGHT = 280; // max-height from CSS
  const DROPDOWN_WIDTH = 160; // min-width from CSS
  const GAP = 4;
  let top = anchorRect.bottom + GAP;
  let left = anchorRect.left;

  // Flip above if not enough space below
  if (top + DROPDOWN_HEIGHT > window.innerHeight && anchorRect.top - DROPDOWN_HEIGHT - GAP > 0) {
    top = anchorRect.top - DROPDOWN_HEIGHT - GAP;
  }
  // Clamp left so dropdown doesn't overflow right edge
  if (left + DROPDOWN_WIDTH > window.innerWidth) {
    left = window.innerWidth - DROPDOWN_WIDTH - 8;
  }

  const style: React.CSSProperties = {
    position: "fixed",
    top,
    left,
    zIndex: 9999,
  };

  // M3: Active descendant ID for screen reader keyboard navigation
  const focusedOptionId = `outcome-option-${OUTCOME_STATUSES[focusedIndex]}`;

  const dropdown = (
    <ul
      ref={listRef}
      className="outcome-dropdown"
      role="listbox"
      aria-label="Select outcome status"
      aria-activedescendant={focusedOptionId}
      tabIndex={0}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {OUTCOME_STATUSES.map((status, index) => (
        <li
          key={status}
          id={`outcome-option-${status}`}
          role="option"
          aria-selected={status === currentStatus}
          className={`outcome-dropdown__option outcome-dropdown__option--${status}${
            index === focusedIndex ? " outcome-dropdown__option--focused" : ""
          }${status === currentStatus ? " outcome-dropdown__option--current" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(status);
          }}
          onMouseEnter={() => setFocusedIndex(index)}
        >
          {formatLabel(status)}
        </li>
      ))}
    </ul>
  );

  return createPortal(dropdown, document.body);
}
