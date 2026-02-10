import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface LiveAnnouncerContextValue {
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue | null>(null);

interface LiveAnnouncerProviderProps {
  children: ReactNode;
}

/**
 * Provides screen reader announcements via aria-live regions.
 * Wrap your app with this provider (Story 8.3, AC3).
 */
export function LiveAnnouncerProvider({ children }: LiveAnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  // M3 fix: Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    // Clear any pending announcements
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (politeness === 'assertive') {
      setAssertiveMessage(message);
      // Clear after announcement
      timeoutRef.current = setTimeout(() => setAssertiveMessage(''), 1000);
    } else {
      setPoliteMessage(message);
      timeoutRef.current = setTimeout(() => setPoliteMessage(''), 1000);
    }
  }, []);

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Visually hidden live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

/**
 * Hook to announce messages to screen readers.
 * @example
 * const announce = useAnnounce();
 * announce('Proposal generated successfully');
 * announce('Error generating proposal', 'assertive');
 */
export function useAnnounce() {
  const context = useContext(LiveAnnouncerContext);
  if (!context) {
    throw new Error('useAnnounce must be used within LiveAnnouncerProvider');
  }
  return context.announce;
}
