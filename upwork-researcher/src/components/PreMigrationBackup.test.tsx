import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { PreMigrationBackup } from "./PreMigrationBackup";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("PreMigrationBackup", () => {
  const mockOnBackupComplete = vi.fn();
  const mockOnBackupFailed = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // H4 fix: Reset mock implementation to prevent state leakage between tests
    mockInvoke.mockReset();
  });

  afterEach(async () => {
    // H4 fix: Ensure cleanup between tests to avoid "multiple elements with same text" errors
    cleanup();
    // Allow any pending promises to settle
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("renders loading state initially", () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    expect(screen.getByText(/Creating backup before migration/i)).toBeInTheDocument();
  });

  it("auto-starts backup on mount", () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    expect(mockInvoke).toHaveBeenCalledWith("create_pre_migration_backup");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("displays success state with backup details", async () => {
    const mockBackupResult = {
      success: true,
      filePath: "/app/data/backups/pre-encryption-backup-2026-02-05-14-30-00.json",
      proposalCount: 47,
      settingsCount: 12,
      jobPostsCount: 8,
      message: "Backup created: 47 proposals saved to backup file",
    };

    mockInvoke.mockResolvedValue(mockBackupResult);

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    // H4 fix: Wait for loading to finish first, then check for success
    await waitFor(() => {
      expect(screen.queryByText(/Creating backup/i)).not.toBeInTheDocument();
    });

    // H4 fix: Use more specific selector - look for heading element
    expect(screen.getByRole("heading", { name: /Backup Created/i })).toBeInTheDocument();
    expect(screen.getByText(/47 proposals saved to backup file/i)).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument(); // Proposal count
    expect(screen.getByText("12")).toBeInTheDocument(); // Settings count
    expect(screen.getByText("8")).toBeInTheDocument(); // Job posts count
    expect(mockOnBackupComplete).toHaveBeenCalledWith(mockBackupResult.filePath);
  });

  it("truncates file path correctly in UI", async () => {
    const mockBackupResult = {
      success: true,
      filePath:
        "/very/long/path/to/app/data/backups/pre-encryption-backup-2026-02-05-14-30-00.json",
      proposalCount: 5,
      settingsCount: 2,
      jobPostsCount: 1,
      message: "Backup created: 5 proposals saved to backup file",
    };

    mockInvoke.mockResolvedValue(mockBackupResult);

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    // H4 fix: Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByText(/Creating backup/i)).not.toBeInTheDocument();
    });

    // H4 fix: Use more specific selector
    expect(screen.getByRole("heading", { name: /Backup Created/i })).toBeInTheDocument();

    // File path should be truncated to ...backups/filename
    expect(
      screen.getByText(/...backups\/pre-encryption-backup-2026-02-05-14-30-00.json/i),
    ).toBeInTheDocument();
  });

  it("displays error state when backup fails", async () => {
    const errorMessage = "Failed to create backup directory: Permission denied";
    mockInvoke.mockRejectedValue(new Error(errorMessage));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Backup Failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(mockOnBackupFailed).toHaveBeenCalledWith(errorMessage);
    expect(screen.getByText(/Retry Backup/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel Migration/i)).toBeInTheDocument();
  });

  it("handles retry button click", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValueOnce(new Error("First attempt failed")).mockResolvedValueOnce({
      success: true,
      filePath: "/app/data/backups/pre-encryption-backup-retry.json",
      proposalCount: 10,
      settingsCount: 5,
      jobPostsCount: 2,
      message: "Backup created: 10 proposals saved to backup file",
    });

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    // H4 fix: Wait for loading to finish, then check for error heading
    await waitFor(() => {
      expect(screen.queryByText(/Creating backup/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /Backup Failed/i })).toBeInTheDocument();

    // H4 fix: Use userEvent instead of direct .click() for proper async handling
    const retryButton = screen.getByRole("button", { name: /Retry Backup/i });
    await user.click(retryButton);

    // Wait for success - use heading selector
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Backup Created/i })).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("uses custom onRetry callback when provided", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Backup failed"));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
        onRetry={mockOnRetry}
      />,
    );

    // H4 fix: Wait for loading to finish, then check for error heading
    await waitFor(() => {
      expect(screen.queryByText(/Creating backup/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /Backup Failed/i })).toBeInTheDocument();

    // H4 fix: Use userEvent instead of direct .click()
    const retryButton = screen.getByRole("button", { name: /Retry Backup/i });
    await user.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("handles cancel migration button", async () => {
    const user = userEvent.setup();
    const errorMessage = "Backup failed";
    mockInvoke.mockRejectedValue(new Error(errorMessage));

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    // H4 fix: Wait for loading to finish, then check for error heading
    await waitFor(() => {
      expect(screen.queryByText(/Creating backup/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /Backup Failed/i })).toBeInTheDocument();

    // H4 fix: Use userEvent instead of direct .click()
    const cancelButton = screen.getByRole("button", { name: /Cancel Migration/i });
    await user.click(cancelButton);

    // Cancel calls onBackupFailed with the error
    expect(mockOnBackupFailed).toHaveBeenCalledWith(errorMessage);
  });

  it("handles success=false in backup result", async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      filePath: "",
      proposalCount: 0,
      settingsCount: 0,
      jobPostsCount: 0,
      message: "",
    });

    render(
      <PreMigrationBackup
        onBackupComplete={mockOnBackupComplete}
        onBackupFailed={mockOnBackupFailed}
      />,
    );

    // H4 fix: Wait for loading to finish, then check for error heading
    await waitFor(() => {
      expect(screen.queryByText(/Creating backup/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /Backup Failed/i })).toBeInTheDocument();

    expect(screen.getByText(/Backup failed: Unknown error/i)).toBeInTheDocument();
    expect(mockOnBackupFailed).toHaveBeenCalledWith("Backup failed: Unknown error");
  });
});
