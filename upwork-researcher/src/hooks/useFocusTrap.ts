import { useEffect, useRef, useCallback } from 'react';

/** Selector for all focusable elements */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  /** Element that triggered the modal (to return focus on close) */
  triggerRef?: React.RefObject<HTMLElement>;
  /** Auto-focus first element on mount (default: true) */
  autoFocus?: boolean;
}

/**
 * Traps focus within a container element.
 * Used for modal dialogs to meet WCAG 2.1 SC 2.4.3.
 *
 * @param containerRef - Reference to the container element
 * @param options - Configuration options for focus trap behavior
 * @returns Object with utility functions for managing focus
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  options: UseFocusTrapOptions = {}
) {
  const { triggerRef, autoFocus = true } = options;
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
  }, []);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(el => {
      // Filter out elements with display:none or visibility:hidden
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, [containerRef]);

  // Handle Tab key to trap focus
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, getFocusableElements]);

  // Auto-focus first element on mount
  useEffect(() => {
    if (!autoFocus) return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        focusableElements[0].focus();
      });
    }
  }, [autoFocus, getFocusableElements]);

  // Return focus to trigger element on unmount
  useEffect(() => {
    return () => {
      const elementToFocus = triggerRef?.current || previousActiveElement.current;
      if (elementToFocus && document.body.contains(elementToFocus)) {
        elementToFocus.focus();
      }
    };
  }, [triggerRef]);

  return { getFocusableElements };
}
