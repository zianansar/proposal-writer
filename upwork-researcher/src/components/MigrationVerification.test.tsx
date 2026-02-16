import { invoke } from "@tauri-apps/api/core";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MigrationVerification } from "./MigrationVerification";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockVerificationData = {
  proposals_count: 47,
  settings_count: 10,
  job_posts_count: 5,
  backup_path: "/app/data/backups/pre-encryption-backup-2026-02-05.json",
  old_db_path: "/app/data/upwork-researcher.db.old",
};

describe("MigrationVerification", () => {
  const mockOnDeleteDatabase = vi.fn();
  const mockOnKeepBoth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Subtask 10.1: Test MigrationVerification renders with verification data
  it("renders verification data correctly", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mockVerificationData);

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    // Check counts are displayed
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("Proposals")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Job Posts")).toBeInTheDocument();

    // Check paths are displayed
    expect(screen.getByText(/pre-encryption-backup-2026-02-05.json/)).toBeInTheDocument();
    expect(screen.getByText(/upwork-researcher.db.old/)).toBeInTheDocument();
  });

  // Subtask 10.2: Test delete button shows confirmation dialog
  it("shows confirmation dialog when delete button clicked", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mockVerificationData);

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", {
      name: /Delete Unencrypted Database/i,
    });
    fireEvent.click(deleteButton);

    // Check confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/⚠️ Warning/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Deleting the unencrypted database is permanent/i),
      ).toBeInTheDocument();
    });
  });

  // Subtask 10.3: Test confirmation dialog cancel returns to main screen
  it("closes confirmation dialog when cancel clicked", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mockVerificationData);

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    // Open confirmation dialog
    const deleteButton = screen.getByRole("button", {
      name: /Delete Unencrypted Database/i,
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Warning/i)).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText(/⚠️ Warning/i)).not.toBeInTheDocument();
    });

    // Callbacks should not be called
    expect(mockOnDeleteDatabase).not.toHaveBeenCalled();
  });

  // Subtask 10.4: Test confirmation dialog confirm calls delete command
  it("calls delete_old_database command when confirmed", async () => {
    (invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockVerificationData) // First call: get_migration_verification
      .mockResolvedValueOnce("Deleted successfully"); // Second call: delete_old_database

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    // Open confirmation dialog
    const deleteButton = screen.getByRole("button", {
      name: /Delete Unencrypted Database/i,
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Warning/i)).toBeInTheDocument();
    });

    // Click confirm
    const confirmButton = screen.getByRole("button", {
      name: /Yes, Delete Permanently/i,
    });
    fireEvent.click(confirmButton);

    // Wait for delete command to be called
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("delete_old_database", {
        oldDbPath: mockVerificationData.old_db_path,
      });
    });

    // Wait for success callback (with timeout)
    await waitFor(
      () => {
        expect(mockOnDeleteDatabase).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });

  // Subtask 10.5: Test "Keep Both" button calls onKeepBoth callback
  it('calls onKeepBoth callback when "Keep Both" clicked', async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mockVerificationData);

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    // Click "Keep Both" button
    const keepBothButton = screen.getByRole("button", {
      name: /Keep Both \(for now\)/i,
    });
    fireEvent.click(keepBothButton);

    // Check informational dialog appears
    await waitFor(() => {
      expect(screen.getByText(/Keep Both Databases/i)).toBeInTheDocument();
    });

    // Click continue button
    const continueButton = screen.getByRole("button", {
      name: /Continue to Application/i,
    });
    fireEvent.click(continueButton);

    // Callback should be called
    expect(mockOnKeepBoth).toHaveBeenCalled();
  });

  // Subtask 10.6: Test loading state during deletion
  it("shows loading state during deletion", async () => {
    (invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockVerificationData)
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve("Deleted"), 100)),
      );

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    // Open and confirm deletion
    const deleteButton = screen.getByRole("button", {
      name: /Delete Unencrypted Database/i,
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Warning/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", {
      name: /Yes, Delete Permanently/i,
    });
    fireEvent.click(confirmButton);

    // Check loading state appears
    await waitFor(() => {
      expect(screen.getByText(/Deleting unencrypted database.../i)).toBeInTheDocument();
    });
  });

  // Subtask 10.7: Test error handling for deletion failure
  it("handles deletion errors gracefully", async () => {
    (invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockVerificationData)
      .mockRejectedValueOnce(new Error("Permission denied"));

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Migration Complete!")).toBeInTheDocument();
    });

    // Open and confirm deletion
    const deleteButton = screen.getByRole("button", {
      name: /Delete Unencrypted Database/i,
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Warning/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", {
      name: /Yes, Delete Permanently/i,
    });
    fireEvent.click(confirmButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Verification Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Permission denied/i)).toBeInTheDocument();
    });

    // Callback should not be called on error
    expect(mockOnDeleteDatabase).not.toHaveBeenCalled();
  });

  it("handles loading state when verification data is being fetched", () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    expect(screen.getByText(/Loading verification data.../i)).toBeInTheDocument();
  });

  it("handles error when verification data fetch fails", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Database connection failed"));

    render(
      <MigrationVerification onDeleteDatabase={mockOnDeleteDatabase} onKeepBoth={mockOnKeepBoth} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Verification Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();
    });
  });
});
