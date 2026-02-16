// Tests for ImportArchiveDialog component (Story 7.7)

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ImportArchiveDialog } from "./ImportArchiveDialog";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock Tauri dialog (open file picker)
const mockOpen = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

// Mock Tauri event listener
const mockListeners: Map<string, ((event: { payload: unknown }) => void)[]> = new Map();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
    if (!mockListeners.has(eventName)) {
      mockListeners.set(eventName, []);
    }
    mockListeners.get(eventName)!.push(callback);

    // Return unlisten function
    return () => {
      const listeners = mockListeners.get(eventName);
      if (listeners) {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      }
    };
  }),
}));

// Helper to emit mock events
function emitEvent(eventName: string, payload: unknown) {
  const listeners = mockListeners.get(eventName) || [];
  listeners.forEach((cb) => cb({ payload }));
}

// --- Mock data ---

const mockMetadata = {
  formatVersion: 1,
  exportDate: "2026-01-15T10:30:00Z",
  appVersion: "1.0.0",
  passphraseHint: "my hint",
  proposalCount: 5,
  revisionCount: 10,
  jobPostCount: 3,
  settingsCount: 2,
  voiceProfileCount: 1,
  dbSizeBytes: 1024,
};

const mockPreview = {
  metadata: mockMetadata,
  schemaCompatibility: "compatible" as const,
  archiveVersion: null,
  currentVersion: 27,
  warnings: [],
};

const mockSummary = {
  proposalsImported: 5,
  proposalsSkipped: 0,
  jobsImported: 3,
  revisionsImported: 10,
  settingsImported: 2,
  settingsSkipped: 0,
  voiceProfileImported: true,
  totalRecords: 21,
};

