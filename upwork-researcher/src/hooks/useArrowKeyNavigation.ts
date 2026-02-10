/**
 * Story 8.2 Task 6: Arrow Key Navigation Hook
 *
 * Handles arrow key navigation for list components.
 * Implements roving tabindex pattern for WCAG compliance (AC8).
 */

import { useCallback } from 'react';

interface UseArrowKeyNavigationOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Current focused item index */
  currentIndex: number;
  /** Callback when index changes */
  onIndexChange: (index: number) => void;
  /** Enable horizontal navigation (Left/Right instead of Up/Down) */
  horizontal?: boolean;
  /** Enable wrapping (first to last, last to first) */
  wrap?: boolean;
}

/**
 * Handles arrow key navigation for list components.
 * Implements roving tabindex pattern for WCAG 2.1 SC 2.4.7.
 *
 * @example
 * ```tsx
 * const { handleKeyDown } = useArrowKeyNavigation({
 *   itemCount: items.length,
 *   currentIndex: focusedIndex,
 *   onIndexChange: setFocusedIndex,
 * });
 *
 * <div role="listbox" onKeyDown={handleKeyDown}>
 *   {items.map((item, index) => (
 *     <div
 *       key={item.id}
 *       role="option"
 *       tabIndex={index === focusedIndex ? 0 : -1}
 *     >
 *       {item.name}
 *     </div>
 *   ))}
 * </div>
 * ```
 */
export function useArrowKeyNavigation({
  itemCount,
  currentIndex,
  onIndexChange,
  horizontal = false,
  wrap = true,
}: UseArrowKeyNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle empty list - no navigation possible
      if (itemCount === 0) {
        return;
      }

      const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
      const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';

      switch (e.key) {
        case prevKey:
          e.preventDefault();
          if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
          } else if (wrap) {
            onIndexChange(itemCount - 1);
          }
          break;

        case nextKey:
          e.preventDefault();
          if (currentIndex < itemCount - 1) {
            onIndexChange(currentIndex + 1);
          } else if (wrap) {
            onIndexChange(0);
          }
          break;

        case 'Home':
          e.preventDefault();
          onIndexChange(0);
          break;

        case 'End':
          e.preventDefault();
          onIndexChange(itemCount - 1);
          break;
      }
    },
    [currentIndex, itemCount, onIndexChange, horizontal, wrap]
  );

  return { handleKeyDown };
}
