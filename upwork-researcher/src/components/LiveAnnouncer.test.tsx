import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveAnnouncerProvider, useAnnounce } from './LiveAnnouncer';
import { act } from 'react';

// Test component that uses the hook
function TestComponent() {
  const announce = useAnnounce();

  return (
    <div>
      <button onClick={() => announce('Test message')}>
        Announce Polite
      </button>
      <button onClick={() => announce('Urgent message', 'assertive')}>
        Announce Assertive
      </button>
    </div>
  );
}

describe('LiveAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('LiveAnnouncerProvider', () => {
    it('renders children', () => {
      render(
        <LiveAnnouncerProvider>
          <div>Test Content</div>
        </LiveAnnouncerProvider>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders polite live region with role=status', () => {
      render(
        <LiveAnnouncerProvider>
          <div>Content</div>
        </LiveAnnouncerProvider>
      );

      const politeRegion = screen.getByRole('status');
      expect(politeRegion).toHaveAttribute('aria-live', 'polite');
      expect(politeRegion).toHaveAttribute('aria-atomic', 'true');
      expect(politeRegion).toHaveClass('sr-only');
    });

    it('renders assertive live region with role=alert', () => {
      render(
        <LiveAnnouncerProvider>
          <div>Content</div>
        </LiveAnnouncerProvider>
      );

      const assertiveRegion = screen.getByRole('alert');
      expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive');
      expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true');
      expect(assertiveRegion).toHaveClass('sr-only');
    });
  });

  describe('useAnnounce hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAnnounce must be used within LiveAnnouncerProvider');

      console.error = originalError;
    });

    it('announces polite messages to status region', () => {
      render(
        <LiveAnnouncerProvider>
          <TestComponent />
        </LiveAnnouncerProvider>
      );

      const button = screen.getByText('Announce Polite');
      const politeRegion = screen.getByRole('status');

      act(() => {
        button.click();
      });

      expect(politeRegion).toHaveTextContent('Test message');

      // Message should clear after timeout
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(politeRegion).toHaveTextContent('');
    });

    it('announces assertive messages to alert region', () => {
      render(
        <LiveAnnouncerProvider>
          <TestComponent />
        </LiveAnnouncerProvider>
      );

      const button = screen.getByText('Announce Assertive');
      const assertiveRegion = screen.getByRole('alert');

      act(() => {
        button.click();
      });

      expect(assertiveRegion).toHaveTextContent('Urgent message');

      // Message should clear after timeout
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(assertiveRegion).toHaveTextContent('');
    });

    it('clears previous announcement when new one is made', () => {
      render(
        <LiveAnnouncerProvider>
          <TestComponent />
        </LiveAnnouncerProvider>
      );

      const politeButton = screen.getByText('Announce Polite');
      const politeRegion = screen.getByRole('status');

      act(() => {
        politeButton.click();
      });

      expect(politeRegion).toHaveTextContent('Test message');

      act(() => {
        politeButton.click();
      });

      // Should still have the message (previous timeout cleared)
      expect(politeRegion).toHaveTextContent('Test message');
    });
  });
});
