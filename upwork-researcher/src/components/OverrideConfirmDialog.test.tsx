import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OverrideConfirmDialog from "./OverrideConfirmDialog";

describe("OverrideConfirmDialog", () => {
  const mockOnCancel = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Story 3.6, Task 5.1: Renders warning text
  it("renders warning text", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    expect(
      screen.getByText(/This proposal may be detected as AI-generated/i)
    ).toBeInTheDocument();
  });

  // Story 3.6, Task 5.1: Renders consequence text
  it("renders consequence text about Upwork penalty", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    expect(
      screen.getByText(/Upwork may penalize your account/i)
    ).toBeInTheDocument();
  });

  // Story 3.6, Task 5.1: Renders question text
  it("renders confirmation question", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    expect(
      screen.getByText(/Are you sure you want to copy it\?/i)
    ).toBeInTheDocument();
  });

  // Story 3.6, Task 5.2: Renders Cancel and Copy Anyway buttons
  it("renders Cancel and Copy Anyway buttons", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    expect(
      screen.getByRole("button", { name: /Cancel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy Anyway/i })
    ).toBeInTheDocument();
  });

  // Story 3.6, Task 5.3: Cancel button calls onCancel callback
  it("calls onCancel when Cancel button is clicked", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  // Story 3.6, Task 5.4: Copy Anyway button calls onConfirm callback
  it("calls onConfirm when Copy Anyway button is clicked", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy Anyway/i }));

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  // Story 3.6, Task 5.5: Escape key calls onCancel
  it("calls onCancel when Escape key is pressed", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  // Story 3.6, Task 5.6: Cancel button has focus on mount (safety)
  it("has Cancel button focused on mount (safety default)", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    // React's autoFocus prop causes the button to receive focus on mount
    expect(cancelButton).toHaveFocus();
  });

  // Story 3.6, Task 5.7: Dialog has role="alertdialog" and aria-modal="true"
  it("has correct ARIA attributes for accessibility", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-describedby", "override-confirm-desc");
  });

  // Story 3.6: Verify warning emoji is rendered
  it("renders warning emoji", () => {
    render(
      <OverrideConfirmDialog onCancel={mockOnCancel} onConfirm={mockOnConfirm} />
    );

    // The emoji is in the warning text
    const warningText = screen.getByText(
      /This proposal may be detected as AI-generated/i
    );
    expect(warningText.textContent).toContain("⚠️");
  });
});
