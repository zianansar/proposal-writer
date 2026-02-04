import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExportButton from "./ExportButton";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("ExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders export button", () => {
    render(<ExportButton />);
    expect(screen.getByText("Export to JSON")).toBeInTheDocument();
  });

  it("shows loading state while exporting", async () => {
    let resolveExport: (value: unknown) => void;
    const exportPromise = new Promise((resolve) => {
      resolveExport = resolve;
    });
    mockInvoke.mockReturnValueOnce(exportPromise);

    render(<ExportButton />);

    fireEvent.click(screen.getByText("Export to JSON"));

    expect(screen.getByText("Exporting...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();

    // Resolve the export
    resolveExport!({
      success: true,
      filePath: "/path/to/file.json",
      proposalCount: 5,
      message: "Exported 5 proposals",
    });

    await waitFor(() => {
      expect(screen.getByText("Export to JSON")).toBeInTheDocument();
    });
  });

  it("calls export_proposals_to_json on click", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      filePath: "/path/to/file.json",
      proposalCount: 10,
      message: "Exported 10 proposals to /path/to/file.json",
    });

    render(<ExportButton />);

    fireEvent.click(screen.getByText("Export to JSON"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("export_proposals_to_json");
    });
  });

  it("shows success message after export", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      filePath: "/path/to/file.json",
      proposalCount: 47,
      message: "Exported 47 proposals to /path/to/file.json",
    });

    render(<ExportButton />);

    fireEvent.click(screen.getByText("Export to JSON"));

    await waitFor(() => {
      expect(screen.getByText("Exported 47 proposals to /path/to/file.json")).toBeInTheDocument();
    });
  });

  it("shows error message on export failure", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Database lock error"));

    render(<ExportButton />);

    fireEvent.click(screen.getByText("Export to JSON"));

    await waitFor(() => {
      expect(screen.getByText("Database lock error")).toBeInTheDocument();
    });
  });

  it("shows message when no proposals to export", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      filePath: null,
      proposalCount: 0,
      message: "No proposals to export",
    });

    render(<ExportButton />);

    fireEvent.click(screen.getByText("Export to JSON"));

    await waitFor(() => {
      expect(screen.getByText("No proposals to export")).toBeInTheDocument();
    });
  });

  it("shows message when export cancelled", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      filePath: null,
      proposalCount: 5,
      message: "Export cancelled",
    });

    render(<ExportButton />);

    fireEvent.click(screen.getByText("Export to JSON"));

    await waitFor(() => {
      expect(screen.getByText("Export cancelled")).toBeInTheDocument();
    });
  });

  it("applies custom className", () => {
    render(<ExportButton className="custom-class" />);
    const container = screen.getByText("Export to JSON").closest(".export-button-container");
    expect(container).toHaveClass("custom-class");
  });
});