describe("ImportArchiveDialog", () => {
  const onClose = vi.fn();
  const onImportComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    mockOpen.mockReset();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderDialog = () =>
    render(<ImportArchiveDialog onClose={onClose} onImportComplete={onImportComplete} />);

  // --- Test 1: Renders file select button initially ---
  it("renders file select button initially", () => {
    renderDialog();

    expect(screen.getByText("Import from Archive")).toBeInTheDocument();
    expect(screen.getByText("Select Archive File", { selector: "button" })).toBeInTheDocument();
    expect(screen.getByText("Choose an encrypted .urb backup file to import.")).toBeInTheDocument();
  });

  // --- Test 2: Calls open() on file select click ---
  it("calls open() on file select click", async () => {
    mockOpen.mockResolvedValue(null); // user cancels picker

    renderDialog();

    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledTimes(1);
      expect(mockOpen).toHaveBeenCalledWith({
        title: "Select Archive File",
        filters: [{ name: "Upwork Research Backup", extensions: ["urb"] }],
        multiple: false,
      });
    });
  });

  // --- Test 3: Shows metadata after file selection ---
  it("shows metadata after file selection", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      return null;
    });

    renderDialog();

    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));

    await waitFor(() => {
      expect(screen.getByText("Archive Information")).toBeInTheDocument();
    });

    // Verify metadata was requested with correct path
    expect(mockInvoke).toHaveBeenCalledWith("read_archive_metadata", {
      archivePath: "/path/to/backup.urb",
    });

    // Verify metadata is displayed
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText(/"my hint"/)).toBeInTheDocument();

    // Verify counts are displayed within their count-value spans
    const countValues = document.querySelectorAll(".count-value");
    const countTexts = Array.from(countValues).map((el) => el.textContent);
    expect(countTexts).toContain("5"); // proposalCount
    expect(countTexts).toContain("10"); // revisionCount
    expect(countTexts).toContain("3"); // jobPostCount
    expect(countTexts).toContain("2"); // settingsCount
    expect(countTexts).toContain("1"); // voiceProfileCount

    // Verify Next button
    expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
  });

  // --- Test 4: Shows passphrase entry after clicking Next ---
  it("shows passphrase entry after clicking Next", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      return null;
    });

    renderDialog();

    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));

    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next: Enter Passphrase"));

    expect(screen.getByText("Decrypt Archive", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByLabelText("Archive Passphrase:")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter passphrase")).toBeInTheDocument();
    expect(screen.getByText("Decrypt Archive", { selector: "button" })).toBeInTheDocument();

    // Hint should be displayed
    expect(screen.getByText(/my hint/)).toBeInTheDocument();
  });

  // --- Test 5: Shows error on wrong passphrase ---
  it("shows error on wrong passphrase", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") throw new Error("Invalid passphrase");
      return null;
    });

    renderDialog();

    // Select file
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });

    // Go to decrypt step
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));

    // Enter wrong passphrase and submit
    const input = screen.getByLabelText("Archive Passphrase:");
    fireEvent.change(input, { target: { value: "wrong-pass" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Invalid passphrase")).toBeInTheDocument();
    });

    // Should stay on decrypt step (not go to error step)
    expect(screen.getByText("Decrypt Archive", { selector: "h3" })).toBeInTheDocument();
  });

  // --- Test 6: Shows import mode selection after successful decryption ---
  it("shows import mode selection after successful decryption", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") return mockPreview;
      return null;
    });

    renderDialog();

    // Select file
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });

    // Go to decrypt step
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));

    // Enter passphrase and decrypt
    const input = screen.getByLabelText("Archive Passphrase:");
    fireEvent.change(input, { target: { value: "correct-pass" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Import Preview")).toBeInTheDocument();
    });

    // Verify mode options
    expect(screen.getByText("Choose Import Mode")).toBeInTheDocument();
    expect(screen.getByText("Merge (Skip Duplicates)")).toBeInTheDocument();
    expect(screen.getByText("Replace All")).toBeInTheDocument();
    expect(screen.getByText("Start Import")).toBeInTheDocument();
  });

  // --- Test 7: Replace All requires checkbox confirmation ---
  it("Replace All requires checkbox confirmation", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") return mockPreview;
      return null;
    });

    renderDialog();

    // Navigate to mode step
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));
    fireEvent.change(screen.getByLabelText("Archive Passphrase:"), {
      target: { value: "correct-pass" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });
    await waitFor(() => {
      expect(screen.getByText("Import Preview")).toBeInTheDocument();
    });

    // Select Replace All mode
    const replaceRadio = screen.getByDisplayValue("replace");
    fireEvent.click(replaceRadio);

    // Confirmation checkbox should appear
    expect(
      screen.getByText("I understand this will permanently delete my current data"),
    ).toBeInTheDocument();

    // Start Import button should be disabled
    const startButton = screen.getByText("Start Import");
    expect(startButton).toBeDisabled();

    // Check the confirmation checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Start Import button should now be enabled
    expect(startButton).not.toBeDisabled();
  });

  // --- Test 8: Shows progress during import ---
  it("shows progress during import", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    let resolveImport: (value: unknown) => void;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") return mockPreview;
      if (cmd === "execute_import") {
        return new Promise((resolve) => {
          resolveImport = resolve;
        });
      }
      return null;
    });

    renderDialog();

    // Navigate to mode step
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));
    fireEvent.change(screen.getByLabelText("Archive Passphrase:"), {
      target: { value: "correct-pass" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });
    await waitFor(() => {
      expect(screen.getByText("Import Preview")).toBeInTheDocument();
    });

    // Start import (merge mode is default, no checkbox needed)
    await act(async () => {
      fireEvent.click(screen.getByText("Start Import"));
    });

    // Should show importing step
    expect(screen.getByText("Importing Data")).toBeInTheDocument();
    expect(
      screen.getByText("Please wait while your data is being imported..."),
    ).toBeInTheDocument();

    // Simulate progress event
    act(() => {
      emitEvent("import-progress", {
        table: "proposals",
        current: 3,
        total: 5,
        phase: "Importing",
      });
    });

    expect(screen.getByText(/Importing: proposals/)).toBeInTheDocument();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();

    // Cleanup: resolve the pending import
    await act(async () => {
      resolveImport!(mockSummary);
    });
  });

  // --- Test 9: Shows success summary after import completes ---
  it("shows success summary after import completes", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") return mockPreview;
      if (cmd === "execute_import") return mockSummary;
      return null;
    });

    renderDialog();

    // Navigate through all steps to import
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));
    fireEvent.change(screen.getByLabelText("Archive Passphrase:"), {
      target: { value: "correct-pass" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });
    await waitFor(() => {
      expect(screen.getByText("Import Preview")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Start Import"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Import Complete/)).toBeInTheDocument();
    });

    // Verify summary values
    expect(screen.getByText("21")).toBeInTheDocument(); // totalRecords
    expect(screen.getByText("Done")).toBeInTheDocument();

    // Voice profile imported
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  // --- Test 10: Shows error state with retry/cancel buttons ---
  it("shows error state with retry and cancel buttons", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") return mockPreview;
      if (cmd === "execute_import") throw new Error("Import failed: disk full");
      return null;
    });

    renderDialog();

    // Navigate through all steps to import
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));
    fireEvent.change(screen.getByLabelText("Archive Passphrase:"), {
      target: { value: "correct-pass" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });
    await waitFor(() => {
      expect(screen.getByText("Import Preview")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Start Import"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Import Failed/)).toBeInTheDocument();
    });

    expect(screen.getByText("Import failed: disk full")).toBeInTheDocument();
    expect(screen.getByText("Your current data is unchanged.")).toBeInTheDocument();
    expect(screen.getByText("Start Over")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Click Cancel should call onClose
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Test 11: Close button hidden during importing step ---
  it("close button is hidden during importing step", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    let resolveImport: (value: unknown) => void;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") return mockMetadata;
      if (cmd === "decrypt_archive") return mockPreview;
      if (cmd === "execute_import") {
        return new Promise((resolve) => {
          resolveImport = resolve;
        });
      }
      return null;
    });

    renderDialog();

    // Initially the close button should be visible
    expect(screen.getByLabelText("Close import dialog")).toBeInTheDocument();

    // Navigate through steps
    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));
    await waitFor(() => {
      expect(screen.getByText("Next: Enter Passphrase")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next: Enter Passphrase"));
    fireEvent.change(screen.getByLabelText("Archive Passphrase:"), {
      target: { value: "correct-pass" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Decrypt Archive", { selector: "button" }));
    });
    await waitFor(() => {
      expect(screen.getByText("Import Preview")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Start Import"));
    });

    // During importing, close button should not be present
    expect(screen.getByText("Importing Data")).toBeInTheDocument();
    expect(screen.queryByLabelText("Close import dialog")).not.toBeInTheDocument();

    // Cleanup: resolve the pending import
    await act(async () => {
      resolveImport!(mockSummary);
    });
  });

  // --- Test 12: Dialog close on overlay click ---
  it("closes dialog on overlay click", () => {
    renderDialog();

    const overlay = document.querySelector(".import-dialog-overlay")!;
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the dialog", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
  });

  // --- Additional edge case: Start Over resets to select step ---
  it("Start Over resets wizard back to file selection", async () => {
    mockOpen.mockResolvedValue("/path/to/backup.urb");
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "read_archive_metadata") throw new Error("Corrupted archive");
      return null;
    });

    renderDialog();

    fireEvent.click(screen.getByText("Select Archive File", { selector: "button" }));

    await waitFor(() => {
      expect(screen.getByText(/Import Failed/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Over"));

    // Should be back to file selection step
    expect(screen.getByText("Select Archive File", { selector: "button" })).toBeInTheDocument();
    expect(screen.getByText("Choose an encrypted .urb backup file to import.")).toBeInTheDocument();
  });
});
