import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { OutcomeDropdown } from "./OutcomeDropdown";
import { OUTCOME_STATUSES } from "./useUpdateProposalOutcome";

const mockAnchorRect: DOMRect = {
  top: 100,
  bottom: 124,
  left: 200,
  right: 300,
  width: 100,
  height: 24,
  x: 200,
  y: 100,
  toJSON: () => ({}),
};

describe("OutcomeDropdown", () => {
  const defaultProps = {
    currentStatus: "pending" as const,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    anchorRect: mockAnchorRect,
  };

  beforeEach(() => {
    defaultProps.onSelect.mockClear();
    defaultProps.onClose.mockClear();
  });

  it("renders all 7 outcome status options (AC-1)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(7);
  });

  it("displays formatted labels (underscores replaced, capitalized)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Response Received")).toBeInTheDocument();
    expect(screen.getByText("Interview")).toBeInTheDocument();
    expect(screen.getByText("Hired")).toBeInTheDocument();
    expect(screen.getByText("No Response")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("highlights current status with aria-selected (AC-1)", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="hired" />);

    const hiredOption = screen.getByText("Hired");
    expect(hiredOption).toHaveAttribute("aria-selected", "true");

    const pendingOption = screen.getByText("Pending");
    expect(pendingOption).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect when an option is clicked (AC-2)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    fireEvent.mouseDown(screen.getByText("Hired"));

    expect(defaultProps.onSelect).toHaveBeenCalledWith("hired");
  });

  it("closes on Escape key (AC-4)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "Escape" });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("navigates down with ArrowDown key (AC-4)", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="pending" />);

    const listbox = screen.getByRole("listbox");

    // Initial focus on pending (index 0), press down to submitted (index 1)
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveClass("outcome-dropdown__option--focused");
  });

  it("navigates up with ArrowUp key (AC-4)", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="submitted" />);

    const listbox = screen.getByRole("listbox");

    // Initial focus on submitted (index 1), press up to pending (index 0)
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveClass("outcome-dropdown__option--focused");
  });

  it("does not go below last option on ArrowDown", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="rejected" />);

    const listbox = screen.getByRole("listbox");

    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    // Last option should still be focused
    expect(options[OUTCOME_STATUSES.length - 1]).toHaveClass("outcome-dropdown__option--focused");
  });

  it("does not go above first option on ArrowUp", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="pending" />);

    const listbox = screen.getByRole("listbox");

    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveClass("outcome-dropdown__option--focused");
  });

  it("selects focused option on Enter (AC-4)", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="pending" />);

    const listbox = screen.getByRole("listbox");

    // Move to "submitted" (index 1) and press Enter
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(defaultProps.onSelect).toHaveBeenCalledWith("submitted");
  });

  it("closes on Tab key", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "Tab" });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("has correct ARIA attributes including aria-activedescendant (M3)", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="pending" />);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-label", "Select outcome status");
    expect(listbox).toHaveAttribute("tabIndex", "0");
    expect(listbox).toHaveAttribute("aria-activedescendant", "outcome-option-pending");
  });

  it("options have id attributes for aria-activedescendant (M3)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("id", "outcome-option-pending");
    expect(options[4]).toHaveAttribute("id", "outcome-option-hired");
    expect(options[6]).toHaveAttribute("id", "outcome-option-rejected");
  });

  it("aria-activedescendant updates on arrow key navigation (M3)", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="pending" />);

    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(listbox).toHaveAttribute("aria-activedescendant", "outcome-option-submitted");
  });

  it("closes on scroll event (M5)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    window.dispatchEvent(new Event("scroll", { bubbles: true }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders via portal to document.body", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    // The listbox should be rendered directly in document.body
    const listbox = screen.getByRole("listbox");
    expect(listbox.parentElement).toBe(document.body);
  });

  it("positions below anchor rect", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    const listbox = screen.getByRole("listbox");
    expect(listbox.style.top).toBe("128px"); // bottom (124) + 4
    expect(listbox.style.left).toBe("200px");
  });

  it("updates focused index on mouse enter", () => {
    render(<OutcomeDropdown {...defaultProps} currentStatus="pending" />);

    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[3]); // Interview

    expect(options[3]).toHaveClass("outcome-dropdown__option--focused");
  });

  it("stops event propagation on option click (AC-3)", () => {
    render(<OutcomeDropdown {...defaultProps} />);

    const option = screen.getByText("Hired");
    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    const stopPropSpy = vi.spyOn(mouseDownEvent, "stopPropagation");

    option.dispatchEvent(mouseDownEvent);

    expect(stopPropSpy).toHaveBeenCalled();
  });
});
