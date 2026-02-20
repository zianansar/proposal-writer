/**
 * RollbackDialog component tests (Story TD2.3 Task 4.2, AC-7, AC-6)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { RollbackDialog } from "./RollbackDialog";

// Mock useFocusTrap — tested separately in hooks/useFocusTrap.test.ts
vi.mock("../hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

const defaultProps = {
  isOpen: false,
  failedVersion: "1.2.0",
  previousVersion: "1.1.0",
  reason: "Database integrity check failed",
  onRestart: vi.fn(),
};

describe("RollbackDialog", () => {
  it("renders null when isOpen=false", () => {
    const { container } = render(<RollbackDialog {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with failedVersion and previousVersion in text", () => {
    render(<RollbackDialog {...defaultProps} isOpen={true} />);
    expect(screen.getByText(/v1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.1\.0/)).toBeInTheDocument();
  });

  it("renders reason text", () => {
    render(<RollbackDialog {...defaultProps} isOpen={true} />);
    expect(screen.getByText(/Database integrity check failed/)).toBeInTheDocument();
  });

  it("clicking Restart App calls onRestart", async () => {
    const onRestart = vi.fn();
    render(<RollbackDialog {...defaultProps} isOpen={true} onRestart={onRestart} />);
    const button = screen.getByRole("button", { name: /restart app/i });
    await userEvent.click(button);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("restart button receives focus on open (AC-6)", () => {
    render(<RollbackDialog {...defaultProps} isOpen={true} />);
    const button = screen.getByRole("button", { name: /restart app/i });
    // React autoFocus prop calls .focus() on the element — verify the button has focus
    expect(button).toHaveFocus();
  });

  it("has role=dialog and aria-modal=true (AC-6)", () => {
    render(<RollbackDialog {...defaultProps} isOpen={true} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("aria-labelledby and aria-describedby point to valid elements (AC-6)", () => {
    render(<RollbackDialog {...defaultProps} isOpen={true} />);
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    const descId = dialog.getAttribute("aria-describedby");
    expect(labelId).toBeTruthy();
    expect(descId).toBeTruthy();
    expect(document.getElementById(labelId!)).toBeInTheDocument();
    expect(document.getElementById(descId!)).toBeInTheDocument();
  });
});
