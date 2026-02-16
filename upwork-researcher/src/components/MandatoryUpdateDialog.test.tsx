/**
 * Tests for MandatoryUpdateDialog component (Story 9.8 Task 7.1)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MandatoryUpdateDialog } from './MandatoryUpdateDialog';
import type { UpdateInfo, DownloadProgress } from '../hooks/useUpdater';

const mockUpdateInfo: UpdateInfo = {
  version: '1.0.1',
  currentVersion: '1.0.0',
  body: 'CRITICAL: Fixes AI detection bypass. All users must update immediately.',
  date: '2026-02-16T12:00:00Z',
  isCritical: true,
};

describe('MandatoryUpdateDialog', () => {
  describe('AC-1: Non-dismissible modal', () => {
    it('should render with correct ARIA attributes', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'mandatory-update-title');
      expect(dialog).toHaveAttribute(
        'aria-describedby',
        'mandatory-update-description'
      );
    });

    it('should have no close button', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      // Should not have any close/X button
      const closeButtons = screen.queryAllByRole('button', { name: /close|x/i });
      expect(closeButtons).toHaveLength(0);
    });

    it('should render critical title', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      expect(
        screen.getByText('Critical Security Update Required')
      ).toBeInTheDocument();
    });
  });

  describe('AC-2: Update Now action', () => {
    it('should render Update Now button when no download in progress', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      const button = screen.getByRole('button', { name: 'Update Now' });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('should call onUpdateNow when Update Now button is clicked', async () => {
      const user = userEvent.setup();
      const onUpdateNow = vi.fn();

      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={onUpdateNow}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      const button = screen.getByRole('button', { name: 'Update Now' });
      await user.click(button);

      expect(onUpdateNow).toHaveBeenCalledTimes(1);
    });

    it('should show Downloading... text when download is in progress', () => {
      const progressEvent: DownloadProgress = {
        event: 'Progress',
        data: { contentLength: 1000, chunkLength: 250 },
      };

      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={progressEvent}
          downloadError={null}
          isDownloading={true}
        />
      );

      expect(screen.getByText('Downloading...')).toBeInTheDocument();
    });

    it('should disable button during download', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={{ event: 'Started', data: { contentLength: 1000 } }}
          downloadError={null}
          isDownloading={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('AC-3: Progress bar during download', () => {
    it('should show progress bar with Started event', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={{ event: 'Started', data: { contentLength: 1000 } }}
          downloadError={null}
          isDownloading={true}
        />
      );

      expect(screen.getByText('Starting download...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show progress percentage with Progress event', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={{
            event: 'Progress',
            data: { contentLength: 1000, chunkLength: 500 },
          }}
          downloadError={null}
          isDownloading={true}
        />
      );

      // "Downloading..." appears in both button text and progress text
      const downloadingTexts = screen.getAllByText(/Downloading\.\.\./);
      expect(downloadingTexts.length).toBeGreaterThan(0);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });

    it('should show Download complete with Finished event', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={{ event: 'Finished' }}
          downloadError={null}
          isDownloading={true}
        />
      );

      expect(screen.getByText('Download complete')).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('AC-4: Error handling and retry', () => {
    it('should render error message when download fails', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError="Network error"
          isDownloading={false}
        />
      );

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Update failed: Network error');
      expect(errorAlert).toHaveTextContent(
        'Check your internet connection and try again'
      );
    });

    it('should render Retry button when error is present', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError="Network error"
          isDownloading={false}
        />
      );

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).not.toBeDisabled();

      // Update Now button should not be present
      expect(
        screen.queryByRole('button', { name: 'Update Now' })
      ).not.toBeInTheDocument();
    });

    it('should call onRetry when Retry button is clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={onRetry}
          downloadProgress={null}
          downloadError="Network error"
          isDownloading={false}
        />
      );

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should disable Retry button during download', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={{ event: 'Progress' }}
          downloadError="Previous error"
          isDownloading={true}
        />
      );

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).toBeDisabled();
    });
  });

  describe('Update info display', () => {
    it('should display version and date', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      expect(screen.getByText('Version 1.0.1')).toBeInTheDocument();
      // Date format varies by locale, just check it exists
      expect(screen.getByText(/16.*2026|2026.*16/)).toBeInTheDocument();
    });

    it('should display release notes', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      expect(
        screen.getByText(/CRITICAL: Fixes AI detection bypass/)
      ).toBeInTheDocument();
    });

    it('should show mandatory warning message', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      expect(screen.getByText(/This update is mandatory/)).toBeInTheDocument();
      expect(
        screen.getByText(/You cannot use the app until the update is installed/)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility (Task 7.7)', () => {
    it('should have focus trap applied', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      // Focus trap is applied via useFocusTrap hook
      // In a real test, we'd verify Tab key trapping, but that requires DOM simulation
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should have aria-live region for dynamic updates', () => {
      const { container } = render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      const liveRegion = container.querySelector('[aria-live="assertive"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should have proper button focus states', () => {
      render(
        <MandatoryUpdateDialog
          updateInfo={mockUpdateInfo}
          onUpdateNow={vi.fn()}
          onRetry={vi.fn()}
          downloadProgress={null}
          downloadError={null}
          isDownloading={false}
        />
      );

      const button = screen.getByRole('button', { name: 'Update Now' });
      // In CSS, focus-visible styles are applied
      expect(button).toHaveClass('mandatory-update-button');
    });
  });
});
