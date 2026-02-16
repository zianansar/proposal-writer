import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import DeleteConfirmDialog from "./DeleteConfirmDialog";

describe("DeleteConfirmDialog", () => {
  const mockOnCancel = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dialog with correct content", () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    expect(screen.getByText(/Delete Proposal/)).toBeInTheDocument();
    // AC: "⚠️ This will permanently delete the proposal and all revisions."
    expect(
      screen.getByText(/⚠️ This will permanently delete the proposal and all revisions/),
    ).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete Permanently/ })).toBeInTheDocument();
  });

  it("has correct ARIA attributes for accessibility", () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "delete-confirm-title");
    expect(dialog).toHaveAttribute("aria-describedby", "delete-confirm-desc");
  });

  it("calls onCancel when Cancel button is clicked", () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm when Delete Permanently button is clicked", () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Delete Permanently/ }));

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape key is pressed", () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it("focuses Cancel button on mount for safety", async () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/ });

    // Story 8.2: useFocusTrap uses requestAnimationFrame for focus
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    expect(document.activeElement).toBe(cancelButton);
  });

  it("Enter key does NOT auto-confirm for safety", () => {
    render(<DeleteConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    // Pressing Enter should not trigger confirm
    fireEvent.keyDown(window, { key: "Enter" });

    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});
