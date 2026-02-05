import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreMigrationBackup } from './PreMigrationBackup';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('PreMigrationBackup', () => {
  const mockOnBackupComplete = vi.fn();
  const mockOnBackupFailed = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    expect(screen.getByText(/Creating backup before migration/i)).toBeInTheDocument();
  });

  it('auto-starts backup on mount', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    expect(mockInvoke).toHaveBeenCalledWith('create_pre_migration_backup');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('displays success state with backup details', async () => {
    const mockBackupResult = {
      success: true,
      filePath: '/app/data/backups/pre-encryption-backup-2026-02-05-14-30-00.json',
      proposalCount: 47,
      settingsCount: 12,
      jobPostsCount: 8,
      message: 'Backup created: 47 proposals saved to backup file',
    };

    mockInvoke.mockResolvedValue(mockBackupResult);

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Created/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/47 proposals saved to backup file/i)).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument(); // Proposal count
    expect(screen.getByText('12')).toBeInTheDocument(); // Settings count
    expect(screen.getByText('8')).toBeInTheDocument(); // Job posts count
    expect(mockOnBackupComplete).toHaveBeenCalledWith(mockBackupResult.filePath);
  });

  it('truncates file path correctly in UI', async () => {
    const mockBackupResult = {
      success: true,
      filePath: '/very/long/path/to/app/data/backups/pre-encryption-backup-2026-02-05-14-30-00.json',
      proposalCount: 5,
      settingsCount: 2,
      jobPostsCount: 1,
      message: 'Backup created: 5 proposals saved to backup file',
    };

    mockInvoke.mockResolvedValue(mockBackupResult);

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Created/i)).toBeInTheDocument();
    });

    // File path should be truncated to ...backups/filename
    expect(screen.getByText(/...backups\/pre-encryption-backup-2026-02-05-14-30-00.json/i)).toBeInTheDocument();
  });

  it('displays error state when backup fails', async () => {
    const errorMessage = 'Failed to create backup directory: Permission denied';
    mockInvoke.mockRejectedValue(new Error(errorMessage));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(mockOnBackupFailed).toHaveBeenCalledWith(errorMessage);
    expect(screen.getByText(/Retry Backup/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel Migration/i)).toBeInTheDocument();
  });

  it('handles retry button click', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce({
        success: true,
        filePath: '/app/data/backups/pre-encryption-backup-retry.json',
        proposalCount: 10,
        settingsCount: 5,
        jobPostsCount: 2,
        message: 'Backup created: 10 proposals saved to backup file',
      });

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/Backup Failed/i)).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText(/Retry Backup/i);
    retryButton.click();

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/Backup Created/i)).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('uses custom onRetry callback when provided', async () => {
    mockInvoke.mockRejectedValue(new Error('Backup failed'));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
        onRetry={mockOnRetry}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Failed/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByText(/Retry Backup/i);
    retryButton.click();

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('handles cancel migration button', async () => {
    const errorMessage = 'Backup failed';
    mockInvoke.mockRejectedValue(new Error(errorMessage));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Failed/i)).toBeInTheDocument();
    });

    const cancelButton = screen.getByText(/Cancel Migration/i);
    cancelButton.click();

    // Cancel calls onBackupFailed with the error
    expect(mockOnBackupFailed).toHaveBeenCalledWith(errorMessage);
  });

  it('handles success=false in backup result', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      filePath: '',
      proposalCount: 0,
      settingsCount: 0,
      jobPostsCount: 0,
      message: '',
    });

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Backup failed: Unknown error/i)).toBeInTheDocument();
    expect(mockOnBackupFailed).toHaveBeenCalledWith('Backup failed: Unknown error');
  });
});
