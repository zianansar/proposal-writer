// Story 4b.8: RSS Import Progress Tests
// Tests fallback status display and error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RssImportProgress } from './RssImportProgress';

// Mock the useRssImport hook
vi.mock('../hooks/useRssImport', () => ({
  useRssImport: vi.fn(),
}));

import { useRssImport } from '../hooks/useRssImport';

const mockUseRssImport = vi.mocked(useRssImport);

describe('RssImportProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock state - no activity
    mockUseRssImport.mockReturnValue({
      progress: null,
      isComplete: false,
      completionData: null,
      error: null,
      isFallingBack: false,
      fallbackMessage: null,
      reset: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('renders nothing when no progress and not complete', () => {
      const { container } = render(<RssImportProgress />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('fallback status display (AC-1)', () => {
    it('shows fallback message when isFallingBack is true', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: null,
        isFallingBack: true,
        fallbackMessage: 'RSS blocked. Trying alternative method...',
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByText('RSS blocked. Trying alternative method...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('rss-progress-fallback');
    });

    it('displays spinner during fallback', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: null,
        isFallingBack: true,
        fallbackMessage: 'RSS blocked. Trying alternative method...',
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      const spinner = document.querySelector('.rss-progress-spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('has polite aria-live for accessibility', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: null,
        isFallingBack: true,
        fallbackMessage: 'RSS blocked. Trying alternative method...',
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('error state with both methods failed (AC-5)', () => {
    it('shows composite error message when both RSS and scraping fail', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: 'Both import methods failed. RSS: 403 Forbidden. Scraping: HTML changed. Please paste jobs manually.',
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByText(/Import failed:/)).toBeInTheDocument();
      expect(screen.getByText(/Both import methods failed/)).toBeInTheDocument();
    });

    it('shows "Try Manual Paste" button when both methods fail (AC-6)', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: 'Both import methods failed. RSS: error. Scraping: error.',
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      const manualPasteBtn = screen.getByRole('button', { name: /Try Manual Paste/i });
      expect(manualPasteBtn).toBeInTheDocument();
      expect(manualPasteBtn).toHaveClass('rss-progress-manual-paste-btn');
    });

    it('does not show "Try Manual Paste" button for non-composite errors', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: 'Network error occurred',
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.queryByRole('button', { name: /Try Manual Paste/i })).not.toBeInTheDocument();
    });

    it('clicking "Try Manual Paste" scrolls to top (placeholder navigation)', () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: 'Both import methods failed. RSS: error. Scraping: error.',
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      const manualPasteBtn = screen.getByRole('button', { name: /Try Manual Paste/i });
      fireEvent.click(manualPasteBtn);

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('error container has alert role for accessibility', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: 'Some error',
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('progress display', () => {
    it('shows progress bar during analysis', () => {
      mockUseRssImport.mockReturnValue({
        progress: { batch_id: 'test', current: 5, total: 10, job_title: 'React Developer' },
        isComplete: false,
        completionData: null,
        error: null,
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/Analyzed 5\/10 jobs/)).toBeInTheDocument();
      expect(screen.getByText(/React Developer/)).toBeInTheDocument();
    });

    it('calculates percentage correctly', () => {
      mockUseRssImport.mockReturnValue({
        progress: { batch_id: 'test', current: 3, total: 10, job_title: 'Test Job' },
        isComplete: false,
        completionData: null,
        error: null,
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '3');
      expect(progressBar).toHaveAttribute('aria-valuemax', '10');

      const fill = document.querySelector('.rss-progress-fill');
      expect(fill).toHaveStyle({ width: '30%' });
    });
  });

  describe('completion state', () => {
    it('shows completion message when done', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: true,
        completionData: { batch_id: 'test', total_analyzed: 10, failed_count: 0 },
        error: null,
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByText(/All jobs analyzed/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View queue/i })).toBeInTheDocument();
    });

    it('View queue button scrolls to top', () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: true,
        completionData: { batch_id: 'test', total_analyzed: 10, failed_count: 0 },
        error: null,
        isFallingBack: false,
        fallbackMessage: null,
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      const viewQueueBtn = screen.getByRole('button', { name: /View queue/i });
      fireEvent.click(viewQueueBtn);

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });
  });

  describe('state priority', () => {
    it('error takes precedence over fallback', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: 'Error message',
        isFallingBack: true,
        fallbackMessage: 'Fallback message',
        reset: vi.fn(),
      });

      render(<RssImportProgress />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText('Fallback message')).not.toBeInTheDocument();
    });

    it('fallback takes precedence over no-progress state', () => {
      mockUseRssImport.mockReturnValue({
        progress: null,
        isComplete: false,
        completionData: null,
        error: null,
        isFallingBack: true,
        fallbackMessage: 'RSS blocked. Trying alternative method...',
        reset: vi.fn(),
      });

      const { container } = render(<RssImportProgress />);

      expect(container.firstChild).not.toBeNull();
      expect(screen.getByText(/RSS blocked/)).toBeInTheDocument();
    });
  });
});
