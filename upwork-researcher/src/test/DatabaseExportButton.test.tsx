// DatabaseExportButton.test.tsx — Tests for encrypted database export (Story 7.6)

import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { DatabaseExportButton } from "../features/proposal-history/DatabaseExportButton";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock Tauri event listener (M-1: progress events)
const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

describe("DatabaseExportButton", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockListen.mockClear();
    mockListen.mockResolvedValue(() => {}); // Returns unlisten fn
  });

  it("renders idle state with export button", () => {
    render(<DatabaseExportButton />);
    const button = screen.getByRole("button", { name: /export encrypted database backup/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Export Encrypted Backup");
  });

  it("shows confirmation dialog when button clicked", async () => {
    const user = userEvent.setup();
    render(<DatabaseExportButton />);

    const button = screen.getByRole("button", { name: /export encrypted database backup/i });
    await user.click(button);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Passphrase Warning/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This backup is encrypted with your current passphrase/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Passphrase hint/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export Backup/i })).toBeInTheDocument();
  });

  it("returns to idle state when cancel clicked", async () => {
    const user = userEvent.setup();
    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export encrypted database backup/i }),
    ).toBeInTheDocument();
  });

  it("passes passphrase hint to backend when provided", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: true,
      filePath: "/path/to/backup.urb",
      fileSizeBytes: 1024000,
      proposalCount: 10,
      revisionCount: 20,
      jobPostCount: 5,
      settingsCount: 3,
      voiceProfileCount: 1,
      message: "Success",
    });

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.type(screen.getByLabelText(/Passphrase hint/i), "My childhood pet");
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("export_encrypted_archive", {
        passphraseHint: "My childhood pet",
      });
    });
  });

  it("passes null hint when hint is empty", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: true,
      filePath: "/path/to/backup.urb",
      fileSizeBytes: 1024000,
      proposalCount: 10,
      revisionCount: 20,
      jobPostCount: 5,
      settingsCount: 3,
      voiceProfileCount: 1,
      message: "Success",
    });

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("export_encrypted_archive", {
        passphraseHint: null,
      });
    });
  });

  it("displays exporting state during export", async () => {
    const user = userEvent.setup();
    let resolveExport: (value: unknown) => void;
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    );

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(screen.getByText(/Preparing\.\.\./)).toBeInTheDocument();
    });

    // Cleanup — resolve the pending promise
    await act(async () => {
      resolveExport!({
        success: true,
        filePath: "/test.urb",
        fileSizeBytes: 1000,
        proposalCount: 0,
        revisionCount: 0,
        jobPostCount: 0,
        settingsCount: 0,
        voiceProfileCount: 0,
        message: "",
      });
    });
  });

  it("displays success state with result details", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: true,
      filePath: "/home/user/upwork-backup-2026-02-13.urb",
      fileSizeBytes: 2097152, // exactly 2 MB (2 * 1024 * 1024)
      proposalCount: 42,
      revisionCount: 123,
      jobPostCount: 89,
      settingsCount: 12,
      voiceProfileCount: 1,
      message: "Backup exported successfully",
    });

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(screen.getByText(/Backup exported successfully/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/upwork-backup-2026-02-13\.urb/)).toBeInTheDocument();
    expect(screen.getByText(/2\.00 MB/)).toBeInTheDocument();
    expect(screen.getByText(/42 Proposals/)).toBeInTheDocument();
    expect(screen.getByText(/123 Revisions/)).toBeInTheDocument();
    expect(screen.getByText(/89 Jobs/)).toBeInTheDocument();
    expect(screen.getByText(/12 Settings/)).toBeInTheDocument();
    expect(screen.getByText(/1 Voice Profiles/)).toBeInTheDocument();
  });

  it("displays error state with error message", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: false,
      filePath: null,
      fileSizeBytes: 0,
      proposalCount: 0,
      revisionCount: 0,
      jobPostCount: 0,
      settingsCount: 0,
      voiceProfileCount: 0,
      message: "Please wait 45 seconds before exporting again",
    });

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(screen.getByText(/Export failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Please wait 45 seconds before exporting again/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("returns to idle when Try Again clicked", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: false,
      filePath: null,
      fileSizeBytes: 0,
      proposalCount: 0,
      revisionCount: 0,
      jobPostCount: 0,
      settingsCount: 0,
      voiceProfileCount: 0,
      message: "Disk full, cannot export",
    });

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(screen.getByText(/Disk full, cannot export/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Try Again/i }));

    expect(screen.queryByText(/Disk full, cannot export/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export encrypted database backup/i }),
    ).toBeInTheDocument();
  });

  it("handles unexpected invoke errors", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Unexpected error"));

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unexpected error/)).toBeInTheDocument();
    });
  });

  it("formats file sizes correctly", async () => {
    const user = userEvent.setup();

    const testCases = [
      { bytes: 0, expected: "0 B" },
      { bytes: 512, expected: "512 B" },
      { bytes: 1024, expected: "1.00 KB" },
      { bytes: 1536, expected: "1.50 KB" },
      { bytes: 1048576, expected: "1.00 MB" },
      { bytes: 1073741824, expected: "1.00 GB" },
    ];

    for (const { bytes, expected } of testCases) {
      mockInvoke.mockResolvedValue({
        success: true,
        filePath: "/test.urb",
        fileSizeBytes: bytes,
        proposalCount: 0,
        revisionCount: 0,
        jobPostCount: 0,
        settingsCount: 0,
        voiceProfileCount: 0,
        message: "",
      });

      const { unmount } = render(<DatabaseExportButton />);

      await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
      await user.click(screen.getByRole("button", { name: /Export Backup/i }));

      await waitFor(() => {
        expect(screen.getByText(expected)).toBeInTheDocument();
      });

      unmount();
    }
  });

  it("auto-focuses passphrase hint input when dialog opens", async () => {
    const user = userEvent.setup();
    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));

    expect(screen.getByLabelText(/Passphrase hint/i)).toHaveFocus();
  });

  it("shows warning when hint looks like a passphrase", async () => {
    const user = userEvent.setup();
    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.type(screen.getByLabelText(/Passphrase hint/i), "MyP@ssw0rd!");

    expect(screen.getByText(/looks like a passphrase/i)).toBeInTheDocument();
  });

  it("does not show warning for normal hint text", async () => {
    const user = userEvent.setup();
    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.type(screen.getByLabelText(/Passphrase hint/i), "My childhood pet");

    expect(screen.queryByText(/looks like a passphrase/i)).not.toBeInTheDocument();
  });

  it("registers event listener for export progress", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      success: true,
      filePath: "/test.urb",
      fileSizeBytes: 1000,
      proposalCount: 0,
      revisionCount: 0,
      jobPostCount: 0,
      settingsCount: 0,
      voiceProfileCount: 0,
      message: "",
    });

    render(<DatabaseExportButton />);

    await user.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
    await user.click(screen.getByRole("button", { name: /Export Backup/i }));

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith("export-progress", expect.any(Function));
    });
  });

  // Auto-dismiss: use fireEvent (synchronous) + fake timers to avoid
  // the userEvent + fakeTimers deadlock with waitFor's internal polling
  describe("auto-dismiss behavior", () => {
    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it("auto-dismisses success state after 8 seconds", async () => {
      vi.useFakeTimers();
      mockInvoke.mockResolvedValue({
        success: true,
        filePath: "/test.urb",
        fileSizeBytes: 1000,
        proposalCount: 1,
        revisionCount: 0,
        jobPostCount: 0,
        settingsCount: 0,
        voiceProfileCount: 0,
        message: "Success",
      });

      render(<DatabaseExportButton />);

      // Use fireEvent (synchronous) to avoid userEvent timer conflicts
      fireEvent.click(screen.getByRole("button", { name: /export encrypted database backup/i }));

      // Now in confirming state
      fireEvent.click(screen.getByRole("button", { name: /Export Backup/i }));

      // Flush the resolved promise microtask
      await act(async () => {
        await Promise.resolve();
      });

      // Should be in success state
      expect(screen.getByText(/Backup exported successfully/i)).toBeInTheDocument();

      // Fast-forward 8 seconds
      act(() => {
        vi.advanceTimersByTime(8000);
      });

      // Should return to idle
      expect(screen.queryByText(/Backup exported successfully/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /export encrypted database backup/i }),
      ).toBeInTheDocument();
    });

    it("auto-dismisses error state after 8 seconds", async () => {
      vi.useFakeTimers();
      mockInvoke.mockRejectedValue(new Error("Network error"));

      render(<DatabaseExportButton />);

      fireEvent.click(screen.getByRole("button", { name: /export encrypted database backup/i }));
      fireEvent.click(screen.getByRole("button", { name: /Export Backup/i }));

      // Flush the rejected promise microtask
      await act(async () => {
        await Promise.resolve();
      });

      // Should be in error state
      expect(screen.getByText(/Network error/)).toBeInTheDocument();

      // Fast-forward 8 seconds
      act(() => {
        vi.advanceTimersByTime(8000);
      });

      // Should return to idle
      expect(screen.queryByText(/Network error/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /export encrypted database backup/i }),
      ).toBeInTheDocument();
    });
  });
});
